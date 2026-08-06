"""
routers/meetings.py — FastAPI router for meeting upload and retrieval.

Endpoints:
    POST /meetings/upload          — upload audio, start processing
    GET  /meetings/                — list all meetings
    GET  /meetings/{meeting_id}    — meeting detail + speakers
    GET  /meetings/{meeting_id}/transcript — full speaker-labelled transcript
"""

from __future__ import annotations

import shutil
from pathlib import Path
from typing import List

from fastapi import APIRouter, BackgroundTasks, Depends, File, Form, HTTPException, UploadFile
from sqlalchemy.orm import Session

from config import settings
from db import crud
from db.database import get_db
from db.schemas import MeetingCreate, MeetingDetail, MeetingOut, SegmentOut
from ingestion.pipeline import run_ingestion
from nlp.pipeline import run_nlp

router = APIRouter(prefix="/meetings", tags=["Meetings"])


# ── Helpers ───────────────────────────────────────────────────────────────────

def _process_meeting(audio_path: Path, meeting_id: str) -> None:
    """Background task: run ingestion then NLP pipeline in a background thread pool."""
    from db.database import SessionLocal

    bg_db = SessionLocal()
    try:
        run_ingestion(audio_path, meeting_id, bg_db)
        run_nlp(meeting_id, bg_db)
    finally:
        bg_db.close()


# ── Endpoints ─────────────────────────────────────────────────────────────────

@router.post("/upload", response_model=MeetingOut, status_code=202)
async def upload_meeting(
    background_tasks: BackgroundTasks,
    file: UploadFile = File(...),
    title: str = Form(...),
    db: Session = Depends(get_db),
):
    """
    Accept a multipart audio/video file, create a Meeting record, and kick
    off the full processing pipeline (ingestion → NLP) as a background task.

    Returns the new meeting record immediately with status='queued'.
    """
    # Create DB record first so we have an ID
    meeting = crud.create_meeting(db, MeetingCreate(title=title))
    meeting_id = meeting.id

    # Save uploaded file to uploads/
    suffix = Path(file.filename or "upload").suffix
    dest_path = settings.upload_dir / f"{meeting_id}{suffix}"
    try:
        with open(dest_path, "wb") as buffer:
            shutil.copyfileobj(file.file, buffer)
    finally:
        await file.close()

    # Persist audio path
    crud.update_meeting_audio_path(db, meeting_id, str(dest_path))
    crud.update_meeting_status(db, meeting_id, "queued")

    # Queue background processing
    background_tasks.add_task(_process_meeting, dest_path, meeting_id)

    # Refresh to get updated fields
    db.refresh(meeting)
    return meeting


@router.get("/", response_model=List[MeetingOut])
def list_meetings(skip: int = 0, limit: int = 50, db: Session = Depends(get_db)):
    """Return all meetings ordered by date descending."""
    return crud.list_meetings(db, skip=skip, limit=limit)


@router.get("/{meeting_id}", response_model=MeetingDetail)
def get_meeting(meeting_id: str, db: Session = Depends(get_db)):
    """Return full meeting detail including speakers."""
    meeting = crud.get_meeting(db, meeting_id)
    if not meeting:
        raise HTTPException(status_code=404, detail="Meeting not found.")
    return meeting


@router.get("/{meeting_id}/transcript", response_model=List[SegmentOut])
def get_transcript(meeting_id: str, db: Session = Depends(get_db)):
    """Return the full speaker-labelled transcript for a meeting."""
    meeting = crud.get_meeting(db, meeting_id)
    if not meeting:
        raise HTTPException(status_code=404, detail="Meeting not found.")
    segments = crud.get_segments_for_meeting(db, meeting_id)
    return segments
