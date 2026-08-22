"""
routers/insights.py — FastAPI router for cross-meeting analytical insights.

Endpoints:
    GET /insights/recurring-topics        — user-wise recurring topics with history
    GET /insights/action-items/overdue    — user-wise overdue / open action items
"""

from __future__ import annotations

from typing import List, Optional

from fastapi import APIRouter, Depends
from sqlalchemy import or_
from sqlalchemy.orm import Session

from auth.dependencies import get_optional_user
from db.database import get_db
from db.models import ActionItem, ContextEntry, Meeting, Project, Topic, User
from db.schemas import TopicOut

router = APIRouter(prefix="/insights", tags=["Insights"])


@router.get("/recurring-topics", response_model=List[TopicOut])
def get_recurring_topics(
    db: Session = Depends(get_db),
    current_user: Optional[User] = Depends(get_optional_user),
):
    """
    Return all topics that have been flagged as recurring across meetings for the authenticated user.
    Each topic includes a `previous_topic_id` linking to the earlier occurrence.
    """
    if not current_user:
        return []

    query = (
        db.query(Topic)
        .join(Topic.context_entry)
        .join(ContextEntry.meeting)
        .outerjoin(Meeting.project)
        .filter(Topic.is_recurring.is_(True))
        .filter(
            or_(
                Meeting.user_id == current_user.id,
                Project.user_id == current_user.id,
            )
        )
    )
    return query.all()


@router.get("/action-items/overdue")
def get_overdue_action_items(
    db: Session = Depends(get_db),
    current_user: Optional[User] = Depends(get_optional_user),
):
    """
    Return unresolved action items for the authenticated user.
    """
    if not current_user:
        return {
            "note": "User-isolated action items",
            "open_action_items": [],
            "count": 0,
        }

    query = (
        db.query(ActionItem)
        .join(ActionItem.context_entry)
        .join(ContextEntry.meeting)
        .outerjoin(Meeting.project)
        .filter(ActionItem.resolved.is_(False))
        .filter(
            or_(
                Meeting.user_id == current_user.id,
                Project.user_id == current_user.id,
            )
        )
    )
    open_items = query.all()

    return {
        "note": "Due-date tracking is a planned Phase 5 feature. Returning open action items for authenticated user.",
        "open_action_items": open_items,
        "count": len(open_items),
    }
