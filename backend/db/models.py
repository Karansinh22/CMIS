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


# ── Meeting ───────────────────────────────────────────────────────────────────

class Meeting(Base):
    """Top-level record for a single meeting session."""

    __tablename__ = "meetings"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=_uuid)
    title: Mapped[str] = mapped_column(String(255), nullable=False)
    date: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
    status: Mapped[str] = mapped_column(
        String(50), default="queued"
    )  # queued | transcribing | structuring | done | error
    audio_path: Mapped[Optional[str]] = mapped_column(String(512), nullable=True)

    # Relationships
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
    urgency: Mapped[str] = mapped_column(String(10), default="low")  # low | medium | high
    resolved: Mapped[bool] = mapped_column(Boolean, default=False)

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
