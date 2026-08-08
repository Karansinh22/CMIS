"""
nlp/project_synthesizer.py — Synthesize multi-meeting context into project-level intelligence.

Aggregates transcript segments, topics, decisions, and action items across
all meetings in a Project to build a cumulative context summary.
"""

from __future__ import annotations

import json
import logging
from datetime import datetime
from typing import Dict, List, Any

from sqlalchemy.orm import Session
from db.models import Project, ProjectSummary, Meeting, ActionItem, Decision, Topic

logger = logging.getLogger(__name__)


def synthesize_project_context(project_id: str, db: Session) -> ProjectSummary:
    """
    Build or update the cumulative ProjectSummary for a given Project.
    Processes all completed meetings in chronological order.
    """
    project = db.query(Project).filter(Project.id == project_id).first()
    if not project:
        raise ValueError(f"Project with ID {project_id} not found.")

    # Filter done/completed meetings
    completed_meetings = [m for m in project.meetings if m.status in ("done", "completed")]
    
    if not completed_meetings:
        # Fallback summary when no completed meetings exist yet
        overall_summary = (
            f"Project '{project.name}' initialized. "
            f"No completed meeting transcriptions recorded yet. "
            f"Upload meeting audio recordings to automatically generate multi-meeting intelligence."
        )
        highlights = ["Project initialized."]
        action_items_list = []
        recurring_themes = []
        total_duration = 0.0
    else:
        # Sort meetings chronologically
        completed_meetings.sort(key=lambda x: x.date or datetime.min)

        all_topics: List[Dict[str, Any]] = []
        all_decisions: List[Dict[str, Any]] = []
        all_action_items: List[Dict[str, Any]] = []
        meeting_summaries: List[str] = []
        total_duration = 0.0

        for m in completed_meetings:
            meeting_date_str = m.date.strftime("%b %d, %Y") if m.date else "Unknown Date"
            
            # Calculate duration from segments
            if m.segments:
                seg_duration = max(s.end_time for s in m.segments) - min(s.start_time for s in m.segments)
                total_duration += max(0.0, seg_duration)

            if m.context_entry:
                ce = m.context_entry
                # Collect topics
                for t in ce.topics:
                    all_topics.append({
                        "meeting_title": m.title,
                        "meeting_date": meeting_date_str,
                        "title": t.title,
                        "summary": t.summary,
                    })

                # Collect decisions
                for d in ce.decisions:
                    all_decisions.append({
                        "meeting_title": m.title,
                        "meeting_date": meeting_date_str,
                        "description": d.description,
                        "decided_on": d.decided_on.strftime("%Y-%m-%d") if d.decided_on else meeting_date_str
                    })

                # Collect action items
                for a in ce.action_items:
                    all_action_items.append({
                        "meeting_title": m.title,
                        "meeting_date": meeting_date_str,
                        "description": a.description,
                        "owner": a.owner or "Unassigned",
                        "urgency": a.urgency,
                        "resolved": a.resolved,
                    })

            # Create a per-meeting snippet
            m_topics_str = ", ".join(t["title"] for t in all_topics if t["meeting_title"] == m.title)
            snippet = f"• Meeting '{m.title}' ({meeting_date_str}): Covered topics [{m_topics_str or 'General discussion'}]."
            meeting_summaries.append(snippet)

        # ── Synthesize Overall Summary ──────────────────────────────────────────
        overview_text = (
            f"Cumulative intelligence for '{project.name}' across {len(completed_meetings)} meeting(s). "
            f"Total recorded discussion time: {int(total_duration // 60)}m {int(total_duration % 60)}s.\n\n"
            f"Executive Narrative:\n" + "\n".join(meeting_summaries)
        )

        if all_decisions:
            overview_text += f"\n\nKey Decisions Made Across Meetings ({len(all_decisions)}):\n"
            for d in all_decisions[:5]:
                overview_text += f"- [{d['meeting_date']}] {d['description']} ({d['meeting_title']})\n"

        overall_summary = overview_text

        # ── Highlights ──────────────────────────────────────────────────────────
        highlights = [
            f"Processed {len(completed_meetings)} meeting sessions under {project.company or 'Project Agenda'}.",
            f"Extracted {len(all_decisions)} key organizational decisions.",
            f"Identified {len(all_action_items)} action items ({sum(1 for a in all_action_items if a['resolved'])} completed).",
        ]

        # ── Recurring Themes ───────────────────────────────────────────────────
        # Find topics mentioned across multiple meetings
        topic_counts: Dict[str, List[str]] = {}
        for t in all_topics:
            t_name = t["title"].strip()
            if t_name not in topic_counts:
                topic_counts[t_name] = []
            if t["meeting_title"] not in topic_counts[t_name]:
                topic_counts[t_name].append(t["meeting_title"])

        recurring_themes = [
            {"theme": t_name, "meetings": meetings_list, "frequency": len(meetings_list)}
            for t_name, meetings_list in topic_counts.items()
        ]
        recurring_themes.sort(key=lambda x: x["frequency"], reverse=True)

        action_items_list = all_action_items

    # Save/update ProjectSummary
    ps = db.query(ProjectSummary).filter(ProjectSummary.project_id == project_id).first()
    if not ps:
        ps = ProjectSummary(project_id=project_id, overall_summary=overall_summary)
        db.add(ps)
    
    ps.overall_summary = overall_summary
    ps.key_highlights = json.dumps(highlights)
    ps.consolidated_action_items = json.dumps(action_items_list)
    ps.recurring_themes = json.dumps(recurring_themes)
    ps.meeting_count = len(completed_meetings)
    ps.total_duration_seconds = total_duration
    ps.last_updated = datetime.utcnow()

    db.commit()
    db.refresh(ps)
    return ps
