"""
routers/meetings.py — FastAPI router for meeting upload, retrieval, and transcript revision history.
"""

from __future__ import annotations

import logging
import shutil
import uuid
from datetime import datetime
from pathlib import Path
from typing import List, Optional

from fastapi import APIRouter, BackgroundTasks, Depends, File, Form, HTTPException, UploadFile, status
from pydantic import BaseModel
from sqlalchemy.orm import Session

from auth.dependencies import get_optional_user
from config import settings
from db import crud
from db.database import get_db, SessionLocal
from db.models import Meeting, Project, TranscriptSegment, TranscriptEditHistory, User
from db.schemas import MeetingCreate, MeetingDetail, MeetingOut, SegmentOut
from ingestion.pipeline import run_ingestion
from nlp.pipeline import run_nlp
from nlp.project_synthesizer import synthesize_project_context

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/meetings", tags=["Meetings"])


# ── Schemas ───────────────────────────────────────────────────────────────────

class SegmentEditRequest(BaseModel):
    new_text: str


class TranscriptHistoryOut(BaseModel):
    id: str
    meeting_id: str
    segment_id: str
    speaker_name: Optional[str] = None
    old_text: str
    new_text: str
    edited_by: Optional[str] = None
    edited_at: datetime


# ── Helpers ───────────────────────────────────────────────────────────────────

def _process_meeting(audio_path: Path, meeting_id: str) -> None:
    """Background task: run ingestion then NLP pipeline in a background thread pool."""
    bg_db = SessionLocal()
    try:
        run_ingestion(audio_path, meeting_id, bg_db)
        run_nlp(meeting_id, bg_db)

        # If meeting belongs to a project, re-synthesize project context
        meeting = bg_db.query(Meeting).filter(Meeting.id == meeting_id).first()
        if meeting and meeting.project_id:
            try:
                synthesize_project_context(meeting.project_id, bg_db)
            except Exception as exc:
                logger.error("Error synthesizing project after meeting %s: %s", meeting_id, exc)

    finally:
        bg_db.close()


# ── Endpoints ─────────────────────────────────────────────────────────────────

@router.post("/upload", response_model=MeetingOut, status_code=202)
async def upload_meeting(
    background_tasks: BackgroundTasks,
    file: UploadFile = File(...),
    title: str = Form(...),
    summary_type: Optional[str] = Form("balanced"),
    project_id: Optional[str] = Form(None),
    new_project_name: Optional[str] = Form(None),
    new_project_company: Optional[str] = Form(None),
    new_project_category: Optional[str] = Form(None),
    db: Session = Depends(get_db),
    current_user: Optional[User] = Depends(get_optional_user),
):
    """
    Accept a multipart audio/video file, create a Meeting record, optionally link
    to an existing or new Project workspace, set summary depth, and kick off background ingestion.
    """
    assigned_project_id = project_id

    # Handle creating a new project on the fly
    if not assigned_project_id and new_project_name:
        new_proj = Project(
            id=str(uuid.uuid4()),
            user_id=current_user.id if current_user else None,
            name=new_project_name,
            company=new_project_company,
            category=new_project_category or "General",
        )
        db.add(new_proj)
        db.commit()
        db.refresh(new_proj)
        assigned_project_id = new_proj.id
        synthesize_project_context(new_proj.id, db)

    # Create DB record for meeting
    meeting = Meeting(
        id=str(uuid.uuid4()),
        title=title,
        status="queued",
        summary_type=summary_type or "balanced",
        project_id=assigned_project_id,
        user_id=current_user.id if current_user else None,
    )
    db.add(meeting)
    db.commit()
    db.refresh(meeting)

    # Save uploaded file
    suffix = Path(file.filename or "upload").suffix or ".mp3"
    dest_path = settings.upload_dir / f"{meeting.id}{suffix}"
    try:
        with open(dest_path, "wb") as buffer:
            shutil.copyfileobj(file.file, buffer)
    finally:
        await file.close()

    # Persist audio path
    meeting.audio_path = str(dest_path)
    db.commit()

    # Queue background processing
    background_tasks.add_task(_process_meeting, dest_path, meeting.id)

    db.refresh(meeting)
    return meeting


@router.get("/", response_model=List[MeetingOut])
def list_meetings(
    skip: int = 0,
    limit: int = 50,
    db: Session = Depends(get_db),
    current_user: Optional[User] = Depends(get_optional_user),
):
    """Return all meetings ordered by date descending."""
    query = db.query(Meeting)
    if current_user:
        query = query.filter(Meeting.user_id == current_user.id)
    return query.order_by(Meeting.date.desc()).offset(skip).limit(limit).all()


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


@router.patch("/{meeting_id}/transcript/{segment_id}", response_model=SegmentOut)
def edit_transcript_segment(
    meeting_id: str,
    segment_id: str,
    data: SegmentEditRequest,
    db: Session = Depends(get_db),
    current_user: Optional[User] = Depends(get_optional_user),
):
    """Edit a transcript segment text and record the change in edit history."""
    segment = db.query(TranscriptSegment).filter(
        TranscriptSegment.id == segment_id,
        TranscriptSegment.meeting_id == meeting_id
    ).first()
    
    if not segment:
        raise HTTPException(status_code=404, detail="Transcript segment not found.")

    old_text = segment.text
    new_text = data.new_text.strip()

    if old_text == new_text:
        return segment

    # Create history log
    speaker_name = segment.speaker.name or segment.speaker.label if segment.speaker else "Unknown Speaker"
    editor_name = current_user.name if current_user else "User"

    history = TranscriptEditHistory(
        id=str(uuid.uuid4()),
        meeting_id=meeting_id,
        segment_id=segment_id,
        speaker_name=speaker_name,
        old_text=old_text,
        new_text=new_text,
        edited_by=editor_name,
        edited_at=datetime.utcnow(),
    )
    db.add(history)

    # Update segment text
    segment.text = new_text
    db.commit()
    db.refresh(segment)
    return segment


@router.get("/{meeting_id}/transcript/history", response_model=List[TranscriptHistoryOut])
def get_transcript_history(meeting_id: str, db: Session = Depends(get_db)):
    """Get the full edit history/audit log for transcript segments of a meeting."""
    history = db.query(TranscriptEditHistory).filter(
        TranscriptEditHistory.meeting_id == meeting_id
    ).order_by(TranscriptEditHistory.edited_at.desc()).all()
    return history
