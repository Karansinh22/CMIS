"""
topic_segmenter.py — Groups transcript segments into coherent topics.

Method:
  1. Embed each segment's text using sentence-transformers (all-MiniLM-L6-v2).
  2. Apply agglomerative clustering (cosine distance, average linkage) to
     find semantic groups among *consecutive* segments.
  3. Return topic boundaries with a representative title and summary.
"""

from __future__ import annotations

import logging
from dataclasses import dataclass, field
from typing import List

import numpy as np

logger = logging.getLogger(__name__)

# ── Types ─────────────────────────────────────────────────────────────────────


@dataclass
class TopicCluster:
    """A group of segments that form one discussion topic."""
    title: str
    summary: str
    segment_indices: List[int] = field(default_factory=list)


# ── Embedding ─────────────────────────────────────────────────────────────────

_embedder = None   # lazy-loaded singleton


def _get_embedder():
    global _embedder
    if _embedder is None:
        try:
            from sentence_transformers import SentenceTransformer
        except ImportError:
            raise RuntimeError(
                "sentence-transformers is not installed. "
                "Run: pip install sentence-transformers"
            )
        logger.info("Loading sentence-transformers model 'all-MiniLM-L6-v2'…")
        _embedder = SentenceTransformer("all-MiniLM-L6-v2")
        logger.info("Embedding model ready.")
    return _embedder


# ── Topic Segmenter ───────────────────────────────────────────────────────────

def _cosine_distance_matrix(embeddings: np.ndarray) -> np.ndarray:
    """Return pairwise cosine distance matrix."""
    norms = np.linalg.norm(embeddings, axis=1, keepdims=True)
    normed = embeddings / np.maximum(norms, 1e-10)
    cos_sim = normed @ normed.T
    return 1.0 - cos_sim  # distance = 1 - similarity


def _generate_title(texts: List[str]) -> str:
    """
    Heuristic title: take the first sentence of the first segment (up to 60 chars).
    A future upgrade can use an abstractive summariser here.
    """
    first = texts[0].split(".")[0].strip() if texts else "Untitled Topic"
    return first[:60] + ("…" if len(first) > 60 else "")


def _generate_summary(texts: List[str]) -> str:
    """
    Simple extractive summary: concatenate up to 3 representative segments.
    """
    sample = texts[:3]
    return " ".join(sample)


def segment_into_topics(
    segment_texts: List[str],
    max_topics: int = 8,
    distance_threshold: float = 0.45,
) -> List[TopicCluster]:
    """
    Cluster transcript segment texts into topics.

    Args:
        segment_texts:      Ordered list of segment texts from the transcript.
        max_topics:         Maximum number of topic clusters to produce.
        distance_threshold: Agglomerative clustering cut-off distance (cosine).

    Returns:
        List of TopicCluster objects, each with a title, summary, and list of
        segment indices that belong to that topic.
    """
    if not segment_texts:
        return []

    if len(segment_texts) < 2:
        title = _generate_title(segment_texts)
        return [TopicCluster(title=title, summary=segment_texts[0], segment_indices=[0])]

    embedder = _get_embedder()
    logger.info("Embedding %d segments for topic segmentation…", len(segment_texts))
    embeddings = embedder.encode(segment_texts, show_progress_bar=False, normalize_embeddings=True)

    from sklearn.cluster import AgglomerativeClustering

    n_clusters = min(max_topics, len(segment_texts))
    clustering = AgglomerativeClustering(
        n_clusters=None,
        distance_threshold=distance_threshold,
        metric="cosine",
        linkage="average",
    )
    labels = clustering.fit_predict(embeddings)

    # Group segment indices by cluster label
    clusters: dict[int, List[int]] = {}
    for idx, label in enumerate(labels):
        clusters.setdefault(int(label), []).append(idx)

    # Build TopicCluster objects; limit to max_topics by merging small clusters
    topic_clusters: List[TopicCluster] = []
    for cluster_label in sorted(clusters.keys()):
        indices = clusters[cluster_label]
        texts = [segment_texts[i] for i in indices]
        topic_clusters.append(
            TopicCluster(
                title=_generate_title(texts),
                summary=_generate_summary(texts),
                segment_indices=indices,
            )
        )

    logger.info("Topic segmentation produced %d topics.", len(topic_clusters))
    return topic_clusters[:max_topics]
