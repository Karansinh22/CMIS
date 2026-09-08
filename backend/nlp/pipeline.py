"""
nlp/pipeline.py — Orchestrates the NLP structuring phase.

run_nlp(meeting_id, db) sequence:
    load transcript → segment topics → extract decisions & action items
    (intent engine or LLM) → score urgency → detect recurring topics →
    generate summary → persist ContextEntry, Topics, ActionItems, Decisions

Two extraction engines (``NLP_ENGINE`` in .env):
    local (default) — nlp.intent: context/intent-aware, fully offline
    llm             — nlp.llm_extractor (Anthropic or Ollama), falls back to local
"""

from __future__ import annotations

import logging
from typing import Dict, List

from sqlalchemy.orm import Session

from config import settings
from db import crud
from db.schemas import ActionItemCreate, DecisionCreate, TopicCreate
from nlp.intent import Utterance, extract, infer_speaker_names
from nlp.recurring import check_and_register_topic, signature_to_json
from nlp.topic_segmenter import segment_into_topics
from nlp.urgency_scorer import score_urgency

logger = logging.getLogger(__name__)


def _pretty_label(label: str) -> str:
    """SPEAKER_00 → Speaker 1 (used only for display when no name is known)."""
    if label and label.upper().startswith("SPEAKER_"):
        try:
            return f"Speaker {int(label.split('_')[1]) + 1}"
        except (IndexError, ValueError):
            return label
    return label


def run_nlp(meeting_id: str, db: Session) -> None:
    """
    Full NLP structuring pipeline for one meeting.

    Reads the transcript from the DB, extracts structured context, and saves
    ContextEntry / Topic / ActionItem / Decision rows.
    """
    from jobs.worker import publish, update_status

    try:
        crud.update_meeting_status(db, meeting_id, "structuring")
        update_status(meeting_id, "structuring", "Loading transcript…", progress=0.05)

        # ── 1. Load segments ─────────────────────────────────────────────────
        segments = crud.get_segments_for_meeting(db, meeting_id)
        if not segments:
            logger.warning("No transcript segments found for meeting %s.", meeting_id)
            crud.update_meeting_status(db, meeting_id, "error")
            update_status(meeting_id, "error", "No transcript to structure.")
            return

        texts: List[str] = [s.text for s in segments]
        speaker_labels: List[str] = [
            (s.speaker.label if s.speaker else "SPEAKER_00") for s in segments
        ]
        # User-set speaker names take priority; self-introductions fill the gaps.
        speaker_names: Dict[str, str] = {
            s.speaker.label: s.speaker.name for s in segments if s.speaker and s.speaker.name
        }
        utterances = [
            Utterance(index=i, speaker=lab, text=txt, start=s.start_time, end=s.end_time)
            for i, (s, lab, txt) in enumerate(zip(segments, speaker_labels, texts))
        ]
        for label, name in infer_speaker_names(utterances).items():
            speaker_names.setdefault(label, name)

        # ── 2. Extraction (LLM if configured, otherwise local intent engine) ─
        update_status(meeting_id, "structuring", "Understanding decisions and action items…", progress=0.25)
        llm_result = None
        if (settings.nlp_engine or "local").lower() == "llm":
            try:
                from nlp.llm_extractor import analyse_meeting
                meeting_row = crud.get_meeting(db, meeting_id)
                llm_result = analyse_meeting(
                    utterances, speaker_names,
                    summary_type=(meeting_row.summary_type if meeting_row else "balanced") or "balanced",
                )
            except Exception as exc:  # noqa: BLE001
                logger.warning("LLM extraction unavailable (%s); using local intent engine.", exc)
                llm_result = None

        # Display names for owners: real name if known, else "Speaker N"
        display_names = {lab: speaker_names.get(lab, _pretty_label(lab)) for lab in set(speaker_labels)}

        action_items_list: List[dict] = []
        decisions_list: List[dict] = []

        if llm_result is not None:
            for ai in llm_result.action_items:
                if ai.confidence < settings.extraction_min_confidence or not ai.description.strip():
                    continue
                urgency = ai.urgency if ai.urgency in ("critical", "high", "medium", "low") else score_urgency(
                    f"{ai.description} {ai.due or ''}"
                )
                action_items_list.append({
                    "description": ai.description.strip(), "owner": ai.owner, "due": ai.due,
                    "urgency": urgency, "evidence": ai.evidence, "confidence": ai.confidence,
                    "segment_index": ai.segment_index,
                })
            for d in llm_result.decisions:
                if d.confidence < settings.extraction_min_confidence or not d.description.strip():
                    continue
                decisions_list.append({
                    "description": d.description.strip(), "rationale": d.rationale, "evidence": d.evidence,
                    "confidence": d.confidence, "segment_index": d.segment_index,
                })
        else:
            result = extract(utterances, display_names, min_confidence=settings.extraction_min_confidence)
            for ai in result.action_items:
                action_items_list.append({
                    "description": ai.description, "owner": ai.owner, "due": ai.due,
                    "urgency": score_urgency(f"{ai.description} {ai.due or ''} {ai.evidence}"),
                    "evidence": ai.evidence, "confidence": ai.confidence, "segment_index": ai.segment_index,
                })
            for d in result.decisions:
                decisions_list.append({
                    "description": d.description, "rationale": d.rationale, "evidence": d.evidence,
                    "confidence": d.confidence, "segment_index": d.segment_index,
                })

        # ── 3. Topic segmentation ────────────────────────────────────────────
        update_status(meeting_id, "structuring", "Segmenting topics…", progress=0.5)
        if llm_result is not None and llm_result.topics:
            topics_list = [{"title": t.title, "summary": t.summary} for t in llm_result.topics]
        else:
            topic_clusters = segment_into_topics(texts, exclude_terms=list(speaker_names.values()))
            topics_list = [{"title": c.title, "summary": c.summary} for c in topic_clusters]

        # ── 4. Create ContextEntry ───────────────────────────────────────────
        context_entry = crud.create_context_entry(db, meeting_id)
        context_id = context_entry.id

        # ── 5. Save Topics (+ recurring detection) ───────────────────────────
        update_status(meeting_id, "structuring", "Detecting recurring topics…", progress=0.65)
        for t in topics_list:
            topic_text = f"{t['title']} {t['summary']}"
            is_recurring, prev_id = check_and_register_topic(
                topic_id=f"temp_{meeting_id}_{t['title'][:20]}",
                topic_text=topic_text,
                current_meeting_id=meeting_id,
            )
            crud.create_topic(
                db,
                TopicCreate(
                    context_id=context_id, title=t["title"], summary=t["summary"],
                    is_recurring=is_recurring, previous_topic_id=prev_id,
                ),
                minhash_signature=signature_to_json(topic_text),
            )

        # ── 6. Save ActionItems and Decisions ────────────────────────────────
        update_status(meeting_id, "structuring", "Saving action items and decisions…", progress=0.8)
        for ai in action_items_list:
            crud.create_action_item(
                db,
                ActionItemCreate(
                    context_id=context_id, description=ai["description"], owner=ai["owner"],
                    urgency=ai["urgency"], due=ai["due"], evidence=ai["evidence"],
                    confidence=float(ai["confidence"]), segment_index=ai["segment_index"],
                ),
            )
        for d in decisions_list:
            crud.create_decision(
                db,
                DecisionCreate(
                    context_id=context_id, description=d["description"], rationale=d["rationale"],
                    evidence=d["evidence"], confidence=float(d["confidence"]), segment_index=d["segment_index"],
                ),
            )

        # ── 7. Generate Meeting Summary ──────────────────────────────────────
        update_status(meeting_id, "structuring", "Generating meeting summary…", progress=0.9)
        meeting = crud.get_meeting(db, meeting_id)
        summary_type = meeting.summary_type if meeting and meeting.summary_type else "balanced"

        if llm_result is not None and llm_result.summary.strip():
            overall_summary = llm_result.summary.strip()
        else:
            from nlp.summarizer import generate_meeting_summary
            overall_summary = generate_meeting_summary(
                segment_texts=texts,
                topics=topics_list,
                action_items=action_items_list,
                decisions=decisions_list,
                summary_type=summary_type,
                speaker_labels=speaker_labels,
            )

        context_entry.summary = overall_summary
        context_entry.summary_type = summary_type
        db.commit()

        # ── 8. Mark done ─────────────────────────────────────────────────────
        crud.update_meeting_status(db, meeting_id, "done")
        publish(meeting_id, {"type": "context_ready", "status": "done"})
        update_status(meeting_id, "done", "Analysis complete.", progress=1.0)
        logger.info(
            "NLP pipeline complete for meeting %s: %d action items, %d decisions, %d topics (%s).",
            meeting_id, len(action_items_list), len(decisions_list), len(topics_list),
            "llm" if llm_result is not None else "local",
        )

    except Exception as exc:
        logger.exception("NLP pipeline failed for meeting %s: %s", meeting_id, exc)
        db.rollback()
        crud.update_meeting_status(db, meeting_id, "error")
        update_status(meeting_id, "error", str(exc))
        raise
