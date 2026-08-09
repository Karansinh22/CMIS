"""
routers/context.py — FastAPI router for structured context queries & manual management.

Endpoints:
    GET    /context/{meeting_id}                      — full structured context for a meeting
    GET    /context/action-items/open                 — all unresolved action items (cross-meeting)
    POST   /context/{meeting_id}/action-items         — manually add an action item to a meeting
    PATCH  /context/action-items/{item_id}            — resolve / reopen / edit an action item
    DELETE /context/action-items/{item_id}            — delete an action item
    POST   /context/{meeting_id}/decisions            — manually add a decision to a meeting
    DELETE /context/decisions/{decision_id}           — delete a decision
"""

from __future__ import annotations

from typing import List

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from db import crud
from db.database import get_db
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


@router.get("/{meeting_id}", response_model=ContextEntryOut)
def get_context(meeting_id: str, db: Session = Depends(get_db)):
    """
    Return the full structured context for a meeting:
    topics (with recurring flag), action items, and decisions.
    """
    entry = crud.get_context_for_meeting(db, meeting_id)
    if not entry:
        raise HTTPException(
            status_code=404,
            detail="Context not yet available for this meeting. "
                   "Processing may still be in progress.",
        )
    return entry


@router.get("/action-items/open", response_model=List[ActionItemOut])
def get_open_action_items(db: Session = Depends(get_db)):
    """Return all unresolved action items across all meetings."""
    return crud.get_all_open_action_items(db)


@router.post("/{meeting_id}/action-items", response_model=ActionItemOut)
def add_action_item(
    meeting_id: str,
    data: ActionItemBase,
    db: Session = Depends(get_db),
):
    """Manually create an action item for a meeting."""
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
):
    """Resolve or reopen an action item, or update its owner / urgency."""
    updated = crud.update_action_item(db, item_id, data)
    if not updated:
        raise HTTPException(status_code=404, detail="Action item not found.")
    return updated


@router.delete("/action-items/{item_id}")
def delete_action_item(item_id: str, db: Session = Depends(get_db)):
    """Delete an action item."""
    success = crud.delete_action_item(db, item_id)
    if not success:
        raise HTTPException(status_code=404, detail="Action item not found.")
    return {"status": "deleted", "id": item_id}


@router.post("/{meeting_id}/decisions", response_model=DecisionOut)
def add_decision(
    meeting_id: str,
    data: DecisionBase,
    db: Session = Depends(get_db),
):
    """Manually create a decision for a meeting."""
    entry = crud.get_context_for_meeting(db, meeting_id)
    if not entry:
        entry = crud.create_context_entry(db, meeting_id)

    create_data = DecisionCreate(
        context_id=entry.id,
        description=data.description,
    )
    return crud.create_decision(db, create_data)


@router.delete("/decisions/{decision_id}")
def delete_decision(decision_id: str, db: Session = Depends(get_db)):
    """Delete a decision."""
    success = crud.delete_decision(db, decision_id)
    if not success:
        raise HTTPException(status_code=404, detail="Decision not found.")
    return {"status": "deleted", "id": decision_id}
