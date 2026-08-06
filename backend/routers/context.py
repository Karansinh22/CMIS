"""
routers/context.py — FastAPI router for structured context queries.

Endpoints:
    GET   /context/{meeting_id}            — full structured context for a meeting
    GET   /context/action-items/open       — all unresolved action items (cross-meeting)
    PATCH /context/action-items/{item_id}  — resolve / reopen an action item
"""

from __future__ import annotations

from typing import List

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from db import crud
from db.database import get_db
from db.schemas import ActionItemOut, ActionItemUpdate, ContextEntryOut

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
