"""
nlp/pipeline.py — Orchestrates the NLP structuring phase.

run_nlp(meeting_id, db) sequence:
    load transcript → segment topics → classify segments →
    score urgency → extract owners → detect recurring topics →
    persist ContextEntry, Topics, ActionItems, Decisions
"""

from __future__ import annotations

import logging
from typing import List

from sqlalchemy.orm import Session

from db import crud
from db.schemas import ActionItemCreate, DecisionCreate, TopicCreate
from nlp.classifier import classify_batch
from nlp.owner_extractor import extract_owner
from nlp.recurring import check_and_register_topic, signature_to_json
from nlp.topic_segmenter import segment_into_topics
from nlp.urgency_scorer import score_urgency

logger = logging.getLogger(__name__)


def run_nlp(meeting_id: str, db: Session) -> None:
    """
    Full NLP structuring pipeline for one meeting.

    Reads the transcript from the DB, extracts structured context, and saves
    ContextEntry / Topic / ActionItem / Decision rows.
    """
    from jobs.worker import update_status

    try:
        update_status(meeting_id, "structuring", "Loading transcript…")

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

        # ── 2. Topic segmentation ────────────────────────────────────────────
        update_status(meeting_id, "structuring", "Segmenting topics…")
        topic_clusters = segment_into_topics(texts)

        # ── 3. Classify all segments ─────────────────────────────────────────
        update_status(meeting_id, "structuring", "Classifying segments…")
        classifications = classify_batch(texts)

        # ── 4. Create ContextEntry ───────────────────────────────────────────
        context_entry = crud.create_context_entry(db, meeting_id)
        context_id = context_entry.id

        # ── 5. Save Topics ───────────────────────────────────────────────────
        update_status(meeting_id, "structuring", "Detecting recurring topics…")
        for cluster in topic_clusters:
            topic_text = f"{cluster.title} {cluster.summary}"

            is_recurring, prev_id = check_and_register_topic(
                topic_id=f"temp_{meeting_id}_{cluster.title[:20]}",  # placeholder key
                topic_text=topic_text,
                current_meeting_id=meeting_id,
            )

            sig_json = signature_to_json(topic_text)

            topic_data = TopicCreate(
                context_id=context_id,
                title=cluster.title,
                summary=cluster.summary,
                is_recurring=is_recurring,
                previous_topic_id=prev_id,
            )
            crud.create_topic(db, topic_data, minhash_signature=sig_json)

        # ── 6. Save ActionItems and Decisions ────────────────────────────────
        update_status(meeting_id, "structuring", "Extracting action items and decisions…")

        for idx, (text, classification, speaker) in enumerate(
            zip(texts, classifications, speaker_labels)
        ):
            if classification == "action_item":
                # Get neighbouring texts for owner extraction context
                context_window = texts[max(0, idx - 1): idx + 2]
                owner = extract_owner(text, speaker_label=speaker, context_texts=context_window)
                urgency = score_urgency(text)

                crud.create_action_item(
                    db,
                    ActionItemCreate(
                        context_id=context_id,
                        description=text,
                        owner=owner,
                        urgency=urgency,
                    ),
                )

            elif classification == "decision":
                crud.create_decision(
                    db,
                    DecisionCreate(
                        context_id=context_id,
                        description=text,
                    ),
                )

        # ── 7. Mark done ─────────────────────────────────────────────────────
        crud.update_meeting_status(db, meeting_id, "done")
        update_status(meeting_id, "done", "NLP structuring complete.")
        logger.info("NLP pipeline complete for meeting %s.", meeting_id)

    except Exception as exc:
        logger.exception("NLP pipeline failed for meeting %s: %s", meeting_id, exc)
        crud.update_meeting_status(db, meeting_id, "error")
        update_status(meeting_id, "error", str(exc))
        raise
