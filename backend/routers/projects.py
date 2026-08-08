"""
routers/projects.py — Projects API router for multi-meeting context management.
"""

from __future__ import annotations

import json
import logging
import os
import shutil
import uuid
from datetime import datetime
from typing import List, Optional

from fastapi import APIRouter, BackgroundTasks, Depends, File, Form, HTTPException, UploadFile, status
from pydantic import BaseModel
from sqlalchemy.orm import Session

from pathlib import Path

from auth.dependencies import get_current_user, get_optional_user
from config import settings
from db.database import get_db, SessionLocal
from db.models import Meeting, Project, ProjectSummary, User
from nlp.project_synthesizer import synthesize_project_context
from routers.meetings import _process_meeting

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/projects", tags=["Projects"])


# ── Schemas ───────────────────────────────────────────────────────────────────

class ProjectCreate(BaseModel):
    name: str
    company: Optional[str] = None
    category: Optional[str] = None  # e.g., Engineering, Sales, Viva, Architecture
    description: Optional[str] = None


class ProjectResponse(BaseModel):
    id: str
    name: str
    company: Optional[str] = None
    category: Optional[str] = None
    description: Optional[str] = None
    created_at: datetime
    updated_at: datetime
    meeting_count: int = 0
    total_duration_minutes: float = 0.0
    overall_summary: Optional[str] = None


# ── Background Task Wrapper ───────────────────────────────────────────────────

def _process_project_audio_background(meeting_id: str, project_id: str, file_path: str):
    """
    Background worker:
    1. Runs full audio processing pipeline (whisper transcript -> structuring -> LSH indexing).
    2. Runs multi-meeting project synthesis.
    """
    logger.info("Starting background processing for meeting %s in project %s", meeting_id, project_id)
    _process_meeting(Path(file_path), meeting_id)

    # Synthesize project
    db = SessionLocal()
    try:
        synthesize_project_context(project_id, db)
        logger.info("Project synthesis completed for project %s", project_id)
    except Exception as exc:
        logger.error("Error synthesizing project %s: %s", project_id, exc)
    finally:
        db.close()


# ── Endpoints ─────────────────────────────────────────────────────────────────

@router.post("", response_model=ProjectResponse, status_code=status.HTTP_201_CREATED)
def create_project(
    data: ProjectCreate,
    db: Session = Depends(get_db),
    current_user: Optional[User] = Depends(get_optional_user),
):
    """Create a new Project context workspace."""
    project = Project(
        id=str(uuid.uuid4()),
        user_id=current_user.id if current_user else None,
        name=data.name,
        company=data.company,
        category=data.category,
        description=data.description,
    )
    db.add(project)
    db.commit()
    db.refresh(project)

    # Create empty summary
    ps = synthesize_project_context(project.id, db)

    return ProjectResponse(
        id=project.id,
        name=project.name,
        company=project.company,
        category=project.category,
        description=project.description,
        created_at=project.created_at,
        updated_at=project.updated_at,
        meeting_count=0,
        total_duration_minutes=0.0,
        overall_summary=ps.overall_summary,
    )


@router.get("", response_model=List[ProjectResponse])
def list_projects(
    db: Session = Depends(get_db),
    current_user: Optional[User] = Depends(get_optional_user),
):
    """List all projects for the authenticated user (or all if unauthenticated in dev mode)."""
    query = db.query(Project)
    if current_user:
        query = query.filter(Project.user_id == current_user.id)
    
    projects = query.order_by(Project.updated_at.desc()).all()

    result = []
    for p in projects:
        m_count = len(p.meetings)
        summary_text = p.summary.overall_summary if p.summary else "No summary available."
        duration_mins = round((p.summary.total_duration_seconds if p.summary else 0.0) / 60.0, 1)

        result.append(
            ProjectResponse(
                id=p.id,
                name=p.name,
                company=p.company,
                category=p.category,
                description=p.description,
                created_at=p.created_at,
                updated_at=p.updated_at,
                meeting_count=m_count,
                total_duration_minutes=duration_mins,
                overall_summary=summary_text,
            )
        )
    return result


@router.get("/{project_id}")
def get_project_detail(
    project_id: str,
    db: Session = Depends(get_db),
):
    """Get full project details, associated meetings, and cumulative context summary."""
    project = db.query(Project).filter(Project.id == project_id).first()
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")

    # Refresh synthesis if needed
    ps = project.summary
    if not ps:
        ps = synthesize_project_context(project.id, db)

    # Format meetings
    meetings_list = []
    for m in sorted(project.meetings, key=lambda x: x.date or datetime.min, reverse=True):
        duration = 0.0
        if m.segments:
            duration = round(max(s.end_time for s in m.segments) - min(s.start_time for s in m.segments), 1)

        meetings_list.append({
            "id": m.id,
            "title": m.title,
            "date": m.date.isoformat() if m.date else None,
            "status": m.status,
            "duration_seconds": duration,
            "topics_count": len(m.context_entry.topics) if m.context_entry else 0,
            "action_items_count": len(m.context_entry.action_items) if m.context_entry else 0,
        })

    # Parse JSON fields safely
    key_highlights = json.loads(ps.key_highlights) if ps.key_highlights else []
    consolidated_actions = json.loads(ps.consolidated_action_items) if ps.consolidated_action_items else []
    recurring_themes = json.loads(ps.recurring_themes) if ps.recurring_themes else []

    return {
        "id": project.id,
        "name": project.name,
        "company": project.company,
        "category": project.category,
        "description": project.description,
        "created_at": project.created_at.isoformat(),
        "updated_at": project.updated_at.isoformat(),
        "summary": {
            "overall_summary": ps.overall_summary,
            "key_highlights": key_highlights,
            "consolidated_action_items": consolidated_actions,
            "recurring_themes": recurring_themes,
            "meeting_count": ps.meeting_count,
            "total_duration_minutes": round(ps.total_duration_seconds / 60.0, 1),
            "last_updated": ps.last_updated.isoformat(),
        },
        "meetings": meetings_list,
    }


@router.post("/{project_id}/meetings/upload", status_code=status.HTTP_202_ACCEPTED)
def upload_project_meeting(
    project_id: str,
    background_tasks: BackgroundTasks,
    file: UploadFile = File(...),
    title: Optional[str] = Form(None),
    db: Session = Depends(get_db),
    current_user: Optional[User] = Depends(get_optional_user),
):
    """
    Upload a meeting audio file directly into a Project.
    Runs asynchronously in the background so the user can navigate freely!
    """
    project = db.query(Project).filter(Project.id == project_id).first()
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")

    meeting_title = title or file.filename or f"Meeting {datetime.utcnow().strftime('%Y-%m-%d %H:%M')}"

    # Save audio file
    upload_dir = settings.upload_dir
    os.makedirs(upload_dir, exist_ok=True)
    meeting_id = str(uuid.uuid4())
    ext = os.path.splitext(file.filename or "")[1] or ".mp3"
    dest_filename = f"{meeting_id}{ext}"
    dest_path = os.path.abspath(os.path.join(upload_dir, dest_filename))

    with open(dest_path, "wb") as buffer:
        shutil.copyfileobj(file.file, buffer)

    # Create meeting record linked to project
    meeting = Meeting(
        id=meeting_id,
        title=meeting_title,
        status="queued",
        audio_path=dest_path,
        project_id=project_id,
        user_id=current_user.id if current_user else None,
    )
    db.add(meeting)
    
    # Touch project updated_at
    project.updated_at = datetime.utcnow()
    db.commit()

    # Enqueue background task
    background_tasks.add_task(_process_project_audio_background, meeting_id, project_id, dest_path)

    return {
        "message": "Audio upload received. Ingestion running in background.",
        "meeting_id": meeting_id,
        "project_id": project_id,
        "status": "queued",
    }


@router.post("/{project_id}/synthesize")
def retrigger_project_synthesis(
    project_id: str,
    db: Session = Depends(get_db),
):
    """Manually re-trigger context synthesis for a project."""
    ps = synthesize_project_context(project_id, db)
    return {"message": "Project context re-synthesized successfully.", "last_updated": ps.last_updated.isoformat()}


@router.delete("/{project_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_project(
    project_id: str,
    db: Session = Depends(get_db),
):
    """Delete a project and its associated meetings."""
    project = db.query(Project).filter(Project.id == project_id).first()
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")

    db.delete(project)
    db.commit()
    return None
