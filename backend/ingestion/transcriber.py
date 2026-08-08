"""
transcriber.py — Wraps faster-whisper for speech-to-text transcription.

Returns word-level (or segment-level) transcript with timestamps.
"""

from __future__ import annotations

import logging
from pathlib import Path
from typing import List

from config import settings

logger = logging.getLogger(__name__)


# ── Data types ────────────────────────────────────────────────────────────────

class RawSegment:
    """A single spoken segment from the Whisper output."""

    def __init__(self, text: str, start: float, end: float):
        self.text = text.strip()
        self.start = start
        self.end = end

    def __repr__(self) -> str:
        return f"RawSegment(start={self.start:.2f}, end={self.end:.2f}, text={self.text!r})"


# ── Transcriber ───────────────────────────────────────────────────────────────

_model_cache: dict = {}   # {model_name: WhisperModel} — loaded once per process


def _get_model(model_name: str):
    """Lazy-load and cache the Whisper model."""
    if model_name not in _model_cache:
        try:
            from faster_whisper import WhisperModel
        except ImportError:
            raise RuntimeError(
                "faster-whisper is not installed. Run: pip install faster-whisper"
            )

        logger.info("Loading Whisper model '%s' (first run may download weights)…", model_name)
        # device="cpu" works on any laptop; use device="cuda" if a GPU is present
        _model_cache[model_name] = WhisperModel(model_name, device="cpu", compute_type="int8")
        logger.info("Whisper model '%s' ready.", model_name)

    return _model_cache[model_name]


def _get_audio_duration(audio_path: Path) -> float:
    """Return total duration in seconds using python wave module."""
    try:
        import wave
        with wave.open(str(audio_path), "rb") as wf:
            return wf.getnframes() / float(wf.getframerate())
    except Exception:
        return 0.0


def transcribe(audio_path: Path, model_name: str | None = None) -> List[RawSegment]:
    """
    Transcribe an audio file using faster-whisper.
    Automatically chunks audio files longer than 3 minutes to prevent memory allocation errors.

    Args:
        audio_path: Path to a 16 kHz mono WAV.
        model_name: Override the model from settings.

    Returns:
        List of RawSegment objects sorted by start time.
    """
    from utils.audio import ensure_ffmpeg
    ensure_ffmpeg()

    model_name = model_name or settings.whisper_model
    model = _get_model(model_name)

    duration = _get_audio_duration(audio_path)
    chunk_size = 180  # 3 minutes

    if duration > chunk_size:
        logger.info("Long audio detected (%.1fs). Transcribing in 3-minute chunks…", duration)
        raw_segments: List[RawSegment] = []

        import subprocess
        for start_sec in range(0, int(duration), chunk_size):
            chunk_file = audio_path.parent / f"{audio_path.stem}_chk_{start_sec}.wav"
            cmd = [
                "ffmpeg", "-y", "-ss", str(start_sec), "-t", str(chunk_size),
                "-i", str(audio_path), "-c", "copy", str(chunk_file)
            ]
            try:
                subprocess.run(cmd, capture_output=True, check=True)
                segments_iter, _ = model.transcribe(
                    str(chunk_file),
                    beam_size=3,
                    language="en",
                    vad_filter=True,
                )
                for seg in segments_iter:
                    if seg.text.strip():
                        raw_segments.append(
                            RawSegment(seg.text, seg.start + start_sec, seg.end + start_sec)
                        )
            except Exception as exc:
                logger.warning("Error processing chunk starting at %ds: %s", start_sec, exc)
            finally:
                chunk_file.unlink(missing_ok=True)

        logger.info("Chunked transcription complete: %d segments.", len(raw_segments))
        return raw_segments

    logger.info("Transcribing %s with model '%s'…", audio_path, model_name)
    segments_iter, info = model.transcribe(
        str(audio_path),
        beam_size=3,
        language="en",   # auto-detect can be slow; set None to enable auto-detection
        vad_filter=True, # Voice Activity Detection filter — reduces hallucinations
    )

    raw_segments: List[RawSegment] = []
    for seg in segments_iter:
        if seg.text.strip():
            raw_segments.append(RawSegment(seg.text, seg.start, seg.end))

    logger.info(
        "Transcription complete: %d segments, detected language '%s' (prob=%.2f)",
        len(raw_segments),
        info.language,
        info.language_probability,
    )
    return raw_segments
