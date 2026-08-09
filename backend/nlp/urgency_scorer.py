"""
nlp/urgency_scorer.py — 4-class urgency scorer for action items.

Classes: critical | high | medium | low

Uses a weighted multi-pattern system covering:
  - Temporal proximity signals (today, tomorrow, ASAP)
  - Explicit urgency vocabulary (critical, blocker, P0)
  - Deadline language (due by, end of week)
  - Impact language (production, client, release)
  - Implicit signals (escalation verbs, stakeholder mentions)
"""

from __future__ import annotations

import re
from typing import Literal

UrgencyLevel = Literal["critical", "high", "medium", "low"]

# ── Weighted pattern groups ───────────────────────────────────────────────────

_CRITICAL_PATTERNS = [
    # Immediate temporal signals
    (re.compile(r"\b(asap|as soon as possible|right now|immediately|right away|this instant|now)\b", re.IGNORECASE), 5),
    (re.compile(r"\b(today|tonight|within (the )?hour|this morning|this afternoon|this evening)\b", re.IGNORECASE), 4),
    # System/production issues
    (re.compile(r"\b(outage|down|crash(ed|ing)?|production (is )?(down|broken|failing)|incident|disaster|data loss)\b", re.IGNORECASE), 5),
    # Explicit severity
    (re.compile(r"\b(critical|blocker|blocking|p0|priority zero|severity 0|s0|sev0|show ?stopper)\b", re.IGNORECASE), 5),
    # Emergency / escalation
    (re.compile(r"\b(emergency|urgent(ly)?|escalat(e|ed|ing)|fire ?drill|all hands|immediate(ly)?)\b", re.IGNORECASE), 4),
    (re.compile(r"[!]{2,}"), 3),  # multiple exclamation marks
]

_HIGH_PATTERNS = [
    # Near-term deadlines
    (re.compile(r"\b(tomorrow|by (eod|end of day|end of business|cob)|tonight|by (midnight|noon))\b", re.IGNORECASE), 4),
    (re.compile(r"\b(this week|by (friday|thursday|wednesday)|next (morning|day)|in (24|48) hours?)\b", re.IGNORECASE), 3),
    # Explicit high priority
    (re.compile(r"\b(high priority|p1|priority one|severity 1|s1|sev1|high[- ]?urgency)\b", re.IGNORECASE), 4),
    # Client / stakeholder mention
    (re.compile(r"\b(client|customer|executive|ceo|cto|vp|board|investor|partner)\b", re.IGNORECASE), 3),
    # Release / deployment window
    (re.compile(r"\b(release|deploy(ment)?|go[- ]?live|launch|cut[- ]?over|sprint (end|deadline))\b", re.IGNORECASE), 3),
    # Strong obligation
    (re.compile(r"\b(must(n'?t)?|have to|non[- ]?negotiable|cannot wait|can't wait|no (later|further) delay)\b", re.IGNORECASE), 3),
]

_MEDIUM_PATTERNS = [
    # Upcoming week
    (re.compile(r"\b(next week|by (monday|tuesday)|end of (month|sprint)|upcoming (meeting|review|demo))\b", re.IGNORECASE), 2),
    # Standard priority signals
    (re.compile(r"\b(important|medium priority|p2|priority two|moderate|due (date|by)|deadline)\b", re.IGNORECASE), 2),
    # Soft obligation
    (re.compile(r"\b(should|ought to|please|kindly|ideally|preferably|don'?t (forget|delay|miss))\b", re.IGNORECASE), 2),
    # Business impact
    (re.compile(r"\b(impact(ing)?|affect(s|ing)?|risk|depends on|dependency|blocker for)\b", re.IGNORECASE), 2),
    # Review / approval cycles
    (re.compile(r"\b(review(ed)?|sign[- ]?off|approval|approv(e|al)|sign[- ]?off|feedback|confirm(ation)?)\b", re.IGNORECASE), 1),
]

# Low is the default when cumulative score < threshold.


def _score(text: str, patterns: list) -> int:
    return sum(weight for pat, weight in patterns if pat.search(text))


def score_urgency(text: str) -> UrgencyLevel:
    """
    Score the urgency of an action item text using weighted multi-pattern matching.

    Returns 'critical', 'high', 'medium', or 'low'.
    """
    critical_score = _score(text, _CRITICAL_PATTERNS)
    high_score = _score(text, _HIGH_PATTERNS)
    medium_score = _score(text, _MEDIUM_PATTERNS)

    # Critical threshold: any explicit critical signal
    if critical_score >= 4:
        return "critical"

    # High threshold: strong signals or combination
    if high_score >= 3 or (critical_score >= 2 and high_score >= 1):
        return "high"

    # Medium threshold
    if medium_score >= 2 or high_score >= 1:
        return "medium"

    return "low"
