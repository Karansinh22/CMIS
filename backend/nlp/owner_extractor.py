"""
owner_extractor.py — Extracts the owner of an action item.

Priority order:
  1. spaCy NER: looks for PERSON entities in the same segment
  2. Neighbouring segment: looks one segment before/after for a PERSON entity
  3. Fallback: the speaker label of the segment

Requires the en_core_web_sm model:
    python -m spacy download en_core_web_sm
"""

from __future__ import annotations

import logging
from typing import List, Optional

logger = logging.getLogger(__name__)

_nlp = None  # lazy-loaded


def _get_nlp():
    global _nlp
    if _nlp is None:
        try:
            import spacy
            _nlp = spacy.load("en_core_web_sm")
        except OSError:
            raise RuntimeError(
                "spaCy model 'en_core_web_sm' not found. "
                "Run: python -m spacy download en_core_web_sm"
            )
        except ImportError:
            raise RuntimeError(
                "spaCy is not installed. Run: pip install spacy"
            )
    return _nlp


def _find_person(text: str) -> Optional[str]:
    """Return the first PERSON entity found in text, or None."""
    nlp = _get_nlp()
    doc = nlp(text)
    for ent in doc.ents:
        if ent.label_ == "PERSON":
            return ent.text.strip()
    return None


def extract_owner(
    segment_text: str,
    speaker_label: Optional[str] = None,
    context_texts: Optional[List[str]] = None,
) -> Optional[str]:
    """
    Extract the owner of an action item.

    Args:
        segment_text:   The text of the action-item segment.
        speaker_label:  The speaker label for this segment (e.g. "SPEAKER_00").
        context_texts:  Adjacent segment texts to search if the main segment
                        has no PERSON entity.

    Returns:
        Owner name string, or None if extraction fails.
    """
    # 1. Try the segment itself
    owner = _find_person(segment_text)
    if owner:
        return owner

    # 2. Try surrounding context
    if context_texts:
        for ctx in context_texts:
            owner = _find_person(ctx)
            if owner:
                return owner

    # 3. Fall back to speaker label
    if speaker_label:
        return speaker_label

    return None
