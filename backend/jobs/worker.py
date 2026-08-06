"""
jobs/worker.py — Simple in-memory async job status tracker.

Stores processing status for each meeting so WebSocket clients and API
callers can poll progress without a full message-queue dependency (no Celery).

Status values: queued | transcribing | structuring | done | error
"""

from __future__ import annotations

import asyncio
import logging
from typing import Dict, List, Optional, Set

logger = logging.getLogger(__name__)


# ── In-memory store ───────────────────────────────────────────────────────────

_statuses: Dict[str, Dict] = {}
# { meeting_id: { "status": str, "message": str } }

_subscribers: Dict[str, Set[asyncio.Queue]] = {}
# { meeting_id: set of asyncio.Queue — one per connected WebSocket }


# ── Status management ─────────────────────────────────────────────────────────

def update_status(meeting_id: str, status: str, message: str = "") -> None:
    """
    Update the in-memory status for a meeting and notify all WebSocket
    subscribers for that meeting.
    """
    _statuses[meeting_id] = {"status": status, "message": message}
    logger.debug("Status[%s] → %s (%s)", meeting_id, status, message)

    # Notify subscribers
    queues = _subscribers.get(meeting_id, set())
    for q in queues:
        try:
            q.put_nowait({"status": status, "message": message, "meeting_id": meeting_id})
        except asyncio.QueueFull:
            pass  # slow consumer — drop the message


def get_status(meeting_id: str) -> Optional[Dict]:
    """Return the current status dict for a meeting, or None."""
    return _statuses.get(meeting_id)


# ── WebSocket subscription ────────────────────────────────────────────────────

def subscribe(meeting_id: str) -> asyncio.Queue:
    """Create and register a new queue for a WebSocket client."""
    q: asyncio.Queue = asyncio.Queue(maxsize=50)
    _subscribers.setdefault(meeting_id, set()).add(q)
    return q


def unsubscribe(meeting_id: str, queue: asyncio.Queue) -> None:
    """Remove a subscriber queue when the WebSocket disconnects."""
    queues = _subscribers.get(meeting_id, set())
    queues.discard(queue)
