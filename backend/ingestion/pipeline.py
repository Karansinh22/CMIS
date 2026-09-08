"""
ingestion/pipeline.py — Orchestrates audio ingestion end-to-end.

run_ingestion(audio_path, meeting_id, db) sequence:
    validate → convert to WAV → transcribe (streamed + persisted incrementally)
    → diarize → re-label speakers → hand over to the NLP stage

Live streaming
--------------
Whisper yields segments as it decodes.  Every few segments (or every couple of
seconds) the buffered segments are written to the DB with a provisional
speaker and pushed to WebSocket subscribers as a ``segments`` event, so the
dashboard fills in the transcript while the audio is still being processed.
Once diarization completes, the persisted segments are re-labelled and a
``transcript_ready`` event tells clients to refresh speaker names.
"""

from __future__ import annotations

import logging
import time
from pathlib import Path
from typing import Dict, List

from sqlalchemy.orm import Session

from config import settings
from db import crud
from db.models import Speaker, TranscriptSegment
from ingestion.diarizer import diarize, merge_transcript_with_diarization
from ingestion.transcriber import RawSegment, transcribe_stream
from ingestion.validator import validate_and_prepare
from utils.audio import to_wav_16k_mono

logger = logging.getLogger(__name__)

PROVISIONAL_SPEAKER = "SPEAKER_00"


def _segment_to_dict(seg: TranscriptSegment, speaker: Speaker | None) -> Dict:
    """Serialise a persisted segment the same way GET /meetings/{id}/transcript does."""
    return {
        "id": seg.id,
        "meeting_id": seg.meeting_id,
        "speaker_id": seg.speaker_id,
        "text": seg.text,
        "start_time": seg.start_time,
        "end_time": seg.end_time,
        "segment_index": seg.segment_index,
        "speaker": (
            {"id": speaker.id, "label": speaker.label, "name": speaker.name, "meeting_id": speaker.meeting_id}
            if speaker else None
        ),
    }


def persist_segments(
    db: Session,
    meeting_id: str,
    speaker: Speaker,
    raw_segments: List[RawSegment],
    start_index: int,
    progress: float | None = None,
) -> List[TranscriptSegment]:
    """Insert a batch of segments and push them to live viewers. Returns the rows."""
    from jobs.worker import publish_segments

    if not raw_segments:
        return []
    objs = [
        TranscriptSegment(
            meeting_id=meeting_id,
            speaker_id=speaker.id,
            text=seg.text,
            start_time=seg.start,
            end_time=seg.end,
            segment_index=start_index + i,
        )
        for i, seg in enumerate(raw_segments)
    ]
    db.add_all(objs)
    db.commit()
    publish_segments(meeting_id, [_segment_to_dict(o, speaker) for o in objs], progress=progress)
    return objs


def relabel_with_diarization(
    db: Session,
    meeting_id: str,
    wav_path: Path,
    raw_segments: List[RawSegment],
    persisted: List[TranscriptSegment],
    provisional: Speaker,
) -> bool:
    """Run diarization on the full audio and re-label already persisted rows.

    Returns True when labels changed (clients should re-fetch the transcript)."""
    from jobs.worker import publish

    diar_turns = diarize(wav_path)
    if not diar_turns:
        return False

    labelled = merge_transcript_with_diarization(raw_segments, diar_turns)
    speaker_map: Dict[str, str] = {}
    for label in {seg.speaker for seg in labelled}:
        spk = crud.get_or_create_speaker(db, meeting_id, label)
        speaker_map[label] = spk.id

    for persisted_seg, lab in zip(persisted, labelled):
        persisted_seg.speaker_id = speaker_map.get(lab.speaker, provisional.id)
    db.commit()

    # Drop the provisional speaker if diarization never used it.
    if PROVISIONAL_SPEAKER not in speaker_map:
        still_used = (
            db.query(TranscriptSegment)
            .filter(TranscriptSegment.speaker_id == provisional.id)
            .count()
        )
        if not still_used:
            db.delete(provisional)
            db.commit()

    publish(meeting_id, {"type": "transcript_ready", "status": "transcribing"})
    return True


def run_ingestion(audio_path: Path, meeting_id: str, db: Session) -> None:
    """
    Full ingestion pipeline for one meeting.

    Updates Meeting.status at each stage so the WebSocket endpoint can relay
    real-time progress to connected clients.  Leaves the meeting in the
    ``structuring`` state so the NLP stage can pick it up.
    """
    from jobs.worker import update_status  # avoid circular import

    try:
        # ── 1. Validate & extract audio ──────────────────────────────────────
        crud.update_meeting_status(db, meeting_id, "transcribing")
        update_status(meeting_id, "transcribing", "Validating audio file…", progress=0.0)

        prepared_path = validate_and_prepare(audio_path, settings.upload_dir)

        # ── 2. Convert to 16 kHz mono WAV ───────────────────────────────────
        update_status(meeting_id, "transcribing", "Converting audio…", progress=0.0)
        wav_path = to_wav_16k_mono(prepared_path, settings.upload_dir)

        # ── 3. Transcribe (streamed) ─────────────────────────────────────────
        update_status(meeting_id, "transcribing", "Loading speech model…", progress=0.0)

        provisional = crud.get_or_create_speaker(db, meeting_id, PROVISIONAL_SPEAKER)
        raw_segments: List[RawSegment] = []
        persisted: List[TranscriptSegment] = []
        buffer: List[RawSegment] = []
        last_flush = time.monotonic()
        progress_state = {"value": 0.0}

        def on_progress(fraction: float) -> None:
            progress_state["value"] = fraction

        def flush() -> None:
            nonlocal last_flush
            if not buffer:
                return
            persisted.extend(
                persist_segments(db, meeting_id, provisional, list(buffer), len(persisted), progress_state["value"])
            )
            buffer.clear()
            last_flush = time.monotonic()

        first = True
        for seg in transcribe_stream(wav_path, on_progress=on_progress):
            if first:
                update_status(meeting_id, "transcribing", "Transcribing audio…", progress=0.0)
                first = False
            raw_segments.append(seg)
            buffer.append(seg)
            if (
                len(buffer) >= max(1, settings.transcript_flush_segments)
                or time.monotonic() - last_flush >= settings.transcript_flush_seconds
            ):
                flush()
        flush()

        if not raw_segments:
            raise ValueError("Transcription returned no segments — check the audio file.")

        update_status(meeting_id, "transcribing", "Transcript complete. Identifying speakers…", progress=1.0)

        # ── 4. Diarize & re-label the persisted segments ─────────────────────
        relabel_with_diarization(db, meeting_id, wav_path, raw_segments, persisted, provisional)

        # ── 5. Hand over to NLP ──────────────────────────────────────────────
        crud.update_meeting_status(db, meeting_id, "structuring")
        update_status(meeting_id, "structuring", "Transcript saved. Analysing content…", progress=0.0)
        logger.info(
            "Ingestion pipeline complete for meeting %s (%d segments).", meeting_id, len(persisted)
        )

    except Exception as exc:
        logger.exception("Ingestion failed for meeting %s: %s", meeting_id, exc)
        db.rollback()
        crud.update_meeting_status(db, meeting_id, "error")
        update_status(meeting_id, "error", str(exc))
        raise
