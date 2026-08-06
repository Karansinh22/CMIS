"""
urgency_scorer.py — 3-class urgency scorer for action items.

Classes: low | medium | high
Method: rule-based keyword and pattern matching.
"""

from __future__ import annotations

import re
from typing import Literal

UrgencyLevel = Literal["low", "medium", "high"]

# ── Keyword patterns ──────────────────────────────────────────────────────────

_HIGH_PATTERNS = [
    re.compile(r"\b(asap|as soon as possible|urgent|urgently|immediately|critical|emergency|blocker|blocking|p0|priority zero)\b", re.IGNORECASE),
    re.compile(r"\b(today|tonight|this afternoon|within the hour|right now)\b", re.IGNORECASE),
    re.compile(r"\b(deadline (is |was )?(today|tomorrow|this week))\b", re.IGNORECASE),
    re.compile(r"[!]{2,}"),   # multiple exclamation marks signal urgency
]

_MEDIUM_PATTERNS = [
    re.compile(r"\b(soon|shortly|this week|by (end of )?(day|week)|next (monday|tuesday|wednesday|thursday|friday))\b", re.IGNORECASE),
    re.compile(r"\b(important|priority|high priority|p1)\b", re.IGNORECASE),
    re.compile(r"\b(deadline|due date|due by)\b", re.IGNORECASE),
    re.compile(r"\b(don'?t (delay|forget|miss))\b", re.IGNORECASE),
]

# Low is the default when neither high nor medium patterns match.


def score_urgency(text: str) -> UrgencyLevel:
    """
    Score the urgency of an action item text.

    Returns "high", "medium", or "low".
    """
    high_hits = sum(bool(p.search(text)) for p in _HIGH_PATTERNS)
    if high_hits > 0:
        return "high"

    medium_hits = sum(bool(p.search(text)) for p in _MEDIUM_PATTERNS)
    if medium_hits > 0:
        return "medium"

    return "low"
