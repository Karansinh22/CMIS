"""
routers/live.py — Live microphone meetings.

    POST /meetings/live              create a meeting that will be recorded live
    WS   /ws/live/{meeting_id}       stream audio into it

WebSocket protocol (client → server):
    text   {"type": "start", "sample_rate": 16000}     once, before any audio
    binary <int16 little-endian mono PCM at 16 kHz>    as often as you like (≈250 ms frames)
    text   {"type": "stop"}                            end the recording

Server → client on the same socket:
    {"type": "ready"}                                  after "start"
    {"type": "ack", "seconds": 12.5}                   roughly once per second of audio
    {"type": "stopped"}                                recording accepted; processing continues
    {"type": "error", "message": "..."}

Transcript lines, stage changes and the final result are delivered on the
regular ``/ws/status/{meeting_id}`` stream, exactly as for uploads.
"""

from __future__ import annotations

import json
import logging
import uuid
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, WebSocket, WebSocketDisconnect
from pydantic import BaseModel
from sqlalchemy.orm import Session

from auth.dependencies import get_optional_user
from db import crud
from db.database import get_db
from db.models import Meeting, User
from db.schemas import MeetingOut
from ingestion.live import SAMPLE_RATE, get_session, start_session

logger = logging.getLogger(__name__)
router = APIRouter(tags=["Live"])


class LiveMeetingCreate(BaseModel):
    title: str
    summary_type: Optional[str] = "balanced"
    project_id: Optional[str] = None


@router.post("/meetings/live", response_model=MeetingOut, status_code=201)
def create_live_meeting(
    data: LiveMeetingCreate,
    db: Session = Depends(get_db),
    current_user: Optional[User] = Depends(get_optional_user),
):
    """Create a meeting record for a live recording. Connect to /ws/live/{id} next."""
    from jobs.worker import update_status

    meeting = Meeting(
        id=str(uuid.uuid4()),
        title=data.title.strip() or "Live meeting",
        status="queued",
        summary_type=data.summary_type or "balanced",
        project_id=data.project_id,
        user_id=current_user.id if current_user else None,
        source="live",
    )
    db.add(meeting)
    db.commit()
    db.refresh(meeting)
    update_status(meeting.id, "queued", "Waiting for microphone…", progress=0.0)
    return meeting


@router.websocket("/ws/live/{meeting_id}")
async def live_audio(websocket: WebSocket, meeting_id: str, db: Session = Depends(get_db)):
    await websocket.accept()

    meeting = crud.get_meeting(db, meeting_id)
    if not meeting:
        await websocket.send_text(json.dumps({"type": "error", "message": "Meeting not found."}))
        await websocket.close(code=4004)
        return
    if meeting.status not in ("queued",) and get_session(meeting_id) is None:
        await websocket.send_text(json.dumps({"type": "error", "message": "This meeting is not accepting live audio."}))
        await websocket.close(code=4009)
        return

    session = None
    last_ack = 0.0
    try:
        while True:
            message = await websocket.receive()
            if message.get("type") == "websocket.disconnect":
                raise WebSocketDisconnect()

            if message.get("bytes") is not None:
                if session is None:
                    await websocket.send_text(json.dumps({"type": "error", "message": "Send {\"type\": \"start\"} first."}))
                    continue
                session.feed(message["bytes"])
                if session.total_seconds - last_ack >= 1.0:
                    last_ack = session.total_seconds
                    await websocket.send_text(json.dumps({"type": "ack", "seconds": round(session.total_seconds, 1)}))
                continue

            text = message.get("text")
            if not text:
                continue
            try:
                cmd = json.loads(text)
            except json.JSONDecodeError:
                continue

            if cmd.get("type") == "start":
                if int(cmd.get("sample_rate", SAMPLE_RATE)) != SAMPLE_RATE:
                    await websocket.send_text(json.dumps({"type": "error", "message": f"Audio must be {SAMPLE_RATE} Hz mono int16."}))
                    continue
                if session is None:
                    session = get_session(meeting_id) or start_session(meeting_id)
                await websocket.send_text(json.dumps({"type": "ready"}))
            elif cmd.get("type") == "stop":
                if session is not None:
                    session.stop()
                await websocket.send_text(json.dumps({"type": "stopped"}))
                break

    except WebSocketDisconnect:
        if session is not None and not session.finished:
            session.abort("client disconnected")
    except Exception as exc:  # noqa: BLE001
        logger.exception("Live socket for %s failed: %s", meeting_id, exc)
        if session is not None and not session.finished:
            session.abort(str(exc))
    finally:
        try:
            await websocket.close()
        except Exception:  # noqa: BLE001
            pass
