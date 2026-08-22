"""
routers/context.py — FastAPI router for structured context queries & manual management.

Endpoints:
    GET    /context/{meeting_id}                      — full structured context for a meeting
    GET    /context/action-items/open                 — user-wise action items (cross-meeting)
    POST   /context/{meeting_id}/action-items         — manually add an action item to a meeting
    PATCH  /context/action-items/{item_id}            — resolve / reopen / edit an action item
    DELETE /context/action-items/{item_id}            — delete an action item
    POST   /context/{meeting_id}/decisions            — manually add a decision to a meeting
    DELETE /context/decisions/{decision_id}           — delete a decision
"""

from __future__ import annotations

from typing import List, Optional

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import or_
from sqlalchemy.orm import Session

from auth.dependencies import get_optional_user
from db import crud
from db.database import get_db
from db.models import ActionItem, ContextEntry, Decision, Meeting, Project, User
from db.schemas import (
    ActionItemBase,
    ActionItemCreate,
    ActionItemOut,
    ActionItemUpdate,
    ContextEntryOut,
    DecisionBase,
    DecisionCreate,
    DecisionOut,
)

router = APIRouter(prefix="/context", tags=["Context"])


@router.get("/action-items/open", response_model=List[ActionItemOut])
def get_open_action_items(
    db: Session = Depends(get_db),
    current_user: Optional[User] = Depends(get_optional_user),
):
    """Return action items for the authenticated user across meetings."""
    if not current_user:
        return []

    query = (
        db.query(ActionItem)
        .join(ActionItem.context_entry)
        .join(ContextEntry.meeting)
        .outerjoin(Meeting.project)
        .filter(
            or_(
                Meeting.user_id == current_user.id,
                Project.user_id == current_user.id,
            )
        )
    )
    return query.all()


@router.get("/{meeting_id}", response_model=ContextEntryOut)
def get_context(
    meeting_id: str,
    db: Session = Depends(get_db),
    current_user: Optional[User] = Depends(get_optional_user),
):
    """
    Return the full structured context for a meeting:
    topics (with recurring flag), action items, and decisions.
    """
    entry = crud.get_context_for_meeting(db, meeting_id)
    if not entry:
        raise HTTPException(
            status_code=404,
            detail="Context not yet available for this meeting. Processing may still be in progress.",
        )

    meeting = entry.meeting
    if current_user and meeting:
        if meeting.user_id and meeting.user_id != current_user.id:
            if not (meeting.project and meeting.project.user_id == current_user.id):
                raise HTTPException(status_code=403, detail="Access denied.")

    return entry


@router.post("/{meeting_id}/action-items", response_model=ActionItemOut)
def add_action_item(
    meeting_id: str,
    data: ActionItemBase,
    db: Session = Depends(get_db),
    current_user: Optional[User] = Depends(get_optional_user),
):
    """Manually create an action item for a meeting."""
    meeting = crud.get_meeting(db, meeting_id)
    if current_user and meeting and meeting.user_id and meeting.user_id != current_user.id:
        if not (meeting.project and meeting.project.user_id == current_user.id):
            raise HTTPException(status_code=403, detail="Access denied.")

    entry = crud.get_context_for_meeting(db, meeting_id)
    if not entry:
        entry = crud.create_context_entry(db, meeting_id)

    create_data = ActionItemCreate(
        context_id=entry.id,
        description=data.description,
        owner=data.owner,
        urgency=data.urgency,
        resolved=data.resolved,
    )
    return crud.create_action_item(db, create_data)


@router.patch("/action-items/{item_id}", response_model=ActionItemOut)
def patch_action_item(
    item_id: str,
    data: ActionItemUpdate,
    db: Session = Depends(get_db),
    current_user: Optional[User] = Depends(get_optional_user),
):
    """Resolve or reopen an action item, or update its owner / urgency."""
    item = crud.get_action_item(db, item_id)
    if not item:
        raise HTTPException(status_code=404, detail="Action item not found.")

    meeting = item.context_entry.meeting if item.context_entry else None
    if current_user and meeting and meeting.user_id and meeting.user_id != current_user.id:
        if not (meeting.project and meeting.project.user_id == current_user.id):
            raise HTTPException(status_code=403, detail="Access denied.")

    updated = crud.update_action_item(db, item_id, data)
    return updated


@router.delete("/action-items/{item_id}")
def delete_action_item(
    item_id: str,
    db: Session = Depends(get_db),
    current_user: Optional[User] = Depends(get_optional_user),
):
    """Delete an action item."""
    item = crud.get_action_item(db, item_id)
    if not item:
        raise HTTPException(status_code=404, detail="Action item not found.")

    meeting = item.context_entry.meeting if item.context_entry else None
    if current_user and meeting and meeting.user_id and meeting.user_id != current_user.id:
        if not (meeting.project and meeting.project.user_id == current_user.id):
            raise HTTPException(status_code=403, detail="Access denied.")

    crud.delete_action_item(db, item_id)
    return {"status": "deleted", "id": item_id}


@router.post("/{meeting_id}/decisions", response_model=DecisionOut)
def add_decision(
    meeting_id: str,
    data: DecisionBase,
    db: Session = Depends(get_db),
    current_user: Optional[User] = Depends(get_optional_user),
):
    """Manually create a decision for a meeting."""
    meeting = crud.get_meeting(db, meeting_id)
    if current_user and meeting and meeting.user_id and meeting.user_id != current_user.id:
        if not (meeting.project and meeting.project.user_id == current_user.id):
            raise HTTPException(status_code=403, detail="Access denied.")

    entry = crud.get_context_for_meeting(db, meeting_id)
    if not entry:
        entry = crud.create_context_entry(db, meeting_id)

    create_data = DecisionCreate(
        context_id=entry.id,
        description=data.description,
    )
    return crud.create_decision(db, create_data)


@router.delete("/decisions/{decision_id}")
def delete_decision(
    decision_id: str,
    db: Session = Depends(get_db),
    current_user: Optional[User] = Depends(get_optional_user),
):
    """Delete a decision."""
    decision = db.query(Decision).filter(Decision.id == decision_id).first()
    if not decision:
        raise HTTPException(status_code=404, detail="Decision not found.")

    meeting = decision.context_entry.meeting if decision.context_entry else None
    if current_user and meeting and meeting.user_id and meeting.user_id != current_user.id:
        if not (meeting.project and meeting.project.user_id == current_user.id):
            raise HTTPException(status_code=403, detail="Access denied.")

    crud.delete_decision(db, decision_id)
    return {"status": "deleted", "id": decision_id}
