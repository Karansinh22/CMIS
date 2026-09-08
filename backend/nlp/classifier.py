"""
nlp/classifier.py — Segment classifier: action_item | decision | general.

Thin compatibility layer over ``nlp.intent`` (the context/intent-aware
engine).  Kept so existing callers and tests keep working; new code should use
``nlp.intent.extract`` directly, which also returns owners, deadlines,
confidence and evidence.

An optional scikit-learn model (``classifier_model.pkl``) can still be trained
with ``train_and_save`` and, when present, is used as a *second opinion*: it
only overrides the intent engine when the engine is unsure (confidence < 0.5).
"""

from __future__ import annotations

import logging
import pickle
from pathlib import Path
from typing import List, Literal

from nlp.intent import analyse_sentence

logger = logging.getLogger(__name__)

SegmentType = Literal["action_item", "decision", "general"]

MODEL_PATH = Path(__file__).parent / "classifier_model.pkl"

_ACTION_INTENTS = {"commitment", "assignment", "request", "collective", "open_item"}


def _intent_to_label(intent: str, confidence: float) -> SegmentType:
    if intent in _ACTION_INTENTS and confidence >= 0.45:
        return "action_item"
    if intent == "decision" and confidence >= 0.45:
        return "decision"
    return "general"


# ── Optional ML model ─────────────────────────────────────────────────────────

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
        except Exception as exc:  # noqa: BLE001
            logger.warning("Could not load ML classifier: %s. Using intent engine only.", exc)
            _ml_model = None
    return _ml_model


# ── Public API ────────────────────────────────────────────────────────────────

def classify(text: str) -> SegmentType:
    """Classify a single sentence. Returns 'action_item', 'decision', or 'general'."""
    if not text or not text.strip():
        return "general"
    analysis = analyse_sentence(text)
    label = _intent_to_label(analysis.intent, analysis.confidence)

    model = _try_load_ml_model()
    if model is not None and analysis.confidence < 0.5:
        try:
            prediction = model.predict([text])[0]
            if prediction in ("action_item", "decision", "general"):
                return prediction  # type: ignore[return-value]
        except Exception as exc:  # noqa: BLE001
            logger.warning("ML classify failed (%s); using intent engine.", exc)
    return label


def classify_batch(texts: List[str]) -> List[SegmentType]:
    """Classify a list of texts."""
    return [classify(t) for t in texts]


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
