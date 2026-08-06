"""
diarizer.py — Wraps pyannote.audio for speaker diarization.

Produces speaker-labelled transcript segments by merging Whisper segments
with pyannote turn boundaries using time-overlap alignment.
"""

from __future__ import annotations

import logging
from dataclasses import dataclass
from pathlib import Path
from typing import List

from config import settings

logger = logging.getLogger(__name__)


# ── Data types ────────────────────────────────────────────────────────────────

@dataclass
class SpeakerTurn:
    """A single speaker turn from the diarization pipeline."""
    speaker: str   # e.g. "SPEAKER_00"
    start: float
    end: float


@dataclass
class LabelledSegment:
    """A Whisper segment with a speaker label attached."""
    speaker: str
    text: str
    start: float
    end: float


# ── Diarizer ──────────────────────────────────────────────────────────────────

_pipeline_cache: dict = {}   # {hf_token: Pipeline}


def _get_pipeline(hf_token: str):
    """Lazy-load and cache the pyannote diarization pipeline."""
    if hf_token not in _pipeline_cache:
        try:
            from pyannote.audio import Pipeline
        except ImportError:
            raise RuntimeError(
                "pyannote.audio is not installed. Run: pip install pyannote.audio"
            )
        logger.info("Loading pyannote diarization pipeline…")
        try:
            pipeline = Pipeline.from_pretrained(
                "pyannote/speaker-diarization-3.1",
                use_auth_token=hf_token,
            )
        except Exception:
            pipeline = Pipeline.from_pretrained(
                "pyannote/speaker-diarization-3.1",
                token=hf_token,
            )
        _pipeline_cache[hf_token] = pipeline
        logger.info("Diarization pipeline ready.")
    return _pipeline_cache[hf_token]


def diarize(audio_path: Path) -> List[SpeakerTurn]:
    """
    Run pyannote speaker diarization on an audio file.
    Returns a list of SpeakerTurn objects.

    Raises RuntimeError if diarization is disabled in settings or HF token is missing.
    """
    if not settings.diarization_enabled:
        logger.warning("Diarization is disabled (DIARIZATION_ENABLED=false). Skipping.")
        return []

    if not settings.hf_token:
        logger.warning(
            "HF_TOKEN is not set — cannot load pyannote model. "
            "Falling back to no diarization."
        )
        return []

    try:
        pipeline = _get_pipeline(settings.hf_token)
        logger.info("Running diarization on %s…", audio_path)
        diarization = pipeline(str(audio_path))
        turns: List[SpeakerTurn] = []
        for segment, _, speaker in diarization.itertracks(yield_label=True):
            turns.append(SpeakerTurn(speaker=speaker, start=segment.start, end=segment.end))
        logger.info("Diarization found %d speaker turns.", len(turns))
        return turns
    except Exception as exc:
        logger.warning(
            "Diarization failed (%s). Falling back to transcript without diarization.",
            exc,
        )
        return []


def _overlap(a_start: float, a_end: float, b_start: float, b_end: float) -> float:
    """Return the duration of overlap between two time intervals."""
    return max(0.0, min(a_end, b_end) - max(a_start, b_start))


def merge_transcript_with_diarization(
    whisper_segments,    # List[RawSegment] from transcriber
    diarization_turns: List[SpeakerTurn],
) -> List[LabelledSegment]:
    """
    Assign each Whisper segment a speaker label by finding the diarization
    turn with maximum overlap. Falls back to "SPEAKER_00" if no turns match.
    """
    labelled: List[LabelledSegment] = []

    for seg in whisper_segments:
        best_speaker = "SPEAKER_00"
        best_overlap = 0.0

        for turn in diarization_turns:
            ov = _overlap(seg.start, seg.end, turn.start, turn.end)
            if ov > best_overlap:
                best_overlap = ov
                best_speaker = turn.speaker

        labelled.append(
            LabelledSegment(
                speaker=best_speaker,
                text=seg.text,
                start=seg.start,
                end=seg.end,
            )
        )

    return labelled
