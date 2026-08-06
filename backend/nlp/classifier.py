"""
classifier.py — Classifies transcript segments as action_item, decision, or general.

Stage 1 (default): Rule-based keyword + regex patterns.
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

# ── Rule-based patterns ───────────────────────────────────────────────────────

# Action-item indicators
_ACTION_PATTERNS = [
    re.compile(r"\b(will|shall|let'?s|gonna|going to)\b", re.IGNORECASE),
    re.compile(r"\bI'?ll\b", re.IGNORECASE),
    re.compile(r"\b(action|task|todo|to-do|follow[\s-]?up)\b", re.IGNORECASE),
    re.compile(r"\b(need to|must|have to|should)\b", re.IGNORECASE),
    re.compile(r"\bby (monday|tuesday|wednesday|thursday|friday|saturday|sunday|tomorrow|next week|end of)\b", re.IGNORECASE),
    re.compile(r"\b(assign|responsible|owner|in charge)\b", re.IGNORECASE),
]

# Decision indicators
_DECISION_PATTERNS = [
    re.compile(r"\b(decided|decision|agreed|confirmed|resolved|approved|finalized)\b", re.IGNORECASE),
    re.compile(r"\bwe (will|are going to|have decided|agreed)\b", re.IGNORECASE),
    re.compile(r"\b(conclusion|outcome|ruling|voted|consensus)\b", re.IGNORECASE),
    re.compile(r"\b(it was (decided|agreed|resolved))\b", re.IGNORECASE),
]


def _rule_based_classify(text: str) -> SegmentType:
    action_score = sum(bool(p.search(text)) for p in _ACTION_PATTERNS)
    decision_score = sum(bool(p.search(text)) for p in _DECISION_PATTERNS)

    if decision_score > 0 and decision_score >= action_score:
        return "decision"
    if action_score > 0:
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
        logger.info("No ML classifier model found at %s — using rule-based classifier.", MODEL_PATH)
    return _ml_model


# ── Public API ────────────────────────────────────────────────────────────────

def classify(text: str) -> SegmentType:
    """
    Classify a single segment of text.
    Returns "action_item", "decision", or "general".
    """
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
    """Classify a list of texts. More efficient when using the ML model."""
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
    """
    Train a TF-IDF + Logistic Regression classifier and save it.

    Args:
        texts:  List of training sentences.
        labels: Corresponding labels ("action_item" | "decision" | "general").
    """
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
