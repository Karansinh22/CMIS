"""
routers/ws.py — WebSocket endpoint for real-time processing status.

Endpoint:
    WS /ws/status/{meeting_id}

Pushes JSON status events:
    { "meeting_id": "...", "status": "transcribing", "message": "..." }

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
    Connects a client to a real-time status stream for one meeting.

    Immediately sends the current status (so clients connecting after processing
    has started don't miss updates), then streams updates until done/error.
    """
    await websocket.accept()
    logger.info("WS client connected for meeting %s.", meeting_id)

    queue = subscribe(meeting_id)
    try:
        # Send current status immediately (so late-connecting clients are not lost)
        current = get_status(meeting_id)
        if current:
            await websocket.send_text(
                json.dumps({"meeting_id": meeting_id, **current})
            )

        # Stream updates from the queue
        while True:
            try:
                event = await asyncio.wait_for(queue.get(), timeout=30.0)
                await websocket.send_text(json.dumps(event))
                if event.get("status") in ("done", "error"):
                    break
            except asyncio.TimeoutError:
                # Send a keepalive ping so the connection doesn't drop
                await websocket.send_text(
                    json.dumps({"meeting_id": meeting_id, "status": "ping"})
                )

    except WebSocketDisconnect:
        logger.info("WS client disconnected from meeting %s.", meeting_id)
    finally:
        unsubscribe(meeting_id, queue)
