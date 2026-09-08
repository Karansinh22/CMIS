"""
ingestion/live.py — Live microphone transcription sessions.

The browser captures the microphone, downsamples to 16 kHz mono 16-bit PCM and
streams raw frames over ``WS /ws/live/{meeting_id}``.  A ``LiveSession``
buffers those frames and, in a worker thread, cuts the buffer into chunks at
natural pauses (simple RMS silence detection), transcribes each chunk with
Whisper and persists + publishes the segments exactly like the upload path —
so the dashboard's live transcript, speaker relabelling and NLP extraction all
work unchanged.

Lifecycle
---------
    session = start_session(meeting_id)     # status → transcribing
    session.feed(pcm_bytes)                 # from the WebSocket, many times
    session.stop()                          # flush, write WAV, diarize, run NLP
"""

from __future__ import annotations

import logging
import queue
import threading
import time
import wave
from pathlib import Path
from typing import Dict, List, Optional

import numpy as np

from config import settings
from db import crud
from db.database import SessionLocal
from db.models import Meeting, Speaker, TranscriptSegment
from ingestion.pipeline import PROVISIONAL_SPEAKER, persist_segments, relabel_with_diarization
from ingestion.transcriber import RawSegment, transcribe_stream

logger = logging.getLogger(__name__)

SAMPLE_RATE = 16000


class LiveSession:
    """One live recording; owns its DB session and worker thread."""

    def __init__(self, meeting_id: str):
        self.meeting_id = meeting_id
        self.db = SessionLocal()
        self.provisional: Optional[Speaker] = None
        self._pcm = bytearray()                 # audio not yet transcribed
        self._all_pcm = bytearray()             # everything received (for the WAV)
        self._lock = threading.Lock()
        self._wake = threading.Event()
        self._stop_requested = False
        self._closed = False
        self.error: Optional[str] = None
        self.total_seconds = 0.0                # audio received
        self.transcribed_seconds = 0.0          # audio already decoded
        self.raw_segments: List[RawSegment] = []
        self.persisted: List[TranscriptSegment] = []
        self._last_text = ""
        self._thread = threading.Thread(target=self._run, name=f"live-{meeting_id[:8]}", daemon=True)

    # ── Public API (called from the WebSocket handler) ───────────────────────

    def start(self) -> None:
        from jobs.worker import update_status

        crud.update_meeting_status(self.db, self.meeting_id, "transcribing")
        self.provisional = crud.get_or_create_speaker(self.db, self.meeting_id, PROVISIONAL_SPEAKER)
        update_status(self.meeting_id, "transcribing", "Recording live — speak naturally…", progress=0.0)
        self._thread.start()

    def feed(self, pcm_bytes: bytes) -> None:
        """Append 16 kHz mono int16 PCM."""
        if self._closed or not pcm_bytes:
            return
        with self._lock:
            self._pcm.extend(pcm_bytes)
            self._all_pcm.extend(pcm_bytes)
            self.total_seconds = len(self._all_pcm) / 2 / SAMPLE_RATE
        self._wake.set()

    def stop(self) -> None:
        """Ask the worker to flush, finalise and run the NLP stage."""
        self._stop_requested = True
        self._wake.set()

    def abort(self, reason: str = "Connection lost") -> None:
        """Client vanished: keep what we have and still finalise."""
        if not self._stop_requested:
            logger.warning("Live session %s aborted: %s", self.meeting_id, reason)
            self.stop()

    @property
    def finished(self) -> bool:
        return self._closed

    # ── Worker thread ────────────────────────────────────────────────────────

    def _run(self) -> None:
        from jobs.worker import update_status

        try:
            while True:
                self._wake.wait(timeout=0.5)
                self._wake.clear()
                chunk = self._take_chunk(force=self._stop_requested)
                while chunk is not None:
                    self._transcribe_chunk(chunk)
                    chunk = self._take_chunk(force=self._stop_requested)
                if self._stop_requested and not self._pending_audio():
                    break
            self._finalise()
        except Exception as exc:  # noqa: BLE001
            logger.exception("Live session %s failed: %s", self.meeting_id, exc)
            self.error = str(exc)
            try:
                self.db.rollback()
                crud.update_meeting_status(self.db, self.meeting_id, "error")
            except Exception:  # noqa: BLE001
                pass
            update_status(self.meeting_id, "error", str(exc))
        finally:
            self._closed = True
            self.db.close()
            _sessions.pop(self.meeting_id, None)

    def _pending_audio(self) -> bool:
        with self._lock:
            return len(self._pcm) > 0

    def _take_chunk(self, force: bool = False) -> Optional[np.ndarray]:
        """Cut the next chunk off the buffer at a pause; None if not enough audio yet."""
        min_len = int(settings.live_min_chunk_seconds * SAMPLE_RATE)
        max_len = int(settings.live_max_chunk_seconds * SAMPLE_RATE)
        win = int(settings.live_silence_seconds * SAMPLE_RATE)

        with self._lock:
            n = len(self._pcm) // 2
            if n == 0:
                return None
            if n < min_len and not force:
                return None
            samples = np.frombuffer(bytes(self._pcm[: n * 2]), dtype=np.int16).astype(np.float32) / 32768.0

            cut = None
            if force:
                cut = n
            elif n >= max_len:
                cut = max_len
            else:
                # look for the most recent quiet window after min_len
                hop = win // 2 or 1
                for start in range(n - win, min_len - 1, -hop):
                    seg = samples[start:start + win]
                    if seg.size and float(np.sqrt(np.mean(seg * seg))) < settings.live_silence_rms:
                        cut = start + win // 2
                        break
            if cut is None:
                return None
            cut = max(1, min(cut, n))
            chunk = samples[:cut].copy()
            del self._pcm[: cut * 2]
        return chunk

    def _transcribe_chunk(self, chunk: np.ndarray) -> None:
        from jobs.worker import update_status

        offset = self.transcribed_seconds
        seconds = float(len(chunk)) / SAMPLE_RATE
        self.transcribed_seconds += seconds

        # Whisper needs a little padding to be happy with very short inputs
        if len(chunk) < SAMPLE_RATE:
            chunk = np.concatenate([chunk, np.zeros(SAMPLE_RATE - len(chunk), dtype=np.float32)])

        new: List[RawSegment] = list(
            transcribe_stream(chunk, time_offset=offset, initial_prompt=self._last_text[-200:] or None)
        )
        if not new:
            return
        # Padding must not push timestamps past the audio that was really received.
        for seg in new:
            seg.end = min(seg.end, offset + seconds)
            seg.start = min(seg.start, seg.end)
        self._last_text = " ".join(s.text for s in new)
        self.raw_segments.extend(new)
        self.persisted.extend(
            persist_segments(self.db, self.meeting_id, self.provisional, new, len(self.persisted),
                             progress=None)
        )
        update_status(
            self.meeting_id, "transcribing",
            f"Recording live — {self.transcribed_seconds:.0f}s transcribed",
        )

    def _write_wav(self) -> Path:
        settings.upload_dir.mkdir(parents=True, exist_ok=True)
        wav_path = settings.upload_dir / f"{self.meeting_id}_live_16k.wav"
        with self._lock:
            data = bytes(self._all_pcm)
        with wave.open(str(wav_path), "wb") as wf:
            wf.setnchannels(1)
            wf.setsampwidth(2)
            wf.setframerate(SAMPLE_RATE)
            wf.writeframes(data)
        return wav_path

    def _finalise(self) -> None:
        from jobs.worker import update_status
        from nlp.pipeline import run_nlp
        from nlp.project_synthesizer import synthesize_project_context

        update_status(self.meeting_id, "transcribing", "Recording stopped. Saving audio…", progress=1.0)
        wav_path = self._write_wav()
        meeting = self.db.query(Meeting).filter(Meeting.id == self.meeting_id).first()
        if meeting:
            meeting.audio_path = str(wav_path)
            self.db.commit()

        if not self.persisted:
            raise ValueError("No speech was detected in the recording.")

        update_status(self.meeting_id, "transcribing", "Identifying speakers…", progress=1.0)
        relabel_with_diarization(self.db, self.meeting_id, wav_path, self.raw_segments, self.persisted,
                                 self.provisional)

        crud.update_meeting_status(self.db, self.meeting_id, "structuring")
        update_status(self.meeting_id, "structuring", "Transcript saved. Analysing content…", progress=0.0)
        run_nlp(self.meeting_id, self.db)

        if meeting and meeting.project_id:
            try:
                synthesize_project_context(meeting.project_id, self.db)
            except Exception as exc:  # noqa: BLE001
                logger.error("Project synthesis after live meeting %s failed: %s", self.meeting_id, exc)
        logger.info("Live session %s finished: %.0fs of audio, %d segments.",
                    self.meeting_id, self.total_seconds, len(self.persisted))


# ── Registry ─────────────────────────────────────────────────────────────────

_sessions: Dict[str, LiveSession] = {}
_registry_lock = threading.Lock()


def start_session(meeting_id: str) -> LiveSession:
    with _registry_lock:
        if meeting_id in _sessions:
            raise RuntimeError("A live session is already running for this meeting.")
        session = LiveSession(meeting_id)
        _sessions[meeting_id] = session
    session.start()
    return session


def get_session(meeting_id: str) -> Optional[LiveSession]:
    return _sessions.get(meeting_id)
