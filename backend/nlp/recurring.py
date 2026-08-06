"""
recurring.py — Recurring-topic detection using MinHash / LSH (datasketch).

For each newly saved topic:
  1. Generate a MinHash signature from the topic text tokens.
  2. Query the LSH index for near-duplicate topics from *previous* meetings.
  3. If Jaccard similarity > JACCARD_THRESHOLD → mark topic as recurring.
  4. Persist the updated LSH index to disk.

The LSH index is loaded at startup and written back after each new topic is added.
"""

from __future__ import annotations

import json
import logging
import pickle
from pathlib import Path
from typing import List, Optional, Tuple

from config import settings

logger = logging.getLogger(__name__)

JACCARD_THRESHOLD = 0.4   # topics with similarity above this are "recurring"
NUM_PERM = 128             # number of MinHash permutations (higher = more accurate)


# ── LSH index singleton ───────────────────────────────────────────────────────

_lsh = None
_topic_signatures: dict[str, object] = {}   # topic_id → MinHash object


def _get_lsh():
    """Lazy-load or create the LSH index."""
    global _lsh, _topic_signatures
    if _lsh is not None:
        return _lsh

    from datasketch import MinHashLSH
    index_path = settings.lsh_index_path

    if index_path.exists():
        try:
            with open(index_path, "rb") as f:
                state = pickle.load(f)
            _lsh = state["lsh"]
            _topic_signatures = state["signatures"]
            logger.info("LSH index loaded from %s (%d topics).", index_path, len(_topic_signatures))
            return _lsh
        except Exception as exc:
            logger.warning("Failed to load LSH index: %s. Starting fresh.", exc)

    _lsh = MinHashLSH(threshold=JACCARD_THRESHOLD, num_perm=NUM_PERM)
    _topic_signatures = {}
    logger.info("Initialized fresh LSH index.")
    return _lsh


def _save_lsh() -> None:
    """Persist the LSH index and signatures to disk."""
    index_path = settings.lsh_index_path
    try:
        with open(index_path, "wb") as f:
            pickle.dump({"lsh": _lsh, "signatures": _topic_signatures}, f)
        logger.debug("LSH index saved to %s.", index_path)
    except Exception as exc:
        logger.error("Failed to save LSH index: %s", exc)


def _text_to_minhash(text: str):
    """Build a MinHash from whitespace-tokenized lowercased text."""
    from datasketch import MinHash
    m = MinHash(num_perm=NUM_PERM)
    tokens = set(text.lower().split())
    for token in tokens:
        m.update(token.encode("utf8"))
    return m


# ── Public API ────────────────────────────────────────────────────────────────

def check_and_register_topic(
    topic_id: str,
    topic_text: str,
    current_meeting_id: str,
) -> Tuple[bool, Optional[str]]:
    """
    Check if a topic is recurring and register it in the LSH index.

    Args:
        topic_id:           UUID of the Topic row.
        topic_text:         Combined title + summary text of the topic.
        current_meeting_id: UUID of the meeting this topic belongs to.

    Returns:
        (is_recurring, previous_topic_id)
        is_recurring:      True if a similar topic was found in a past meeting.
        previous_topic_id: ID of the matched earlier topic, or None.
    """
    lsh = _get_lsh()
    m = _text_to_minhash(topic_text)

    # Query for similar topics
    candidates = lsh.query(m)

    is_recurring = False
    previous_topic_id: Optional[str] = None

    for candidate_id in candidates:
        if candidate_id == topic_id:
            continue  # skip self
        # candidate_id is "<meeting_id>:<topic_id>"
        parts = candidate_id.split(":", 1)
        if len(parts) == 2 and parts[0] != current_meeting_id:
            is_recurring = True
            previous_topic_id = parts[1]
            break

    # Register this topic (use composite key so we can filter by meeting)
    composite_key = f"{current_meeting_id}:{topic_id}"
    try:
        lsh.insert(composite_key, m)
        _topic_signatures[composite_key] = m
    except ValueError:
        # Already inserted (idempotent)
        pass

    _save_lsh()

    # Serialize signature to JSON for storage in the DB column
    signature_json = json.dumps(m.hashvalues.tolist())

    logger.info(
        "Topic %s registered in LSH. recurring=%s, matched=%s",
        topic_id, is_recurring, previous_topic_id,
    )
    return is_recurring, previous_topic_id


def signature_to_json(topic_text: str) -> str:
    """Return the MinHash signature as a JSON string for DB storage."""
    m = _text_to_minhash(topic_text)
    return json.dumps(m.hashvalues.tolist())
