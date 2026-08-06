"""
tests/test_recurring.py — Tests for MinHash/LSH recurring-topic detection.
"""

from __future__ import annotations

import pytest


# Reset LSH state between tests by clearing the module-level caches
@pytest.fixture(autouse=True)
def reset_lsh(tmp_path, monkeypatch):
    """Redirect LSH index to a temp file and reset module state."""
    lsh_file = tmp_path / "lsh_test.pkl"
    monkeypatch.setenv("LSH_INDEX_PATH", str(lsh_file))

    import config
    import nlp.recurring as rec_module

    monkeypatch.setattr(config.settings, "lsh_index_path", lsh_file)
    rec_module._lsh = None
    rec_module._topic_signatures = {}
    yield
    rec_module._lsh = None
    rec_module._topic_signatures = {}


def test_first_topic_not_recurring():
    """A topic seen for the first time should NOT be flagged as recurring."""
    from nlp.recurring import check_and_register_topic

    is_recurring, prev_id = check_and_register_topic(
        topic_id="topic-001",
        topic_text="budget planning quarterly review expenses forecast",
        current_meeting_id="meeting-001",
    )
    assert is_recurring is False
    assert prev_id is None


def test_identical_topic_in_new_meeting_is_recurring():
    """
    The same topic text appearing in a second meeting should be flagged recurring.
    """
    from nlp.recurring import check_and_register_topic

    shared_text = "project deadline sprint backlog planning task assignment review"

    # First meeting — register topic
    is_rec1, prev1 = check_and_register_topic(
        topic_id="topic-A",
        topic_text=shared_text,
        current_meeting_id="meeting-111",
    )
    assert is_rec1 is False

    # Second meeting — similar topic should be detected
    is_rec2, prev2 = check_and_register_topic(
        topic_id="topic-B",
        topic_text=shared_text,
        current_meeting_id="meeting-222",   # different meeting!
    )
    assert is_rec2 is True
    assert prev2 is not None


def test_unrelated_topic_not_recurring():
    """Two topics with very different content should NOT match."""
    from nlp.recurring import check_and_register_topic

    check_and_register_topic(
        topic_id="topic-X",
        topic_text="annual company picnic event food beverages venue booking",
        current_meeting_id="meeting-AAA",
    )

    is_rec, _ = check_and_register_topic(
        topic_id="topic-Y",
        topic_text="machine learning model training accuracy loss backpropagation",
        current_meeting_id="meeting-BBB",
    )
    assert is_rec is False


def test_same_meeting_not_flagged():
    """Topics from the SAME meeting should not flag each other as recurring."""
    from nlp.recurring import check_and_register_topic

    shared_text = "release management deployment pipeline CI CD testing"

    check_and_register_topic("t1", shared_text, "meeting-SAME")
    is_rec, _ = check_and_register_topic("t2", shared_text, "meeting-SAME")
    # Same meeting → should not be recurring
    assert is_rec is False
