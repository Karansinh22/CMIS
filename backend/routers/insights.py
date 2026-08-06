"""
routers/insights.py — FastAPI router for cross-meeting analytical insights.

Endpoints:
    GET /insights/recurring-topics        — all recurring topics with history
    GET /insights/action-items/overdue    — placeholder for overdue detection
"""

from __future__ import annotations

from typing import List

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from db import crud
from db.database import get_db
from db.schemas import TopicOut

router = APIRouter(prefix="/insights", tags=["Insights"])


@router.get("/recurring-topics", response_model=List[TopicOut])
def get_recurring_topics(db: Session = Depends(get_db)):
    """
    Return all topics that have been flagged as recurring across meetings.
    Each topic includes a `previous_topic_id` linking to the earlier occurrence.
    """
    return crud.get_recurring_topics(db)


@router.get("/action-items/overdue")
def get_overdue_action_items(db: Session = Depends(get_db)):
    """
    Placeholder endpoint for overdue action item detection.
    Currently returns all open items (due-date field is a Phase 5 feature).
    """
    open_items = crud.get_all_open_action_items(db)
    # TODO (Phase 5): filter by due_date < today when due_date column is added
    return {
        "note": "Due-date tracking is a planned Phase 5 feature. "
                "Returning all open action items for now.",
        "open_action_items": open_items,
        "count": len(open_items),
    }
