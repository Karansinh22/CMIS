"""
models.py — SQLAlchemy ORM models for the CMIS context store.

Schema is derived from the ER diagram in docs/CMIS_UML_Diagrams.md.
All tables use UUID primary keys stored as strings (portable across SQLite
and PostgreSQL without an extra extension).
"""

import uuid
from datetime import datetime
from typing import List, Optional

from sqlalchemy import (
    Boolean,
    DateTime,
    Float,
    ForeignKey,
    Integer,
    String,
    Text,
)
from sqlalchemy.orm import Mapped, mapped_column, relationship

from db.database import Base


def _uuid() -> str:
    return str(uuid.uuid4())


# ── User ─────────────────────────────────────────────────────────────────────

class User(Base):
    """An authenticated CMIS user account."""

    __tablename__ = "users"

    id:             Mapped[str]            = mapped_column(String(36), primary_key=True, default=_uuid)
    name:           Mapped[str]            = mapped_column(String(100), nullable=False)
    email:          Mapped[str]            = mapped_column(String(255), nullable=False, unique=True, index=True)
    password_hash:  Mapped[str]            = mapped_column(String(255), nullable=False)
    email_verified: Mapped[bool]           = mapped_column(Boolean, default=False)
    is_active:      Mapped[bool]           = mapped_column(Boolean, default=True)

    # OTP fields — reused for both email-verify and password-reset flows
    otp_code:       Mapped[Optional[str]]      = mapped_column(String(10),  nullable=True)
    otp_expires_at: Mapped[Optional[datetime]] = mapped_column(DateTime,    nullable=True)
    otp_purposes:   Mapped[Optional[str]]      = mapped_column(String(20),  nullable=True)  # 'verify' | 'reset'

    # Timestamps
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
    last_login: Mapped[Optional[datetime]] = mapped_column(DateTime, nullable=True)

    projects: Mapped[List["Project"]] = relationship("Project", back_populates="user", cascade="all, delete-orphan")


# ── Project ───────────────────────────────────────────────────────────────────

class Project(Base):
    """A collection of meetings under a shared company, client, or topic agenda."""

    __tablename__ = "projects"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=_uuid)
    user_id: Mapped[Optional[str]] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), nullable=True)
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    company: Mapped[Optional[str]] = mapped_column(String(100), nullable=True)
    category: Mapped[Optional[str]] = mapped_column(String(50), nullable=True)  # Engineering, Viva, Sales, etc.
    description: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
    updated_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    # Relationships
    user: Mapped[Optional["User"]] = relationship("User", back_populates="projects")
    meetings: Mapped[List["Meeting"]] = relationship(
        "Meeting", back_populates="project", cascade="all, delete-orphan"
    )
    summary: Mapped[Optional["ProjectSummary"]] = relationship(
        "ProjectSummary", back_populates="project", uselist=False, cascade="all, delete-orphan"
    )


# ── ProjectSummary ────────────────────────────────────────────────────────────

class ProjectSummary(Base):
    """Cumulative synthesized intelligence across all meetings in a Project."""

    __tablename__ = "project_summaries"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=_uuid)
    project_id: Mapped[str] = mapped_column(ForeignKey("projects.id", ondelete="CASCADE"), unique=True)
    overall_summary: Mapped[str] = mapped_column(Text, nullable=False)
    key_highlights: Mapped[Optional[str]] = mapped_column(Text, nullable=True)           # JSON blob
    consolidated_action_items: Mapped[Optional[str]] = mapped_column(Text, nullable=True) # JSON blob
    recurring_themes: Mapped[Optional[str]] = mapped_column(Text, nullable=True)          # JSON blob
    meeting_count: Mapped[int] = mapped_column(Integer, default=0)
    total_duration_seconds: Mapped[float] = mapped_column(Float, default=0.0)
    last_updated: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)

    project: Mapped["Project"] = relationship("Project", back_populates="summary")


# ── Meeting ───────────────────────────────────────────────────────────────────

class Meeting(Base):
    """Top-level record for a single meeting session."""

    __tablename__ = "meetings"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=_uuid)
    user_id: Mapped[Optional[str]] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), nullable=True)
    project_id: Mapped[Optional[str]] = mapped_column(ForeignKey("projects.id", ondelete="SET NULL"), nullable=True)
    title: Mapped[str] = mapped_column(String(255), nullable=False)
    date: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
    status: Mapped[str] = mapped_column(
        String(50), default="queued"
    )  # queued | transcribing | structuring | done | error
    audio_path: Mapped[Optional[str]] = mapped_column(String(512), nullable=True)
    summary_type: Mapped[str] = mapped_column(String(20), default="balanced")  # brief | balanced | comprehensive
    source: Mapped[str] = mapped_column(String(20), default="upload")  # upload | live

    # Relationships
    project: Mapped[Optional["Project"]] = relationship("Project", back_populates="meetings")
    segments: Mapped[List["TranscriptSegment"]] = relationship(
        "TranscriptSegment", back_populates="meeting", cascade="all, delete-orphan"
    )
    speakers: Mapped[List["Speaker"]] = relationship(
        "Speaker", back_populates="meeting", cascade="all, delete-orphan"
    )
    context_entry: Mapped[Optional["ContextEntry"]] = relationship(
        "ContextEntry", back_populates="meeting", uselist=False, cascade="all, delete-orphan"
    )
    reports: Mapped[List["Report"]] = relationship(
        "Report", back_populates="meeting", cascade="all, delete-orphan"
    )
    transcript_history: Mapped[List["TranscriptEditHistory"]] = relationship(
        "TranscriptEditHistory", back_populates="meeting", cascade="all, delete-orphan"
    )


# ── TranscriptEditHistory ──────────────────────────────────────────────────────

class TranscriptEditHistory(Base):
    """Audit record of edits made to transcript segments."""

    __tablename__ = "transcript_edit_histories"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=_uuid)
    meeting_id: Mapped[str] = mapped_column(ForeignKey("meetings.id", ondelete="CASCADE"))
    segment_id: Mapped[str] = mapped_column(ForeignKey("transcript_segments.id", ondelete="CASCADE"))
    speaker_name: Mapped[Optional[str]] = mapped_column(String(100), nullable=True)
    old_text: Mapped[str] = mapped_column(Text, nullable=False)
    new_text: Mapped[str] = mapped_column(Text, nullable=False)
    edited_by: Mapped[Optional[str]] = mapped_column(String(100), nullable=True)
    edited_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)

    meeting: Mapped["Meeting"] = relationship("Meeting", back_populates="transcript_history")


# ── Speaker ───────────────────────────────────────────────────────────────────

class Speaker(Base):
    """Represents a speaker identified during diarization."""

    __tablename__ = "speakers"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=_uuid)
    label: Mapped[str] = mapped_column(String(50))   # e.g. "SPEAKER_00"
    name: Mapped[Optional[str]] = mapped_column(String(100), nullable=True)  # human-set name
    meeting_id: Mapped[str] = mapped_column(ForeignKey("meetings.id", ondelete="CASCADE"))

    meeting: Mapped["Meeting"] = relationship("Meeting", back_populates="speakers")
    segments: Mapped[List["TranscriptSegment"]] = relationship(
        "TranscriptSegment", back_populates="speaker"
    )


# ── TranscriptSegment ─────────────────────────────────────────────────────────

class TranscriptSegment(Base):
    """One spoken utterance, time-aligned and speaker-labelled."""

    __tablename__ = "transcript_segments"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=_uuid)
    meeting_id: Mapped[str] = mapped_column(ForeignKey("meetings.id", ondelete="CASCADE"))
    speaker_id: Mapped[Optional[str]] = mapped_column(
        ForeignKey("speakers.id", ondelete="SET NULL"), nullable=True
    )
    text: Mapped[str] = mapped_column(Text)
    start_time: Mapped[float] = mapped_column(Float)
    end_time: Mapped[float] = mapped_column(Float)
    segment_index: Mapped[int] = mapped_column(Integer, default=0)

    meeting: Mapped["Meeting"] = relationship("Meeting", back_populates="segments")
    speaker: Mapped[Optional["Speaker"]] = relationship("Speaker", back_populates="segments")


# ── ContextEntry ──────────────────────────────────────────────────────────────

class ContextEntry(Base):
    """Structured knowledge extracted from one meeting."""

    __tablename__ = "context_entries"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=_uuid)
    meeting_id: Mapped[str] = mapped_column(
        ForeignKey("meetings.id", ondelete="CASCADE"), unique=True
    )
    summary: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    summary_type: Mapped[Optional[str]] = mapped_column(String(20), default="balanced")

    meeting: Mapped["Meeting"] = relationship("Meeting", back_populates="context_entry")
    topics: Mapped[List["Topic"]] = relationship(
        "Topic", back_populates="context_entry", cascade="all, delete-orphan"
    )
    action_items: Mapped[List["ActionItem"]] = relationship(
        "ActionItem", back_populates="context_entry", cascade="all, delete-orphan"
    )
    decisions: Mapped[List["Decision"]] = relationship(
        "Decision", back_populates="context_entry", cascade="all, delete-orphan"
    )


# ── Topic ─────────────────────────────────────────────────────────────────────

class Topic(Base):
    """A discussion topic extracted from a context entry."""

    __tablename__ = "topics"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=_uuid)
    context_id: Mapped[str] = mapped_column(
        ForeignKey("context_entries.id", ondelete="CASCADE")
    )
    title: Mapped[str] = mapped_column(String(255))
    summary: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    is_recurring: Mapped[bool] = mapped_column(Boolean, default=False)
    # JSON blob of the MinHash signature (list of ints) — used for LSH lookup
    minhash_signature: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    # Reference to the earlier topic this one recurs from
    previous_topic_id: Mapped[Optional[str]] = mapped_column(
        String(36), nullable=True
    )
    # Time span covered by the topic (seconds into the recording), for timelines
    start_time: Mapped[Optional[float]] = mapped_column(Float, nullable=True)
    end_time: Mapped[Optional[float]] = mapped_column(Float, nullable=True)

    context_entry: Mapped["ContextEntry"] = relationship(
        "ContextEntry", back_populates="topics"
    )


# ── ActionItem ────────────────────────────────────────────────────────────────

class ActionItem(Base):
    """An extracted action item with owner and urgency."""

    __tablename__ = "action_items"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=_uuid)
    context_id: Mapped[str] = mapped_column(
        ForeignKey("context_entries.id", ondelete="CASCADE")
    )
    description: Mapped[str] = mapped_column(Text)
    owner: Mapped[Optional[str]] = mapped_column(String(100), nullable=True)
    urgency: Mapped[str] = mapped_column(String(10), default="low")  # low | medium | high | critical
    resolved: Mapped[bool] = mapped_column(Boolean, default=False)
    # Deadline phrase as spoken ("by Friday", "before the release"), if any
    due: Mapped[Optional[str]] = mapped_column(String(100), nullable=True)
    # Verbatim transcript sentence the item was extracted from
    evidence: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    # Extraction confidence 0–1 (1.0 for manually added items)
    confidence: Mapped[float] = mapped_column(Float, default=1.0)
    # Index of the transcript segment the item came from (links UI → transcript)
    segment_index: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)

    context_entry: Mapped["ContextEntry"] = relationship(
        "ContextEntry", back_populates="action_items"
    )


# ── Decision ──────────────────────────────────────────────────────────────────

class Decision(Base):
    """A decision recorded during the meeting."""

    __tablename__ = "decisions"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=_uuid)
    context_id: Mapped[str] = mapped_column(
        ForeignKey("context_entries.id", ondelete="CASCADE")
    )
    description: Mapped[str] = mapped_column(Text)
    decided_on: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
    # Why the decision was taken, when the speaker said so ("because …")
    rationale: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    evidence: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    confidence: Mapped[float] = mapped_column(Float, default=1.0)
    segment_index: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)

    context_entry: Mapped["ContextEntry"] = relationship(
        "ContextEntry", back_populates="decisions"
    )


# ── Report ────────────────────────────────────────────────────────────────────

class Report(Base):
    """A generated document (MoM, PPT, summary) for a meeting."""

    __tablename__ = "reports"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=_uuid)
    meeting_id: Mapped[str] = mapped_column(ForeignKey("meetings.id", ondelete="CASCADE"))
    format: Mapped[str] = mapped_column(String(20))  # docx | pdf | pptx | text
    generated_on: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
    file_path: Mapped[Optional[str]] = mapped_column(String(512), nullable=True)

    meeting: Mapped["Meeting"] = relationship("Meeting", back_populates="reports")
