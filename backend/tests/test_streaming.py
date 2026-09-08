"""
tests/test_streaming.py — The ingestion pipeline persists and publishes
transcript segments while Whisper is still running.
"""

from __future__ import annotations

from unittest.mock import MagicMock, patch

from db.models import Meeting, TranscriptSegment
from ingestion.transcriber import RawSegment


def _fake_stream(*_args, **kwargs):
    on_progress = kwargs.get("on_progress")
    for i in range(7):
        if on_progress:
            on_progress((i + 1) / 7)
        yield RawSegment(f"Sentence number {i}.", float(i), float(i) + 0.9)


def test_segments_are_persisted_incrementally_and_published(db, sample_wav, monkeypatch):
    from config import settings
    from ingestion import pipeline as ingestion_pipeline
    from jobs import worker

    monkeypatch.setattr(settings, "transcript_flush_segments", 3)
    monkeypatch.setattr(settings, "transcript_flush_seconds", 999.0)

    meeting = Meeting(title="stream test", status="queued")
    db.add(meeting)
    db.commit()

    published = []
    monkeypatch.setattr(worker, "publish_segments", lambda mid, segs, progress=None: published.append((len(segs), progress)))
    monkeypatch.setattr(worker, "publish", lambda mid, event: None)
    monkeypatch.setattr(worker, "update_status", lambda *a, **k: None)

    counts_seen = []
    real_flush_commit = db.commit

    def counting_commit():
        real_flush_commit()
        counts_seen.append(db.query(TranscriptSegment).filter_by(meeting_id=meeting.id).count())

    with patch.object(ingestion_pipeline, "transcribe_stream", _fake_stream), \
         patch.object(ingestion_pipeline, "diarize", return_value=[]), \
         patch.object(ingestion_pipeline, "validate_and_prepare", return_value=sample_wav), \
         patch.object(ingestion_pipeline, "to_wav_16k_mono", return_value=sample_wav), \
         patch.object(db, "commit", counting_commit):
        ingestion_pipeline.run_ingestion(sample_wav, meeting.id, db)

    # 7 segments flushed in batches of 3 → 3, 3, 1
    assert [n for n, _ in published] == [3, 3, 1]
    # Progress was reported and increased
    progresses = [p for _, p in published]
    assert progresses == sorted(progresses) and progresses[-1] == 1.0
    # DB grew incrementally (not all at once at the end)
    assert 3 in counts_seen and 6 in counts_seen and 7 in counts_seen

    segs = db.query(TranscriptSegment).filter_by(meeting_id=meeting.id).order_by(TranscriptSegment.segment_index).all()
    assert [s.segment_index for s in segs] == list(range(7))
    assert db.get(Meeting, meeting.id).status == "structuring"


def test_diarization_relabels_persisted_segments(db, sample_wav, monkeypatch):
    from config import settings
    from ingestion import pipeline as ingestion_pipeline
    from ingestion.diarizer import SpeakerTurn
    from jobs import worker

    monkeypatch.setattr(settings, "transcript_flush_segments", 100)
    events = []
    monkeypatch.setattr(worker, "publish_segments", lambda *a, **k: None)
    monkeypatch.setattr(worker, "publish", lambda mid, event: events.append(event))
    monkeypatch.setattr(worker, "update_status", lambda *a, **k: None)

    meeting = Meeting(title="diar test", status="queued")
    db.add(meeting)
    db.commit()

    turns = [SpeakerTurn("SPEAKER_00", 0.0, 3.5), SpeakerTurn("SPEAKER_01", 3.5, 8.0)]
    with patch.object(ingestion_pipeline, "transcribe_stream", _fake_stream), \
         patch.object(ingestion_pipeline, "diarize", return_value=turns), \
         patch.object(ingestion_pipeline, "validate_and_prepare", return_value=sample_wav), \
         patch.object(ingestion_pipeline, "to_wav_16k_mono", return_value=sample_wav):
        ingestion_pipeline.run_ingestion(sample_wav, meeting.id, db)

    segs = db.query(TranscriptSegment).filter_by(meeting_id=meeting.id).order_by(TranscriptSegment.segment_index).all()
    labels = [s.speaker.label for s in segs]
    assert labels[:3] == ["SPEAKER_00"] * 3
    assert labels[4:] == ["SPEAKER_01"] * 3
    assert any(e.get("type") == "transcript_ready" for e in events)
