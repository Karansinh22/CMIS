"""
utils/text.py — Text pre-processing helpers used across the NLP pipeline.
"""

from __future__ import annotations

import re
import unicodedata
from typing import List

# Basic English stopwords — used to clean token sets for MinHash
_STOPWORDS = {
    "a", "an", "the", "and", "but", "or", "for", "nor", "so", "yet",
    "at", "by", "in", "of", "on", "to", "up", "as", "is", "it", "its",
    "be", "was", "are", "were", "been", "has", "have", "had", "do",
    "does", "did", "will", "would", "can", "could", "shall", "should",
    "may", "might", "must", "that", "this", "these", "those", "i", "we",
    "you", "he", "she", "they", "me", "us", "him", "her", "them", "my",
    "our", "your", "his", "their", "what", "which", "who", "whom", "not",
    "with", "from", "if", "then", "than", "when", "where", "how", "also",
    "just", "about", "into", "through", "during", "before", "after",
    "above", "below", "between", "each", "more", "other", "some", "such",
    "no", "only", "same", "too", "very", "s", "t", "ll", "re", "ve",
}


def normalize_text(text: str) -> str:
    """
    Lowercase, remove accents, collapse whitespace, and strip punctuation.
    Used to prepare text for token-level operations.
    """
    text = text.lower()
    # Normalize unicode (e.g. accented characters → base characters)
    text = unicodedata.normalize("NFKD", text)
    text = "".join(c for c in text if not unicodedata.combining(c))
    # Replace punctuation with spaces
    text = re.sub(r"[^\w\s]", " ", text)
    # Collapse whitespace
    text = re.sub(r"\s+", " ", text).strip()
    return text


def tokenize(text: str, remove_stopwords: bool = True) -> List[str]:
    """
    Split text into word tokens, optionally removing stopwords.
    """
    tokens = normalize_text(text).split()
    if remove_stopwords:
        tokens = [t for t in tokens if t not in _STOPWORDS]
    return tokens


def split_sentences(text: str) -> List[str]:
    """
    Simple sentence splitter using punctuation boundaries.
    For a more robust split, replace this with spaCy's sentencizer.
    """
    # Split on ". ", "! ", "? " followed by a capital letter or end of string
    parts = re.split(r"(?<=[.!?])\s+(?=[A-Z])", text)
    return [p.strip() for p in parts if p.strip()]


def truncate(text: str, max_chars: int = 200) -> str:
    """Truncate text to max_chars, appending ellipsis if cut."""
    if len(text) <= max_chars:
        return text
    return text[:max_chars].rsplit(" ", 1)[0] + "…"
