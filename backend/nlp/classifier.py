"""
nlp/classifier.py — Segment classifier for action_item, decision, or general.

Stage 1 (always active): Multi-signal rule-based classification with:
  - Weighted keyword/phrase pattern matching
  - Linguistic cue extraction (modal verbs, deontic language)
  - Negation awareness
  - Context-sensitive tie-breaking

Stage 2 (optional): scikit-learn logistic regression on TF-IDF features.
                    Activated when a trained model file exists at MODEL_PATH.
"""

from __future__ import annotations

import logging
import pickle
import re
from pathlib import Path
from typing import List, Literal

logger = logging.getLogger(__name__)

SegmentType = Literal["action_item", "decision", "general"]

# ── Paths ─────────────────────────────────────────────────────────────────────

MODEL_PATH = Path(__file__).parent / "classifier_model.pkl"

# ── Action-item patterns (weighted) ──────────────────────────────────────────

_ACTION_PATTERNS = [
    # Strong deontic / commitment markers
    (re.compile(r"\b(I'?ll|I will|I am going to|I need to|I must|I should)\b", re.IGNORECASE), 3),
    (re.compile(r"\b(we'?ll|we will|we are going to|we need to|we must)\b", re.IGNORECASE), 2),
    # Explicit task/assignment language
    (re.compile(r"\b(assign(ed)?|responsible for|in charge of|owner|point of contact)\b", re.IGNORECASE), 3),
    (re.compile(r"\b(action item|follow[- ]?up|todo|to-do|next step|task)\b", re.IGNORECASE), 4),
    # Deadline language
    (re.compile(r"\b(by (monday|tuesday|wednesday|thursday|friday|saturday|sunday|eod|end of (day|week|month)|tomorrow|next week|this friday))\b", re.IGNORECASE), 3),
    (re.compile(r"\b(before (the|next) (meeting|sprint|release|deadline|review))\b", re.IGNORECASE), 3),
    (re.compile(r"\b(due (by|on|date)|deadline (is|on))\b", re.IGNORECASE), 2),
    # Verb-based obligation
    (re.compile(r"\b(needs? to|have to|has to|must|shall|ought to|required to|supposed to)\b", re.IGNORECASE), 2),
    (re.compile(r"\b(going to|going to be|plan(s)? to|intend(s)? to|aim(s)? to)\b", re.IGNORECASE), 1),
    # Person + verb patterns: "Karan will submit..."
    (re.compile(r"\b([A-Z][a-z]+)\s+(will|shall|must|needs? to|is going to|has to)\b"), 3),
    # Review/prepare/submit/send verbs
    (re.compile(r"\b(prepare|submit|send|share|complete|finish|update|review|check|confirm|schedule|set up|draft|write|test|deploy|implement|create|build|design|document|present|research|investigate|analyse|analyze|validate|coordinate|communicate|notify|escalate|migrate|fix|resolve)\b", re.IGNORECASE), 1),
]

# ── Decision patterns (weighted) ──────────────────────────────────────────────

_DECISION_PATTERNS = [
    # Explicit decision markers
    (re.compile(r"\b(decided|decision|has been decided|have decided|reached a decision)\b", re.IGNORECASE), 4),
    (re.compile(r"\b(agreed|agreement|reached agreement|are in agreement)\b", re.IGNORECASE), 4),
    (re.compile(r"\b(confirmed|confirmation|finalized|finalised|approved|approval|signed off|signed-off)\b", re.IGNORECASE), 3),
    (re.compile(r"\b(resolved|resolution|settled|concluded|voted|consensus|ruling)\b", re.IGNORECASE), 3),
    # Passive constructions
    (re.compile(r"\b(it (has been|was) (decided|agreed|resolved|confirmed|approved))\b", re.IGNORECASE), 5),
    (re.compile(r"\b(we (have )?(decided|agreed|confirmed|resolved|concluded|approved))\b", re.IGNORECASE), 4),
    # Going-forward / policy language
    (re.compile(r"\b(going forward|from now on|as of (today|now)|henceforth|the policy is|our approach will be)\b", re.IGNORECASE), 3),
    (re.compile(r"\b(will (be|use|adopt|implement|follow|proceed|continue|move))\b", re.IGNORECASE), 1),
    # Outcome / conclusion language
    (re.compile(r"\b(outcome|conclusion|result(ed in)?|end (result|state)|final(ly)? decided|the choice is)\b", re.IGNORECASE), 3),
]

# ── Negation detector ─────────────────────────────────────────────────────────

_NEGATION_RE = re.compile(
    r"\b(not|no|never|neither|nor|don'?t|doesn'?t|didn'?t|won'?t|can'?t|haven'?t|hadn'?t|isn'?t|aren'?t|wasn'?t|weren'?t)\b",
    re.IGNORECASE,
)

_QUESTION_RE = re.compile(r"\?\s*$")


def _weighted_score(text: str, patterns: list) -> float:
    """Sum weighted pattern matches."""
    return sum(weight for pat, weight in patterns if pat.search(text))


def _has_negation(text: str) -> bool:
    return bool(_NEGATION_RE.search(text))


def _is_question(text: str) -> bool:
    return bool(_QUESTION_RE.search(text))


def _rule_based_classify(text: str) -> SegmentType:
    """Multi-signal weighted rule-based classification."""
    # Questions are almost always general
    if _is_question(text):
        return "general"

    action_score = _weighted_score(text, _ACTION_PATTERNS)
    decision_score = _weighted_score(text, _DECISION_PATTERNS)

    # Negation reduces the dominant score
    if _has_negation(text):
        if decision_score > action_score:
            decision_score = max(0, decision_score - 2)
        else:
            action_score = max(0, action_score - 1)

    # Classification with minimum score thresholds to avoid noise
    if decision_score >= 3 and decision_score >= action_score:
        return "decision"
    if action_score >= 2:
        return "action_item"
    return "general"


# ── ML model (optional) ───────────────────────────────────────────────────────

_ml_model = None
_ml_loaded = False


def _try_load_ml_model():
    global _ml_model, _ml_loaded
    if _ml_loaded:
        return _ml_model
    _ml_loaded = True
    if MODEL_PATH.exists():
        try:
            with open(MODEL_PATH, "rb") as f:
                _ml_model = pickle.load(f)
            logger.info("ML classifier loaded from %s.", MODEL_PATH)
        except Exception as exc:
            logger.warning("Could not load ML classifier: %s. Using rule-based.", exc)
            _ml_model = None
    else:
        logger.info("No ML classifier found at %s — using weighted rule-based classifier.", MODEL_PATH)
    return _ml_model


# ── Public API ────────────────────────────────────────────────────────────────

def classify(text: str) -> SegmentType:
    """Classify a single segment. Returns 'action_item', 'decision', or 'general'."""
    model = _try_load_ml_model()
    if model is not None:
        try:
            prediction = model.predict([text])[0]
            if prediction in ("action_item", "decision", "general"):
                return prediction  # type: ignore[return-value]
        except Exception as exc:
            logger.warning("ML classify failed (%s); falling back to rule-based.", exc)

    return _rule_based_classify(text)


def classify_batch(texts: List[str]) -> List[SegmentType]:
    """Classify a list of texts, preferring ML model when available."""
    model = _try_load_ml_model()
    if model is not None:
        try:
            predictions = model.predict(texts)
            valid = {"action_item", "decision", "general"}
            if all(p in valid for p in predictions):
                return list(predictions)  # type: ignore[return-value]
        except Exception as exc:
            logger.warning("ML batch classify failed (%s); falling back to rule-based.", exc)

    return [_rule_based_classify(t) for t in texts]


def train_and_save(texts: List[str], labels: List[str]) -> None:
    """Train a TF-IDF + Logistic Regression classifier and save it."""
    from sklearn.linear_model import LogisticRegression
    from sklearn.pipeline import Pipeline
    from sklearn.feature_extraction.text import TfidfVectorizer

    pipeline = Pipeline([
        ("tfidf", TfidfVectorizer(ngram_range=(1, 2), max_features=5000)),
        ("clf", LogisticRegression(max_iter=500, C=1.0)),
    ])
    pipeline.fit(texts, labels)

    with open(MODEL_PATH, "wb") as f:
        pickle.dump(pipeline, f)

    global _ml_model, _ml_loaded
    _ml_model = pipeline
    _ml_loaded = True
    logger.info("ML classifier trained and saved to %s.", MODEL_PATH)
