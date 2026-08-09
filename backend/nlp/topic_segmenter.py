"""
nlp/topic_segmenter.py — Groups transcript segments into coherent topics.

Method:
  1. Build TF-IDF vectors for each segment (fast, no external model dependencies).
  2. Apply agglomerative clustering (cosine distance, average linkage).
  3. Generate meaningful topic titles using:
       - Named entity extraction (regex-based)
       - Noun phrase frequency analysis from segment tokens
       - Key sentence selection via TF-IDF scoring within each cluster
  4. Return topic clusters with rich titles and extractive summaries.
"""

from __future__ import annotations

import logging
import re
import string
from collections import Counter
from dataclasses import dataclass, field
from typing import Dict, List, Optional

import numpy as np

logger = logging.getLogger(__name__)


# ── Types ─────────────────────────────────────────────────────────────────────

@dataclass
class TopicCluster:
    """A group of segments that form one discussion topic."""
    title: str
    summary: str
    segment_indices: List[int] = field(default_factory=list)


# ── Stop words ────────────────────────────────────────────────────────────────

_STOP = frozenset({
    "a", "an", "the", "and", "or", "but", "in", "on", "at", "to", "for",
    "of", "with", "by", "from", "up", "is", "are", "was", "were", "be",
    "been", "being", "have", "has", "had", "do", "does", "did", "will",
    "would", "could", "should", "may", "might", "shall", "can", "need",
    "this", "that", "these", "those", "i", "we", "you", "he", "she",
    "they", "it", "me", "us", "him", "her", "them", "my", "our", "your",
    "his", "its", "their", "what", "which", "who", "when", "where", "how",
    "so", "as", "if", "then", "than", "because", "although", "though",
    "while", "also", "just", "very", "too", "not", "no", "just", "more",
    "about", "okay", "right", "yeah", "yes", "actually", "basically",
    "like", "really", "well", "going", "said", "think", "know",
})

# ── Text helpers ──────────────────────────────────────────────────────────────

def _tokenize(text: str) -> List[str]:
    text = text.lower().translate(str.maketrans("", "", string.punctuation))
    return [w for w in text.split() if w and w not in _STOP and len(w) > 2]


def _get_embeddings(segment_texts: List[str]) -> np.ndarray:
    """TF-IDF vectorization with cosine-ready output."""
    try:
        from sklearn.feature_extraction.text import TfidfVectorizer
        vectorizer = TfidfVectorizer(
            max_features=1000,
            stop_words="english",
            ngram_range=(1, 2),
            sublinear_tf=True,  # apply log(tf) + 1
        )
        res = vectorizer.fit_transform(segment_texts).toarray()
        if res.shape[1] > 0:
            return res
    except BaseException as exc:
        logger.warning("TF-IDF vectorization failed (%s); using identity fallback.", exc)
    return np.eye(len(segment_texts))


def _extract_noun_phrases(texts: List[str]) -> List[str]:
    """
    Heuristic noun-phrase extraction using capitalised sequences and
    common noun patterns (adjective + noun, noun + noun).
    Works without spaCy or nltk.
    """
    phrases = []
    for text in texts:
        # Capitalised multi-word sequences (e.g., "Database Migration", "REST API")
        caps = re.findall(r'\b([A-Z][a-z]+(?:\s+[A-Z][a-z]+)+)\b', text)
        phrases.extend(caps)
        # Also grab capitalised single words (proper nouns)
        singles = re.findall(r'\b([A-Z][a-z]{3,})\b', text)
        phrases.extend(singles)
    return phrases


def _generate_topic_title(texts: List[str], global_freq: Dict[str, int]) -> str:
    """
    Generate a descriptive topic title from a cluster of segment texts.

    Priority:
      1. Common noun phrases (capitalised entities)
      2. Top TF-IDF keywords not in global stop-words or overly common terms
      3. Most informative sentence excerpt
    """
    # Try noun phrases first
    noun_phrases = _extract_noun_phrases(texts)
    if noun_phrases:
        freq = Counter(noun_phrases)
        top_phrase = freq.most_common(1)[0][0]
        # Capitalise title-style
        return top_phrase.title()

    # Fall back to top local keywords (penalise very common global terms)
    local_tokens = []
    for t in texts:
        local_tokens.extend(_tokenize(t))
    local_freq = Counter(local_tokens)

    # Score: high local freq + low global freq = topic-specific term
    scored = {}
    for w, lf in local_freq.items():
        gf = global_freq.get(w, 1)
        scored[w] = lf / (gf ** 0.5)

    if scored:
        top_words = sorted(scored, key=lambda x: scored[x], reverse=True)[:3]
        return " ".join(w.title() for w in top_words)

    # Last resort: first meaningful sentence fragment
    first = texts[0]
    parts = re.split(r'[.!?]', first)
    fragment = next((p.strip() for p in parts if len(p.strip().split()) >= 3), first)
    return fragment[:60].rstrip() + ("…" if len(fragment) > 60 else "")


def _generate_topic_summary(texts: List[str]) -> str:
    """
    Generate an extractive summary of a topic cluster.
    Uses TF-IDF within the cluster to select the most informative sentence.
    """
    # Collect all sentences from cluster texts
    all_sentences = []
    for t in texts:
        sents = re.split(r'(?<=[.!?])\s+', t.strip())
        all_sentences.extend([s.strip() for s in sents if len(s.split()) >= 4])

    if not all_sentences:
        return " ".join(texts[:2])[:300]

    if len(all_sentences) == 1:
        return all_sentences[0]

    # Score sentences by local TF-IDF
    from collections import Counter as C
    import math

    n = len(all_sentences)
    doc_count: Counter = C()
    for s in all_sentences:
        for tok in set(_tokenize(s)):
            doc_count[tok] += 1

    idf = {w: math.log((1 + n) / (1 + c)) for w, c in doc_count.items()}

    best_sent, best_score = all_sentences[0], -1.0
    for s in all_sentences:
        toks = _tokenize(s)
        if not toks:
            continue
        tf = C(toks)
        max_tf = max(tf.values())
        score = sum((tf[t] / max_tf) * idf.get(t, 0.0) for t in toks) / len(toks)
        if score > best_score:
            best_sent, best_score = s, score

    # Return top 2 sentences for richer context
    scored = sorted(
        [(s, sum((_tokenize(s).count(t) / max(1, sum(_tokenize(s2).count(t) for s2 in all_sentences))) * idf.get(t, 0.0)
                for t in set(_tokenize(s)))) for s in all_sentences],
        key=lambda x: x[1], reverse=True
    )
    top_2 = [s for s, _ in scored[:2]]
    # Preserve original order
    ordered = [s for s in all_sentences if s in top_2]
    return " ".join(ordered) if ordered else best_sent


# ── Public API ────────────────────────────────────────────────────────────────

def segment_into_topics(
    segment_texts: List[str],
    max_topics: int = 8,
    distance_threshold: float = 0.50,
) -> List[TopicCluster]:
    """
    Cluster transcript segment texts into meaningful topics.

    Args:
        segment_texts:      Ordered list of segment texts from the transcript.
        max_topics:         Maximum number of topic clusters to produce.
        distance_threshold: Agglomerative clustering cosine distance cut-off.

    Returns:
        List of TopicCluster objects with rich titles and extractive summaries.
    """
    if not segment_texts:
        return []

    if len(segment_texts) < 2:
        title = _generate_topic_title(segment_texts, {})
        summary = segment_texts[0]
        return [TopicCluster(title=title, summary=summary, segment_indices=[0])]

    # Build global term frequency for title generation scoring
    all_tokens = []
    for t in segment_texts:
        all_tokens.extend(_tokenize(t))
    global_freq = dict(Counter(all_tokens))

    logger.info("Embedding %d segments for topic segmentation…", len(segment_texts))
    embeddings = _get_embeddings(segment_texts)

    try:
        from sklearn.cluster import AgglomerativeClustering

        clustering = AgglomerativeClustering(
            n_clusters=None,
            distance_threshold=distance_threshold,
            metric="cosine",
            linkage="average",
        )
        labels = clustering.fit_predict(embeddings)
    except Exception as exc:
        logger.warning("Clustering failed (%s); treating each segment as its own topic.", exc)
        labels = list(range(len(segment_texts)))

    # Group segment indices by cluster label
    clusters: dict[int, List[int]] = {}
    for idx, label in enumerate(labels):
        clusters.setdefault(int(label), []).append(idx)

    # Build TopicCluster objects with meaningful titles
    topic_clusters: List[TopicCluster] = []
    for cluster_label in sorted(clusters.keys()):
        indices = clusters[cluster_label]
        texts = [segment_texts[i] for i in indices]
        title = _generate_topic_title(texts, global_freq)
        summary = _generate_topic_summary(texts)
        topic_clusters.append(
            TopicCluster(title=title, summary=summary, segment_indices=indices)
        )

    # Merge very small clusters (1 segment) into neighbours if too many
    if len(topic_clusters) > max_topics:
        topic_clusters = _merge_small_clusters(topic_clusters, max_topics)

    logger.info("Topic segmentation produced %d topics.", len(topic_clusters))
    return topic_clusters[:max_topics]


def _merge_small_clusters(clusters: List[TopicCluster], max_topics: int) -> List[TopicCluster]:
    """Merge smallest single-segment clusters together to stay within max_topics."""
    while len(clusters) > max_topics:
        # Find smallest cluster
        clusters.sort(key=lambda c: len(c.segment_indices))
        small = clusters.pop(0)
        if clusters:
            # Merge into the first remaining cluster
            clusters[0].segment_indices.extend(small.segment_indices)
            clusters[0].summary = clusters[0].summary + " " + small.summary
    return clusters
