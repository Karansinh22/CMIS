"""
tests/test_transcription.py — Integration tests for the transcription pipeline.

These tests mock faster-whisper to avoid requiring model downloads in CI.
To run against the real Whisper model, set CMIS_REAL_TRANSCRIPTION=1.
"""

from __future__ import annotations

import os
from pathlib import Path
from unittest.mock import MagicMock, patch

import pytest


# ── Mocked transcription (default, no model download needed) ──────────────────

class TestTranscriberMocked:
    """Tests that run without downloading Whisper weights."""

    def test_transcribe_returns_segments(self, sample_wav):
        """Mock the WhisperModel and verify the transcriber wraps output correctly."""
        from ingestion.transcriber import RawSegment

        fake_seg = MagicMock()
        fake_seg.text = " Hello world"
        fake_seg.start = 0.0
        fake_seg.end = 1.5

        fake_info = MagicMock()
        fake_info.language = "en"
        fake_info.language_probability = 0.99

        fake_model = MagicMock()
        fake_model.transcribe.return_value = ([fake_seg], fake_info)

        with patch("ingestion.transcriber._model_cache", {"small": fake_model}):
            from ingestion.transcriber import transcribe
            segments = transcribe(sample_wav, model_name="small")

        assert len(segments) == 1
        assert isinstance(segments[0], RawSegment)
        assert segments[0].text == "Hello world"
        assert segments[0].start == pytest.approx(0.0)
        assert segments[0].end == pytest.approx(1.5)

    def test_transcribe_filters_empty_segments(self, sample_wav):
        """Segments with empty text should be excluded from results."""
        fake_seg_empty = MagicMock()
        fake_seg_empty.text = "   "
        fake_seg_empty.start = 0.0
        fake_seg_empty.end = 0.5

        fake_info = MagicMock()
        fake_info.language = "en"
        fake_info.language_probability = 0.95

        fake_model = MagicMock()
        fake_model.transcribe.return_value = ([fake_seg_empty], fake_info)

        with patch("ingestion.transcriber._model_cache", {"small": fake_model}):
            from ingestion.transcriber import transcribe
            segments = transcribe(sample_wav, model_name="small")

        assert segments == []


# ── Diarization merge tests ───────────────────────────────────────────────────

class TestDiarizationMerge:
    def test_merge_assigns_correct_speaker(self):
        from ingestion.diarizer import LabelledSegment, SpeakerTurn
        from ingestion.diarizer import merge_transcript_with_diarization
        from ingestion.transcriber import RawSegment

        whisper_segs = [
            RawSegment("Hello team", 0.0, 2.0),
            RawSegment("Let's get started", 2.5, 4.5),
        ]
        diar_turns = [
            SpeakerTurn(speaker="SPEAKER_00", start=0.0, end=2.0),
            SpeakerTurn(speaker="SPEAKER_01", start=2.5, end=4.5),
        ]

        labelled = merge_transcript_with_diarization(whisper_segs, diar_turns)

        assert len(labelled) == 2
        assert labelled[0].speaker == "SPEAKER_00"
        assert labelled[1].speaker == "SPEAKER_01"

    def test_merge_fallback_when_no_turns(self):
        from ingestion.diarizer import merge_transcript_with_diarization
        from ingestion.transcriber import RawSegment

        whisper_segs = [RawSegment("No speaker info", 0.0, 3.0)]
        labelled = merge_transcript_with_diarization(whisper_segs, diarization_turns=[])

        assert labelled[0].speaker == "SPEAKER_00"


# ── API endpoint tests (mocked pipeline) ─────────────────────────────────────

class TestMeetingsAPI:
    def test_upload_creates_meeting(self, client, sample_wav, monkeypatch):
        """Upload endpoint should return 202 with a meeting ID."""
        # Patch out the background pipeline so it doesn't actually run
        monkeypatch.setattr(
            "routers.meetings._process_meeting",
            lambda *args, **kwargs: None,
        )

        with open(sample_wav, "rb") as f:
            resp = client.post(
                "/meetings/upload",
                data={"title": "Test Meeting"},
                files={"file": ("test.wav", f, "audio/wav")},
            )

        assert resp.status_code == 202
        data = resp.json()
        assert "id" in data
        assert data["title"] == "Test Meeting"
        assert data["status"] in ("queued", "transcribing")

    def test_list_meetings(self, client):
        resp = client.get("/meetings/")
        assert resp.status_code == 200
        assert isinstance(resp.json(), list)

    def test_get_nonexistent_meeting_404(self, client):
        resp = client.get("/meetings/nonexistent-id")
        assert resp.status_code == 404
