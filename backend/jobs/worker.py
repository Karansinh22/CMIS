"""
jobs/worker.py — In-memory, thread-safe event bus for meeting processing.

The ingestion / NLP pipelines run in a worker thread (FastAPI BackgroundTasks),
while WebSocket clients live on the asyncio event loop.  This module bridges
the two safely with ``loop.call_soon_threadsafe``.

Event types pushed to subscribers (all carry ``meeting_id``):

    {"type": "status",   "status": "transcribing", "message": "...", "progress": 0.42}
    {"type": "segments", "status": "transcribing", "segments": [ {...}, ... ], "progress": 0.42}
    {"type": "transcript_ready", "status": "transcribing"}   # speakers re-labelled → re-fetch
    {"type": "context_ready",    "status": "done"}           # NLP results are in the DB

Status values: queued | transcribing | structuring | done | error
"""

from __future__ import annotations

import asyncio
import logging
import threading
from typing import Dict, List, Optional, Set, Tuple

logger = logging.getLogger(__name__)


# ── In-memory store ───────────────────────────────────────────────────────────

_statuses: Dict[str, Dict] = {}
# { meeting_id: { "status": str, "message": str, "progress": float | None } }

_subscribers: Dict[str, Set[Tuple[asyncio.Queue, asyncio.AbstractEventLoop]]] = {}
# { meeting_id: set of (queue, loop) — one per connected WebSocket }

_lock = threading.Lock()


# ── Publishing (safe to call from any thread) ────────────────────────────────

def publish(meeting_id: str, event: Dict) -> None:
    """Deliver an event dict to every subscriber of ``meeting_id``."""
    event = {"meeting_id": meeting_id, **event}
    with _lock:
        targets = list(_subscribers.get(meeting_id, ()))

    for queue, loop in targets:
        try:
            if loop.is_closed():
                continue
            loop.call_soon_threadsafe(_enqueue, queue, event)
        except RuntimeError:
            # Loop is shutting down — drop silently.
            pass


def _enqueue(queue: asyncio.Queue, event: Dict) -> None:
    try:
        queue.put_nowait(event)
    except asyncio.QueueFull:
        logger.warning("Dropping event for slow WebSocket consumer: %s", event.get("type"))


def update_status(
    meeting_id: str,
    status: str,
    message: str = "",
    progress: Optional[float] = None,
) -> None:
    """
    Record the current pipeline status for a meeting and notify subscribers.

    ``progress`` is a 0–1 fraction for the *current* stage (e.g. how much of the
    audio has been transcribed) and is optional.
    """
    with _lock:
        prev = _statuses.get(meeting_id, {})
        if progress is None and prev.get("status") == status:
            progress = prev.get("progress")
        _statuses[meeting_id] = {"status": status, "message": message, "progress": progress}

    logger.debug("Status[%s] → %s (%s) %s", meeting_id, status, message, progress)
    publish(meeting_id, {"type": "status", "status": status, "message": message, "progress": progress})


def publish_segments(meeting_id: str, segments: List[Dict], progress: Optional[float] = None) -> None:
    """Push freshly transcribed segments to live viewers."""
    if not segments:
        return
    with _lock:
        current = _statuses.get(meeting_id, {})
        if progress is not None:
            current = {**current, "progress": progress}
            _statuses[meeting_id] = current
    publish(
        meeting_id,
        {
            "type": "segments",
            "status": current.get("status", "transcribing"),
            "segments": segments,
            "progress": progress,
        },
    )


def get_status(meeting_id: str) -> Optional[Dict]:
    """Return the current status dict for a meeting, or None."""
    with _lock:
        return dict(_statuses[meeting_id]) if meeting_id in _statuses else None


def clear_status(meeting_id: str) -> None:
    with _lock:
        _statuses.pop(meeting_id, None)


# ── WebSocket subscription (call from the event loop) ────────────────────────

def subscribe(meeting_id: str) -> asyncio.Queue:
    """Create and register a new queue for a WebSocket client."""
    q: asyncio.Queue = asyncio.Queue(maxsize=2000)
    loop = asyncio.get_running_loop()
    with _lock:
        _subscribers.setdefault(meeting_id, set()).add((q, loop))
    return q


def unsubscribe(meeting_id: str, queue: asyncio.Queue) -> None:
    """Remove a subscriber queue when the WebSocket disconnects."""
    with _lock:
        subs = _subscribers.get(meeting_id)
        if not subs:
            return
        for entry in list(subs):
            if entry[0] is queue:
                subs.discard(entry)
        if not subs:
            _subscribers.pop(meeting_id, None)
