"""
crud.py — CRUD helper functions for all CMIS database entities.
"""

from __future__ import annotations

from typing import List, Optional

from sqlalchemy.orm import Session

from db.models import (
    ActionItem,
    ContextEntry,
    Decision,
    Meeting,
    Report,
    Speaker,
    Topic,
    TranscriptSegment,
)
from db.schemas import (
    ActionItemCreate,
    ActionItemUpdate,
    DecisionCreate,
    MeetingCreate,
    SegmentCreate,
    SpeakerCreate,
    TopicCreate,
)


# ── Meeting ───────────────────────────────────────────────────────────────────

def create_meeting(db: Session, data: MeetingCreate) -> Meeting:
    meeting = Meeting(title=data.title)
    db.add(meeting)
    db.commit()
    db.refresh(meeting)
    return meeting


def get_meeting(db: Session, meeting_id: str) -> Optional[Meeting]:
    return db.query(Meeting).filter(Meeting.id == meeting_id).first()


def list_meetings(db: Session, skip: int = 0, limit: int = 100) -> List[Meeting]:
    return db.query(Meeting).order_by(Meeting.date.desc()).offset(skip).limit(limit).all()


def update_meeting_status(db: Session, meeting_id: str, status: str) -> Optional[Meeting]:
    meeting = get_meeting(db, meeting_id)
    if meeting:
        meeting.status = status
        db.commit()
        db.refresh(meeting)
    return meeting


def update_meeting_audio_path(db: Session, meeting_id: str, audio_path: str) -> Optional[Meeting]:
    meeting = get_meeting(db, meeting_id)
    if meeting:
        meeting.audio_path = audio_path
        db.commit()
        db.refresh(meeting)
    return meeting


# ── Speaker ───────────────────────────────────────────────────────────────────

def get_or_create_speaker(db: Session, meeting_id: str, label: str) -> Speaker:
    """Return existing speaker by label, or create a new one."""
    speaker = (
        db.query(Speaker)
        .filter(Speaker.meeting_id == meeting_id, Speaker.label == label)
        .first()
    )
    if not speaker:
        speaker = Speaker(label=label, meeting_id=meeting_id)
        db.add(speaker)
        db.commit()
        db.refresh(speaker)
    return speaker


def list_speakers_for_meeting(db: Session, meeting_id: str) -> List[Speaker]:
    return db.query(Speaker).filter(Speaker.meeting_id == meeting_id).all()


# ── TranscriptSegment ─────────────────────────────────────────────────────────

def bulk_create_segments(db: Session, segments: List[SegmentCreate]) -> int:
    """Insert many transcript segments efficiently. Returns count inserted."""
    objs = [
        TranscriptSegment(
            meeting_id=s.meeting_id,
            speaker_id=s.speaker_id,
            text=s.text,
            start_time=s.start_time,
            end_time=s.end_time,
            segment_index=s.segment_index,
        )
        for s in segments
    ]
    db.bulk_save_objects(objs)
    db.commit()
    return len(objs)


def get_segments_for_meeting(db: Session, meeting_id: str) -> List[TranscriptSegment]:
    return (
        db.query(TranscriptSegment)
        .filter(TranscriptSegment.meeting_id == meeting_id)
        .order_by(TranscriptSegment.segment_index)
        .all()
    )


# ── ContextEntry ──────────────────────────────────────────────────────────────

def create_context_entry(db: Session, meeting_id: str) -> ContextEntry:
    entry = ContextEntry(meeting_id=meeting_id)
    db.add(entry)
    db.commit()
    db.refresh(entry)
    return entry


def get_context_for_meeting(db: Session, meeting_id: str) -> Optional[ContextEntry]:
    return (
        db.query(ContextEntry).filter(ContextEntry.meeting_id == meeting_id).first()
    )


# ── Topic ─────────────────────────────────────────────────────────────────────

def create_topic(db: Session, data: TopicCreate, minhash_signature: Optional[str] = None) -> Topic:
    topic = Topic(
        context_id=data.context_id,
        title=data.title,
        summary=data.summary,
        is_recurring=data.is_recurring,
        previous_topic_id=data.previous_topic_id,
        minhash_signature=minhash_signature,
    )
    db.add(topic)
    db.commit()
    db.refresh(topic)
    return topic


def get_all_topics(db: Session) -> List[Topic]:
    return db.query(Topic).all()


def get_recurring_topics(db: Session) -> List[Topic]:
    return db.query(Topic).filter(Topic.is_recurring.is_(True)).all()


def mark_topic_recurring(
    db: Session, topic_id: str, previous_topic_id: str
) -> Optional[Topic]:
    topic = db.query(Topic).filter(Topic.id == topic_id).first()
    if topic:
        topic.is_recurring = True
        topic.previous_topic_id = previous_topic_id
        db.commit()
        db.refresh(topic)
    return topic


# ── ActionItem ────────────────────────────────────────────────────────────────

def create_action_item(db: Session, data: ActionItemCreate) -> ActionItem:
    item = ActionItem(
        context_id=data.context_id,
        description=data.description,
        owner=data.owner,
        urgency=data.urgency,
        resolved=data.resolved,
    )
    db.add(item)
    db.commit()
    db.refresh(item)
    return item


def get_all_open_action_items(db: Session) -> List[ActionItem]:
    return db.query(ActionItem).filter(ActionItem.resolved.is_(False)).all()


def get_action_item(db: Session, item_id: str) -> Optional[ActionItem]:
    return db.query(ActionItem).filter(ActionItem.id == item_id).first()


def update_action_item(db: Session, item_id: str, data: ActionItemUpdate) -> Optional[ActionItem]:
    item = get_action_item(db, item_id)
    if item:
        update_data = data.model_dump(exclude_unset=True)
        for field, value in update_data.items():
            setattr(item, field, value)
        db.commit()
        db.refresh(item)
    return item


# ── Decision ──────────────────────────────────────────────────────────────────

def create_decision(db: Session, data: DecisionCreate) -> Decision:
    decision = Decision(
        context_id=data.context_id,
        description=data.description,
    )
    db.add(decision)
    db.commit()
    db.refresh(decision)
    return decision


# ── Report ────────────────────────────────────────────────────────────────────

def create_report(
    db: Session, meeting_id: str, fmt: str, file_path: Optional[str] = None
) -> Report:
    report = Report(meeting_id=meeting_id, format=fmt, file_path=file_path)
    db.add(report)
    db.commit()
    db.refresh(report)
    return report


def list_reports_for_meeting(db: Session, meeting_id: str) -> List[Report]:
    return db.query(Report).filter(Report.meeting_id == meeting_id).all()
