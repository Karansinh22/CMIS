"""
schemas.py — Pydantic v2 request / response models for all CMIS entities.
"""

from __future__ import annotations

from datetime import datetime
from typing import List, Optional

from pydantic import BaseModel, ConfigDict


# ── Speaker ───────────────────────────────────────────────────────────────────

class SpeakerBase(BaseModel):
    label: str
    name: Optional[str] = None


class SpeakerCreate(SpeakerBase):
    meeting_id: str


class SpeakerOut(SpeakerBase):
    model_config = ConfigDict(from_attributes=True)
    id: str
    meeting_id: str


# ── TranscriptSegment ─────────────────────────────────────────────────────────

class SegmentBase(BaseModel):
    text: str
    start_time: float
    end_time: float
    segment_index: int = 0


class SegmentCreate(SegmentBase):
    meeting_id: str
    speaker_id: Optional[str] = None


class SegmentOut(SegmentBase):
    model_config = ConfigDict(from_attributes=True)
    id: str
    meeting_id: str
    speaker_id: Optional[str] = None
    speaker: Optional[SpeakerOut] = None


# ── Meeting ───────────────────────────────────────────────────────────────────

class MeetingCreate(BaseModel):
    title: str


class MeetingOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: str
    title: str
    date: datetime
    status: str
    audio_path: Optional[str] = None
    summary_type: str = "balanced"


class MeetingDetail(MeetingOut):
    segments: List[SegmentOut] = []
    speakers: List[SpeakerOut] = []


# ── ActionItem ────────────────────────────────────────────────────────────────

class ActionItemBase(BaseModel):
    description: str
    owner: Optional[str] = None
    urgency: str = "low"
    resolved: bool = False
    due: Optional[str] = None
    evidence: Optional[str] = None
    confidence: float = 1.0
    segment_index: Optional[int] = None


class ActionItemCreate(ActionItemBase):
    context_id: str


class ActionItemUpdate(BaseModel):
    resolved: Optional[bool] = None
    owner: Optional[str] = None
    urgency: Optional[str] = None
    description: Optional[str] = None
    due: Optional[str] = None


class ActionItemOut(ActionItemBase):
    model_config = ConfigDict(from_attributes=True)
    id: str
    context_id: str


# ── Decision ──────────────────────────────────────────────────────────────────

class DecisionBase(BaseModel):
    description: str
    rationale: Optional[str] = None
    evidence: Optional[str] = None
    confidence: float = 1.0
    segment_index: Optional[int] = None


class DecisionCreate(DecisionBase):
    context_id: str


class DecisionOut(DecisionBase):
    model_config = ConfigDict(from_attributes=True)
    id: str
    context_id: str
    decided_on: datetime


# ── Topic ─────────────────────────────────────────────────────────────────────

class TopicBase(BaseModel):
    title: str
    summary: Optional[str] = None
    is_recurring: bool = False
    previous_topic_id: Optional[str] = None


class TopicCreate(TopicBase):
    context_id: str


class TopicOut(TopicBase):
    model_config = ConfigDict(from_attributes=True)
    id: str
    context_id: str


# ── ContextEntry ──────────────────────────────────────────────────────────────

class ContextEntryOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: str
    meeting_id: str
    summary: Optional[str] = None
    summary_type: Optional[str] = None
    topics: List[TopicOut] = []
    action_items: List[ActionItemOut] = []
    decisions: List[DecisionOut] = []


# ── Report ────────────────────────────────────────────────────────────────────

class ReportOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: str
    meeting_id: str
    format: str
    generated_on: datetime
    file_path: Optional[str] = None


# ── Processing status (used by WebSocket / job worker) ───────────────────────

class ProcessingStatus(BaseModel):
    meeting_id: str
    status: str      # queued | transcribing | structuring | done | error
    message: Optional[str] = None
