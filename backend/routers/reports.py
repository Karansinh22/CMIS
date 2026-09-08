"""
routers/reports.py — Phase 6: generate and download documents from the context store.

    POST   /meetings/{meeting_id}/reports?format=docx|pptx|md   generate a report
    GET    /meetings/{meeting_id}/reports                       list generated reports
    GET    /reports/{report_id}/download                        download the file
    DELETE /reports/{report_id}                                 delete a report
    POST   /projects/{project_id}/reports                       project-level .docx
"""

from __future__ import annotations

import logging
from pathlib import Path
from typing import List, Optional

from fastapi import APIRouter, Depends, HTTPException, Query
from fastapi.responses import FileResponse
from sqlalchemy.orm import Session

from auth.dependencies import get_optional_user
from config import settings
from db import crud
from db.database import get_db
from db.models import Meeting, Project, Report, User
from db.schemas import ReportOut
from reports.generator import FORMATS, generate_meeting_report, render_project_docx

logger = logging.getLogger(__name__)
router = APIRouter(tags=["Reports"])

_MEDIA_TYPES = {
    "docx": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    "pptx": "application/vnd.openxmlformats-officedocument.presentationml.presentation",
    "md": "text/markdown",
}


def _check_meeting_access(meeting: Meeting, user: Optional[User]) -> None:
    if user and meeting.user_id and meeting.user_id != user.id:
        if not (meeting.project and meeting.project.user_id == user.id):
            raise HTTPException(status_code=403, detail="Access denied.")


@router.post("/meetings/{meeting_id}/reports", response_model=ReportOut, status_code=201)
def generate_report(
    meeting_id: str,
    format: str = Query("docx", pattern="^(docx|pptx|md)$"),
    include_transcript: bool = Query(True, description="Append the full transcript (docx/md)"),
    db: Session = Depends(get_db),
    current_user: Optional[User] = Depends(get_optional_user),
):
    """Generate a Minutes-of-Meeting document, slide deck or Markdown file."""
    meeting = crud.get_meeting(db, meeting_id)
    if not meeting:
        raise HTTPException(status_code=404, detail="Meeting not found.")
    _check_meeting_access(meeting, current_user)
    if meeting.status != "done":
        raise HTTPException(status_code=409, detail="The meeting is still being processed.")

    out_dir = settings.reports_dir / meeting_id
    try:
        path = generate_meeting_report(db, meeting, format, out_dir, include_transcript=include_transcript)
    except ImportError as exc:
        raise HTTPException(status_code=500, detail=f"Missing dependency for '{format}': {exc}") from exc
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc

    return crud.create_report(db, meeting_id, format, str(path))


@router.get("/meetings/{meeting_id}/reports", response_model=List[ReportOut])
def list_reports(
    meeting_id: str,
    db: Session = Depends(get_db),
    current_user: Optional[User] = Depends(get_optional_user),
):
    meeting = crud.get_meeting(db, meeting_id)
    if not meeting:
        raise HTTPException(status_code=404, detail="Meeting not found.")
    _check_meeting_access(meeting, current_user)
    reports = crud.list_reports_for_meeting(db, meeting_id)
    return sorted(reports, key=lambda r: r.generated_on, reverse=True)


@router.get("/reports/{report_id}/download")
def download_report(
    report_id: str,
    db: Session = Depends(get_db),
    current_user: Optional[User] = Depends(get_optional_user),
):
    report = db.query(Report).filter(Report.id == report_id).first()
    if not report:
        raise HTTPException(status_code=404, detail="Report not found.")
    _check_meeting_access(report.meeting, current_user)
    path = Path(report.file_path or "")
    if not path.exists():
        raise HTTPException(status_code=410, detail="The report file no longer exists. Generate it again.")
    return FileResponse(
        str(path),
        media_type=_MEDIA_TYPES.get(report.format, "application/octet-stream"),
        filename=path.name,
    )


@router.delete("/reports/{report_id}", status_code=200)
def delete_report(
    report_id: str,
    db: Session = Depends(get_db),
    current_user: Optional[User] = Depends(get_optional_user),
):
    report = db.query(Report).filter(Report.id == report_id).first()
    if not report:
        raise HTTPException(status_code=404, detail="Report not found.")
    _check_meeting_access(report.meeting, current_user)
    try:
        if report.file_path and Path(report.file_path).exists():
            Path(report.file_path).unlink()
    except OSError as exc:
        logger.warning("Could not delete report file %s: %s", report.file_path, exc)
    db.delete(report)
    db.commit()
    return {"status": "deleted", "id": report_id}


@router.post("/projects/{project_id}/reports")
def generate_project_report(
    project_id: str,
    db: Session = Depends(get_db),
    current_user: Optional[User] = Depends(get_optional_user),
):
    """Generate a project-wide Word report (summary, open actions, decisions by meeting)."""
    project = db.query(Project).filter(Project.id == project_id).first()
    if not project:
        raise HTTPException(status_code=404, detail="Project not found.")
    if current_user and project.user_id and project.user_id != current_user.id:
        raise HTTPException(status_code=403, detail="Access denied.")

    from datetime import datetime
    from reports.generator import _safe_name

    out_dir = settings.reports_dir / f"project_{project_id}"
    path = out_dir / f"{_safe_name(project.name)}_{datetime.utcnow().strftime('%Y%m%d-%H%M%S')}_report.docx"
    render_project_docx(db, project, path)
    return FileResponse(str(path), media_type=_MEDIA_TYPES["docx"], filename=path.name)
