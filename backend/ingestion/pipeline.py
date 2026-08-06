"""
ingestion/pipeline.py — Orchestrates audio ingestion end-to-end.

run_ingestion(audio_path, meeting_id, db) sequence:
    validate → convert to WAV → transcribe → diarize → merge → persist
"""

from __future__ import annotations

import logging
from pathlib import Path

from sqlalchemy.orm import Session

from config import settings
from db import crud
from db.schemas import SegmentCreate
from ingestion.diarizer import diarize, merge_transcript_with_diarization
from ingestion.transcriber import transcribe
from ingestion.validator import validate_and_prepare
from utils.audio import to_wav_16k_mono

logger = logging.getLogger(__name__)


def run_ingestion(audio_path: Path, meeting_id: str, db: Session) -> None:
    """
    Full ingestion pipeline for one meeting.

    Updates Meeting.status at each stage so the WebSocket endpoint can relay
    real-time progress to connected clients.

    Args:
        audio_path: Path to the uploaded file (any supported format).
        meeting_id: UUID of the Meeting row already in the DB.
        db:         Active SQLAlchemy session.
    """
    from jobs.worker import update_status  # avoid circular at module level

    try:
        # ── 1. Validate & extract audio ──────────────────────────────────────
        crud.update_meeting_status(db, meeting_id, "transcribing")
        update_status(meeting_id, "transcribing", "Validating audio file…")

        prepared_path = validate_and_prepare(audio_path, settings.upload_dir)

        # ── 2. Convert to 16 kHz mono WAV ───────────────────────────────────
        wav_path = to_wav_16k_mono(prepared_path, settings.upload_dir)

        # ── 3. Transcribe ────────────────────────────────────────────────────
        update_status(meeting_id, "transcribing", "Transcribing audio…")
        raw_segments = transcribe(wav_path)

        if not raw_segments:
            raise ValueError("Transcription returned no segments — check the audio file.")

        # ── 4. Diarize ───────────────────────────────────────────────────────
        update_status(meeting_id, "transcribing", "Running speaker diarization…")
        diar_turns = diarize(wav_path)

        labelled = merge_transcript_with_diarization(raw_segments, diar_turns)

        # ── 5. Persist speakers ──────────────────────────────────────────────
        update_status(meeting_id, "structuring", "Saving transcript to database…")
        unique_speaker_labels = {seg.speaker for seg in labelled}
        speaker_map: dict[str, str] = {}  # label → speaker.id

        for label in unique_speaker_labels:
            spk = crud.get_or_create_speaker(db, meeting_id, label)
            speaker_map[label] = spk.id

        # ── 6. Persist transcript segments ───────────────────────────────────
        segment_creates = [
            SegmentCreate(
                meeting_id=meeting_id,
                speaker_id=speaker_map.get(seg.speaker),
                text=seg.text,
                start_time=seg.start,
                end_time=seg.end,
                segment_index=idx,
            )
            for idx, seg in enumerate(labelled)
        ]
        crud.bulk_create_segments(db, segment_creates)

        # ── 7. Mark done ─────────────────────────────────────────────────────
        crud.update_meeting_status(db, meeting_id, "done")
        update_status(meeting_id, "done", "Ingestion complete.")
        logger.info("Ingestion pipeline complete for meeting %s.", meeting_id)

    except Exception as exc:
        logger.exception("Ingestion failed for meeting %s: %s", meeting_id, exc)
        crud.update_meeting_status(db, meeting_id, "error")
        update_status(meeting_id, "error", str(exc))
        raise
