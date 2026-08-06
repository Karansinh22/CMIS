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


def transcribe(audio_path: Path, model_name: str | None = None) -> List[RawSegment]:
    """
    Transcribe an audio file using faster-whisper.

    Args:
        audio_path: Path to a 16 kHz mono WAV (or any ffmpeg-decodable format).
        model_name: Override the model from settings (useful in tests).

    Returns:
        List of RawSegment objects sorted by start time.
    """
    model_name = model_name or settings.whisper_model
    model = _get_model(model_name)

    logger.info("Transcribing %s with model '%s'…", audio_path, model_name)

    segments_iter, info = model.transcribe(
        str(audio_path),
        beam_size=5,
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
