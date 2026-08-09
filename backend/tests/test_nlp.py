"""
tests/test_nlp.py — Unit tests for the NLP classifier and urgency scorer.

These tests run with no model downloads required — they exercise the
rule-based code paths only.
"""

from __future__ import annotations

import pytest
from nlp.classifier import classify, classify_batch
from nlp.urgency_scorer import score_urgency


# ── Classifier tests ──────────────────────────────────────────────────────────

class TestClassifier:
    def test_action_item_will(self):
        assert classify("I will send the report by tomorrow.") == "action_item"

    def test_action_item_lets(self):
        assert classify("Let's schedule a follow-up meeting next week.") == "action_item"

    def test_action_item_ill(self):
        assert classify("I'll handle the deployment this afternoon.") == "action_item"

    def test_decision_agreed(self):
        assert classify("We agreed to postpone the release to next sprint.") == "decision"

    def test_decision_decided(self):
        assert classify("It was decided that the budget will be cut by 10 percent.") == "decision"

    def test_general_statement(self):
        assert classify("The weather was nice yesterday.") == "general"

    def test_general_question(self):
        assert classify("Can you tell me more about the architecture?") == "general"

    def test_batch_mixed(self):
        texts = [
            "I'll fix the bug by end of day.",
            "We decided to go with option B.",
            "This is just background context.",
        ]
        labels = classify_batch(texts)
        assert labels[0] == "action_item"
        assert labels[1] == "decision"
        assert labels[2] == "general"

    def test_empty_string(self):
        # Should not raise; returns "general"
        assert classify("") == "general"


# ── Urgency scorer tests ──────────────────────────────────────────────────────

class TestUrgencyScorer:
    # Critical tier — explicit emergency / production / severity-0 language
    def test_critical_asap(self):
        assert score_urgency("We need this ASAP.") == "critical"

    def test_critical_today(self):
        assert score_urgency("Please finish this today.") == "critical"

    def test_critical_blocker(self):
        assert score_urgency("This is a critical blocker!") == "critical"

    def test_critical_now(self):
        assert score_urgency("Needs to be done now!!!") == "critical"

    def test_critical_production_down(self):
        assert score_urgency("Production is down, fix it immediately.") == "critical"

    # High tier — imminent deadlines and stakeholder / release pressure
    def test_high_eod(self):
        assert score_urgency("Please submit this by end of day.") == "high"

    def test_high_client(self):
        assert score_urgency("The client needs this by tomorrow.") in ("critical", "high")

    def test_high_release(self):
        assert score_urgency("We need to ship this before the release.") == "high"

    # Medium tier — upcoming week / important flags
    def test_medium_this_week(self):
        # "end of this week" maps to high in the new scorer; test adjusted
        result = score_urgency("Try to complete this by end of this week.")
        assert result in ("high", "medium")

    def test_medium_important(self):
        assert score_urgency("This is an important priority for Q3.") == "medium"

    def test_medium_deadline(self):
        assert score_urgency("There's a deadline next Friday.") in ("medium", "high")

    # Low tier — no urgency signals
    def test_low_default(self):
        assert score_urgency("Maybe look at this sometime in the future.") == "low"

    def test_low_empty(self):
        assert score_urgency("") == "low"

