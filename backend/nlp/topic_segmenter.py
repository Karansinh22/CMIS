"""
nlp/topic_segmenter.py — Splits a transcript into coherent, ordered topics.

Meetings move through topics *in time*, so this uses linear text segmentation
(TextTiling-style) instead of unordered clustering:

  1. Clean each segment (fillers removed) and tokenise with a stop list that
     also drops discourse words ("okay", "yeah", "basically"…).
  2. For every boundary between consecutive segments, compare the bag of words
     of the window before it with the window after it (cosine similarity).
  3. Boundaries where similarity dips sharply (high "depth") become topic
     cuts, subject to a minimum block size and ``max_topics``.
  4. Each block gets a title from its most *distinctive* terms (TF in the
     block × IDF across blocks, bigrams preferred) and a 1–2 sentence
     extractive summary.

Pure NumPy — no scikit-learn or embeddings required.
"""

from __future__ import annotations

import logging
import math
import re
from collections import Counter
from dataclasses import dataclass, field
from typing import Dict, Iterable, List, Optional, Sequence, Tuple

import numpy as np

from nlp.intent import clean_text, split_sentences

logger = logging.getLogger(__name__)


# ── Types ─────────────────────────────────────────────────────────────────────

@dataclass
class TopicCluster:
    """A group of consecutive segments that form one discussion topic."""
    title: str
    summary: str
    segment_indices: List[int] = field(default_factory=list)


# ── Stop words ────────────────────────────────────────────────────────────────

_STOP = frozenset({
    "a", "an", "the", "and", "or", "but", "in", "on", "at", "to", "for", "of", "with", "by", "from",
    "up", "is", "are", "was", "were", "be", "been", "being", "have", "has", "had", "do", "does", "did",
    "will", "would", "could", "should", "may", "might", "shall", "can", "need", "needs", "this", "that",
    "these", "those", "i", "we", "you", "he", "she", "they", "it", "me", "us", "him", "her", "them", "my",
    "our", "your", "his", "its", "their", "what", "which", "who", "when", "where", "how", "so", "as", "if",
    "then", "than", "because", "although", "though", "while", "also", "just", "very", "too", "not", "no",
    "more", "about", "okay", "ok", "right", "yeah", "yes", "yep", "actually", "basically", "like", "really",
    "well", "going", "said", "think", "know", "mean", "guess", "sure", "great", "good", "nice", "cool",
    "fine", "thanks", "thank", "hi", "hello", "hey", "everyone", "everybody", "guys", "folks", "all",
    "get", "got", "let", "lets", "let's", "go", "come", "make", "made", "take", "took", "put", "say",
    "says", "one", "two", "three", "thing", "things", "something", "anything", "nothing", "stuff", "bit",
    "lot", "lots", "kind", "sort", "way", "time", "now", "today", "tomorrow", "yesterday", "week", "next",
    "last", "first", "still", "yet", "already", "again", "here", "there", "back", "into", "out", "over",
    "some", "any", "much", "many", "most", "other", "another", "same", "own", "such", "only", "even",
    "ever", "never", "always", "maybe", "probably", "perhaps", "want", "wants", "wanted", "sounds",
    "honest", "honestly", "obviously", "start", "started", "move", "moving", "topic", "point", "question",
    "meeting", "minutes", "agenda", "discuss", "discussed", "talk", "talked", "talking", "done", "doing",
    "did", "does", "look", "looks", "looking", "see", "seen", "saw", "am", "im", "ill", "ive", "youre",
    "were", "theyre", "dont", "doesnt", "didnt", "cant", "wont", "isnt", "arent", "wasnt", "werent",
    "hasnt", "havent", "hadnt", "couldnt", "wouldnt", "shouldnt", "thats", "whats", "theres", "heres",
    "decide", "decided", "decision", "agree", "agreed", "instead", "rather", "anyway", "anyways",
    "um", "uh", "hmm", "erm", "mm", "ah", "oh", "wow", "please", "kindly", "quite", "pretty", "little",
    "big", "small", "new", "old", "bad", "better", "best", "worse", "worst", "sorry", "welcome", "later",
    "soon", "before", "after", "since", "until", "during", "through", "around", "between", "each",
    "both", "either", "neither", "whether", "everything", "everyone", "someone", "somebody", "anyone",
    "nobody", "none", "else", "per", "via", "etc",
})

_TOKEN_RE = re.compile(r"[a-z][a-z0-9'+\-]{1,}")


def _tokenize(text: str, exclude: Iterable[str] = ()) -> List[str]:
    # drop apostrophes so contractions collapse onto their stop-list forms ("i'll" → "ill")
    text = text.lower().replace("’", "").replace("'", "")
    words = [w.strip("-") for w in _TOKEN_RE.findall(text)]
    ex = set(exclude)
    return [w for w in words if w and w not in _STOP and w not in ex and len(w) > 2 and not w.isdigit()]


# ── Segmentation ──────────────────────────────────────────────────────────────

def _bag(tokens: Sequence[Sequence[str]], start: int, end: int) -> Counter:
    c: Counter = Counter()
    for i in range(max(0, start), min(len(tokens), end)):
        c.update(tokens[i])
    return c


def _cosine(a: Counter, b: Counter, idf: Dict[str, float]) -> float:
    if not a or not b:
        return 0.0
    num = sum(a[w] * b[w] * idf.get(w, 1.0) ** 2 for w in a.keys() & b.keys())
    na = math.sqrt(sum((a[w] * idf.get(w, 1.0)) ** 2 for w in a))
    nb = math.sqrt(sum((b[w] * idf.get(w, 1.0)) ** 2 for w in b))
    return num / (na * nb) if na and nb else 0.0


def _boundaries(tokens: List[List[str]], max_topics: int, min_block: int) -> List[int]:
    """Return cut positions (index of the first segment of each new block)."""
    n = len(tokens)
    if n < 2 * min_block:
        return []

    # IDF over segments so filler-ish words that appear everywhere weigh less
    df: Counter = Counter()
    for toks in tokens:
        df.update(set(toks))
    idf = {w: math.log((1 + n) / (1 + c)) + 0.1 for w, c in df.items()}

    window = max(2, min(8, n // 10))
    sims = np.zeros(n - 1)
    for i in range(n - 1):
        left = _bag(tokens, i + 1 - window, i + 1)
        right = _bag(tokens, i + 1, i + 1 + window)
        sims[i] = _cosine(left, right, idf)

    # Smooth a little so single noisy lines don't create cuts
    if n - 1 >= 3:
        kernel = np.array([0.25, 0.5, 0.25])
        sims = np.convolve(np.pad(sims, 1, mode="edge"), kernel, mode="valid")

    # TextTiling depth score: how far this valley sits below the peaks on both sides
    depth = np.zeros_like(sims)
    for i in range(len(sims)):
        left_peak = sims[i]
        j = i
        while j > 0 and sims[j - 1] >= left_peak:
            j -= 1
            left_peak = sims[j]
        right_peak = sims[i]
        j = i
        while j < len(sims) - 1 and sims[j + 1] >= right_peak:
            j += 1
            right_peak = sims[j]
        depth[i] = (left_peak - sims[i]) + (right_peak - sims[i])

    if depth.max() <= 0:
        return []

    threshold = depth.mean() + 0.5 * depth.std()
    candidates = [i + 1 for i in np.argsort(-depth) if depth[i] >= threshold and depth[i] > 0.05]

    chosen: List[int] = []
    for cut in candidates:
        if len(chosen) >= max_topics - 1:
            break
        if cut < min_block or n - cut < min_block:
            continue
        if all(abs(cut - c) >= min_block for c in chosen):
            chosen.append(cut)
    return sorted(chosen)


# ── Titles & summaries ────────────────────────────────────────────────────────

def _ngrams(tokens: Sequence[str], n: int) -> List[str]:
    return [" ".join(tokens[i:i + n]) for i in range(len(tokens) - n + 1)]


def _block_title(block_tokens: List[List[str]], all_blocks: List[List[List[str]]], exclude: Iterable[str]) -> str:
    """Pick the 2–3 most distinctive terms of a block."""
    flat = [t for toks in block_tokens for t in toks]
    if not flat:
        return "General discussion"

    # Bigrams first (more descriptive), then unigrams
    uni = Counter(flat)
    bi = Counter(b for toks in block_tokens for b in _ngrams(toks, 2))

    n_blocks = len(all_blocks)
    df_uni: Counter = Counter()
    df_bi: Counter = Counter()
    for blk in all_blocks:
        words = set(t for toks in blk for t in toks)
        df_uni.update(words)
        df_bi.update(set(b for toks in blk for b in _ngrams(toks, 2)))

    def idf(df: int) -> float:
        return math.log((1 + n_blocks) / (1 + df)) + 0.3

    scored: List[Tuple[float, str]] = []
    for term, tf in bi.items():
        if tf >= 2 or n_blocks == 1 or len(flat) < 25:
            scored.append((tf * idf(df_bi[term]) * 1.6, term))
    for term, tf in uni.items():
        scored.append((tf * idf(df_uni[term]), term))
    scored.sort(reverse=True)

    picked: List[str] = []
    used_words: set = set()
    for _, term in scored:
        words = term.split()
        if any(w in used_words for w in words):
            continue
        picked.append(term)
        used_words.update(words)
        if len(picked) >= 2 or sum(len(p.split()) for p in picked) >= 3:
            break

    if not picked:
        return "General discussion"
    return " & ".join(_title_case(p) for p in picked)


_KEEP_UPPER = {"api", "ui", "ux", "db", "sql", "aws", "gcp", "ci", "cd", "qa", "ml", "ai", "nlp", "llm", "pr",
               "mvp", "kpi", "roi", "sdk", "cli", "ios", "http", "json", "csv", "pdf", "ppt", "mom", "id",
               "url", "ssl", "vpn", "cms", "crm", "erp", "hr", "it", "ok"}


def _title_case(phrase: str) -> str:
    out = []
    for w in phrase.split():
        out.append(w.upper() if w in _KEEP_UPPER else w[:1].upper() + w[1:])
    return " ".join(out)


def _block_summary(texts: List[str], exclude: Iterable[str]) -> str:
    """1–2 most central sentences of the block, cleaned of fillers, in order."""
    sentences: List[str] = []
    for t in texts:
        for s in split_sentences(clean_text(t)):
            if len(s.split()) >= 5 and not s.endswith("?"):
                sentences.append(s)
    if not sentences:
        cleaned = " ".join(clean_text(t) for t in texts).strip()
        return cleaned[:300]
    if len(sentences) <= 2:
        return " ".join(_cap(x) for x in sentences)

    toks = [_tokenize(s, exclude) for s in sentences]
    df: Counter = Counter()
    for tk in toks:
        df.update(set(tk))
    n = len(sentences)
    idf = {w: math.log((1 + n) / (1 + c)) + 0.1 for w, c in df.items()}
    centroid: Counter = Counter()
    for tk in toks:
        centroid.update(tk)

    scores = []
    for i, tk in enumerate(toks):
        if not tk:
            scores.append((0.0, i))
            continue
        sim = _cosine(Counter(tk), centroid, idf)
        length_bonus = min(1.0, len(tk) / 8)
        scores.append((sim * (0.6 + 0.4 * length_bonus), i))
    top = sorted(sorted(scores, reverse=True)[:2], key=lambda x: x[1])
    return " ".join(_cap(sentences[i]) for _, i in top)


def _cap(sentence: str) -> str:
    return sentence[:1].upper() + sentence[1:] if sentence else sentence


# ── Public API ────────────────────────────────────────────────────────────────

def segment_into_topics(
    segment_texts: List[str],
    max_topics: int = 8,
    distance_threshold: float = 0.50,   # kept for backwards compatibility (unused)
    exclude_terms: Optional[Iterable[str]] = None,
) -> List[TopicCluster]:
    """
    Split an ordered transcript into topic blocks.

    Args:
        segment_texts: Ordered list of segment texts from the transcript.
        max_topics:    Upper bound on the number of topics.
        exclude_terms: Words to ignore for titles (e.g. speaker names).

    Returns:
        List of TopicCluster objects, in transcript order.
    """
    if not segment_texts:
        return []

    exclude = {w.lower() for w in (exclude_terms or [])}
    tokens = [_tokenize(clean_text(t), exclude) for t in segment_texts]
    n = len(segment_texts)

    # Roughly 8–15 lines per topic; short recordings get one or two topics.
    min_block = max(3, min(12, n // 8 or 1))
    cuts = _boundaries(tokens, max_topics=max_topics, min_block=min_block) if n >= 6 else []

    bounds = [0] + cuts + [n]
    blocks_idx = [list(range(bounds[i], bounds[i + 1])) for i in range(len(bounds) - 1)]
    block_tokens = [[tokens[i] for i in idxs] for idxs in blocks_idx]

    topics: List[TopicCluster] = []
    for idxs, btoks in zip(blocks_idx, block_tokens):
        texts = [segment_texts[i] for i in idxs]
        topics.append(
            TopicCluster(
                title=_block_title(btoks, block_tokens, exclude),
                summary=_block_summary(texts, exclude),
                segment_indices=idxs,
            )
        )

    logger.info("Topic segmentation produced %d topics from %d segments.", len(topics), n)
    return topics
