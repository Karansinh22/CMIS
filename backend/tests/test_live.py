"""
tests/test_live.py — Live microphone streaming: chunking at pauses, incremental
persistence, and the WebSocket protocol end to end (Whisper mocked).
"""

from __future__ import annotations

import json
import time
from unittest.mock import patch

import numpy as np

from db.models import Meeting, TranscriptSegment
from ingestion.transcriber import RawSegment


def _pcm(seconds: float, loud: bool, rate: int = 16000) -> bytes:
    n = int(seconds * rate)
    if loud:
        t = np.arange(n) / rate
        sig = (0.3 * np.sin(2 * np.pi * 220 * t)).astype(np.float32)
    else:
        sig = np.zeros(n, dtype=np.float32)
    return (sig * 32767).astype(np.int16).tobytes()


def _fake_transcribe(audio, time_offset=0.0, initial_prompt=None, **_):
    """One segment per chunk, so we can see how the audio was cut."""
    seconds = len(audio) / 16000.0
    yield RawSegment(f"chunk at {time_offset:.1f}s lasting {seconds:.1f}s", time_offset, time_offset + seconds)


def test_chunks_are_cut_at_pauses(monkeypatch):
    from config import settings
    from ingestion import live

    monkeypatch.setattr(settings, "live_min_chunk_seconds", 2.0)
    monkeypatch.setattr(settings, "live_max_chunk_seconds", 10.0)
    monkeypatch.setattr(settings, "live_silence_seconds", 0.5)

    session = live.LiveSession.__new__(live.LiveSession)
    session._pcm = bytearray()
    session._lock = __import__("threading").Lock()

    # 3 s of speech, 1 s pause, 1 s of speech → first chunk should end inside the pause
    session._pcm.extend(_pcm(3.0, True) + _pcm(1.0, False) + _pcm(1.0, True))
    chunk = session._take_chunk()
    assert chunk is not None
    cut_seconds = len(chunk) / 16000
    assert 3.0 <= cut_seconds <= 4.0

    # remaining 1 s of speech is below the minimum → wait, unless forced
    assert session._take_chunk() is None
    forced = session._take_chunk(force=True)
    assert forced is not None and abs(len(forced) / 16000 - (5.0 - cut_seconds)) < 0.05


def test_live_websocket_end_to_end(client, db, monkeypatch, tmp_path):
    from config import settings
    from ingestion import live
    from jobs import worker

    monkeypatch.setattr(settings, "upload_dir", tmp_path)
    monkeypatch.setattr(settings, "live_min_chunk_seconds", 1.0)
    monkeypatch.setattr(settings, "live_silence_seconds", 0.3)
    monkeypatch.setattr(settings, "lsh_index_path", tmp_path / "lsh.pkl")
    events = []
    monkeypatch.setattr(worker, "publish", lambda mid, ev: events.append(ev))

    # The worker thread uses its own SessionLocal; point it at the test session's engine.
    monkeypatch.setattr(live, "SessionLocal", lambda: db)
    real_close = db.close
    monkeypatch.setattr(db, "close", lambda: None)   # the fixture closes it

    res = client.post("/meetings/live", json={"title": "Standup", "summary_type": "brief"})
    assert res.status_code == 201
    meeting_id = res.json()["id"]
    assert res.json()["source"] == "live"

    with patch.object(live, "transcribe_stream", _fake_transcribe), \
         patch("ingestion.pipeline.diarize", return_value=[]):
        with client.websocket_connect(f"/ws/live/{meeting_id}") as ws:
            ws.send_text(json.dumps({"type": "start", "sample_rate": 16000}))
            assert json.loads(ws.receive_text())["type"] == "ready"
            # 2 s speech, pause, 2 s speech, pause
            for _ in range(2):
                ws.send_bytes(_pcm(2.0, True))
                ws.send_bytes(_pcm(0.5, False))
            # drain acks
            time.sleep(0.2)
            ws.send_text(json.dumps({"type": "stop"}))
            msgs = []
            for _ in range(10):
                m = json.loads(ws.receive_text())
                msgs.append(m["type"])
                if m["type"] == "stopped":
                    break
            assert "stopped" in msgs

        # wait for the worker thread to finalise
        for _ in range(100):
            session = live.get_session(meeting_id)
            if session is None:
                break
            time.sleep(0.1)

    meeting = db.get(Meeting, meeting_id)
    assert meeting.status == "done", getattr(live.get_session(meeting_id), "error", None)
    assert meeting.audio_path and meeting.audio_path.endswith("_live_16k.wav")

    segs = db.query(TranscriptSegment).filter_by(meeting_id=meeting_id).order_by(TranscriptSegment.segment_index).all()
    assert len(segs) >= 2, [s.text for s in segs]
    # timestamps continue across chunks
    assert segs[0].start_time == 0.0 and segs[1].start_time > segs[0].start_time
    assert segs[-1].end_time <= 5.5

    types = [e.get("type") for e in events]
    assert "context_ready" in types
    real_close()
