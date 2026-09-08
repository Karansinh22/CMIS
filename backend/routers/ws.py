"""
routers/ws.py — WebSocket endpoint for real-time processing events.

Endpoint:
    WS /ws/status/{meeting_id}

Pushes JSON events (see jobs/worker.py for the full list):

    { "type": "status",   "meeting_id": "...", "status": "transcribing", "message": "...", "progress": 0.3 }
    { "type": "segments", "meeting_id": "...", "segments": [ ... ], "progress": 0.3 }
    { "type": "transcript_ready", ... }   # diarization finished → speaker labels changed
    { "type": "context_ready", ... }      # NLP output available via GET /context/{id}
    { "type": "ping" }                    # keepalive

Status sequence: queued → transcribing → structuring → done | error
"""

from __future__ import annotations

import asyncio
import json
import logging

from fastapi import APIRouter, WebSocket, WebSocketDisconnect

from jobs.worker import get_status, subscribe, unsubscribe

logger = logging.getLogger(__name__)
router = APIRouter(tags=["WebSocket"])


@router.websocket("/ws/status/{meeting_id}")
async def websocket_status(websocket: WebSocket, meeting_id: str):
    """
    Connects a client to a real-time event stream for one meeting.

    Immediately sends the current status (so clients connecting after processing
    has started don't miss the stage they're in — they should fetch already
    persisted transcript segments over REST), then streams events until
    done/error.
    """
    await websocket.accept()
    logger.info("WS client connected for meeting %s.", meeting_id)

    queue = subscribe(meeting_id)
    try:
        current = get_status(meeting_id)
        if current:
            await websocket.send_text(
                json.dumps({"type": "status", "meeting_id": meeting_id, **current})
            )

        while True:
            try:
                event = await asyncio.wait_for(queue.get(), timeout=30.0)
                await websocket.send_text(json.dumps(event))
                if event.get("type") == "status" and event.get("status") in ("done", "error"):
                    break
            except asyncio.TimeoutError:
                await websocket.send_text(
                    json.dumps({"type": "ping", "meeting_id": meeting_id, "status": "ping"})
                )

    except WebSocketDisconnect:
        logger.info("WS client disconnected from meeting %s.", meeting_id)
    except Exception as exc:  # noqa: BLE001
        logger.debug("WS stream for meeting %s ended: %s", meeting_id, exc)
    finally:
        unsubscribe(meeting_id, queue)
