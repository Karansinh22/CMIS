"""
nlp/summarizer.py — Meeting Intelligence Summary Engine.

Uses NLP-based extractive summarization techniques:
- TF-IDF sentence scoring to identify the most informative transcript sentences
- TextRank-inspired graph scoring for key idea extraction
- Frequency-weighted keyword analysis for theme identification
- Structured template generation per summary depth type

Summary depth types:
  'brief'         → Executive bullet points (top-N scored sentences + key facts)
  'balanced'      → Structured 3-section prose (context, highlights, next steps)
  'comprehensive' → Full multi-section document with scored evidence sentences
"""

from __future__ import annotations

import logging
import math
import re
import string
from collections import Counter
from typing import Dict, List, Optional, Tuple

logger = logging.getLogger(__name__)

# ── Stop words ────────────────────────────────────────────────────────────────

_STOP_WORDS = frozenset({
    "a", "an", "the", "and", "or", "but", "in", "on", "at", "to", "for",
    "of", "with", "by", "from", "up", "is", "are", "was", "were", "be",
    "been", "being", "have", "has", "had", "do", "does", "did", "will",
    "would", "could", "should", "may", "might", "shall", "can", "need",
    "this", "that", "these", "those", "i", "we", "you", "he", "she",
    "they", "it", "me", "us", "him", "her", "them", "my", "our", "your",
    "his", "its", "their", "what", "which", "who", "when", "where", "how",
    "so", "as", "if", "then", "than", "because", "although", "though",
    "while", "also", "just", "very", "too", "not", "no", "nor",
})

# ── Text helpers ──────────────────────────────────────────────────────────────

def _tokenize(text: str) -> List[str]:
    """Lowercase, strip punctuation, tokenize into words, remove stop words."""
    text = text.lower()
    text = text.translate(str.maketrans("", "", string.punctuation))
    return [w for w in text.split() if w and w not in _STOP_WORDS and len(w) > 2]


def _sentence_split(text: str) -> List[str]:
    """Split text into sentences using punctuation boundaries."""
    # Split on . ! ? but keep abbreviation-aware (handle Mr./Dr./etc.)
    raw = re.split(r'(?<=[.!?])\s+(?=[A-Z])', text.strip())
    sentences = []
    for s in raw:
        s = s.strip()
        if len(s.split()) >= 4:   # discard very short fragments
            sentences.append(s)
    return sentences if sentences else [text]


def _word_frequencies(tokens: List[str]) -> Dict[str, float]:
    """Compute normalized TF frequencies over all tokens."""
    counts = Counter(tokens)
    if not counts:
        return {}
    max_freq = max(counts.values())
    return {w: c / max_freq for w, c in counts.items()}


def _sentence_score(sentence: str, freq_table: Dict[str, float]) -> float:
    """Score a sentence by the sum of its token term frequencies."""
    tokens = _tokenize(sentence)
    if not tokens:
        return 0.0
    return sum(freq_table.get(t, 0.0) for t in tokens) / len(tokens)


def _rank_sentences(
    sentences: List[str],
    freq_table: Dict[str, float],
    top_n: int = 5,
    preserve_order: bool = True,
) -> List[str]:
    """Return the top-N highest-scoring sentences, optionally in original order."""
    scored = [(s, _sentence_score(s, freq_table)) for s in sentences]
    sorted_by_score = sorted(scored, key=lambda x: x[1], reverse=True)
    top = sorted_by_score[:top_n]
    if preserve_order:
        top_set = {id(s) for s, _ in top}
        top = [(s, sc) for s, sc in scored if id(s) in top_set]
    return [s for s, _ in top]


def _extract_keywords(freq_table: Dict[str, float], top_n: int = 8) -> List[str]:
    """Return the top-N keywords sorted by frequency."""
    return [w for w, _ in sorted(freq_table.items(), key=lambda x: x[1], reverse=True)[:top_n]]


def _compute_idf(sentences: List[str]) -> Dict[str, float]:
    """Compute inverse document frequency over sentences treated as 'documents'."""
    n = len(sentences)
    if n == 0:
        return {}
    doc_count: Counter = Counter()
    for s in sentences:
        for t in set(_tokenize(s)):
            doc_count[t] += 1
    return {w: math.log((1 + n) / (1 + c)) for w, c in doc_count.items()}


def _tfidf_rank(sentences: List[str], top_n: int = 5) -> List[str]:
    """Full TF-IDF sentence ranking: each sentence is scored by its avg TF*IDF token weight."""
    if not sentences:
        return []
    idf = _compute_idf(sentences)
    scored = []
    for s in sentences:
        tokens = _tokenize(s)
        if not tokens:
            scored.append((s, 0.0))
            continue
        tf = Counter(tokens)
        max_tf = max(tf.values())
        tfidf_score = sum((tf[t] / max_tf) * idf.get(t, 0.0) for t in tokens) / len(tokens)
        scored.append((s, tfidf_score))
    top = sorted(scored, key=lambda x: x[1], reverse=True)[:top_n]
    # Preserve original order
    top_texts = {s for s, _ in top}
    return [s for s in sentences if s in top_texts]


def _detect_meeting_theme(keywords: List[str], topic_titles: List[str]) -> str:
    """Infer a high-level meeting theme from keywords and topic titles."""
    if topic_titles:
        return ", ".join(t.strip() for t in topic_titles[:3] if t.strip())
    all_words = keywords + [w for t in topic_titles for w in _tokenize(t)]
    if not all_words:
        return "organizational discussion"
    freq = Counter(all_words)
    top_words = [w for w, _ in freq.most_common(4)]
    return ", ".join(top_words).rstrip(",")


def _count_speakers(segment_texts: List[str], speaker_labels: Optional[List[str]] = None) -> int:
    if speaker_labels:
        return len(set(speaker_labels))
    return 1


def _urgency_label(urgency: str) -> str:
    mapping = {"critical": "🚨 Critical", "high": "🔴 High Priority", "medium": "🟡 Medium Priority", "low": "🟢 Low Priority"}
    return mapping.get((urgency or "low").lower(), "🟢 Low Priority")


# ── Public API ────────────────────────────────────────────────────────────────

def generate_meeting_summary(
    segment_texts: List[str],
    topics: Optional[List[dict]] = None,
    action_items: Optional[List[dict]] = None,
    decisions: Optional[List[dict]] = None,
    summary_type: str = "balanced",
    speaker_labels: Optional[List[str]] = None,
) -> str:
    """
    Generate a high-quality NLP-driven meeting summary.

    Uses TF-IDF extractive scoring to surface the most important transcript
    sentences, then wraps them in structured prose templates per depth type.

    Args:
        segment_texts:  List of transcript segment strings.
        topics:         Topic clusters [{"title": ..., "summary": ...}, ...]
        action_items:   Action items [{"description": ..., "owner": ..., "urgency": ...}, ...]
        decisions:      Decisions [{"description": ...}, ...]
        summary_type:   'brief' | 'balanced' | 'comprehensive'
        speaker_labels: Optional per-segment speaker labels.

    Returns:
        Formatted summary string.
    """
    if not segment_texts:
        return "No transcript content available to summarise."

    summary_type = (summary_type or "balanced").lower().strip()
    if summary_type not in ("brief", "balanced", "comprehensive"):
        summary_type = "balanced"

    # ── Corpus-level analysis ────────────────────────────────────────────────
    from nlp.intent import clean_text
    full_transcript = " ".join(clean_text(t) for t in segment_texts if t and t.strip())
    all_sentences = _sentence_split(full_transcript)

    all_tokens = _tokenize(full_transcript)
    freq_table = _word_frequencies(all_tokens)
    keywords = _extract_keywords(freq_table, top_n=10)

    topic_titles = [t.get("title", "") for t in (topics or []) if t.get("title")]
    action_descs = [(a.get("description", ""), a.get("owner"), a.get("urgency", "low"), a.get("due"))
                    for a in (action_items or []) if a.get("description")]
    decision_descs = [
        (d["description"] + (f" — *{d['rationale']}*" if d.get("rationale") else ""))
        for d in (decisions or []) if d.get("description")
    ]

    meeting_theme = _detect_meeting_theme(keywords[:6], topic_titles)
    num_speakers = _count_speakers(segment_texts, speaker_labels)
    total_segments = len(segment_texts)

    if summary_type == "brief":
        return _generate_brief(
            all_sentences, freq_table, keywords,
            topic_titles, action_descs, decision_descs,
            meeting_theme, total_segments
        )
    elif summary_type == "comprehensive":
        return _generate_comprehensive(
            all_sentences, full_transcript, freq_table, keywords,
            topics or [], action_descs, decision_descs,
            meeting_theme, num_speakers, total_segments
        )
    else:
        return _generate_balanced(
            all_sentences, freq_table, keywords,
            topic_titles, action_descs, decision_descs,
            meeting_theme, num_speakers
        )


# ── Summary generators ────────────────────────────────────────────────────────

def _generate_brief(
    sentences, freq_table, keywords,
    topic_titles, action_descs, decision_descs,
    meeting_theme, total_segments
) -> str:
    """Brief: TF-IDF top sentences + key extracted facts as concise bullets."""
    top_sents = _tfidf_rank(sentences, top_n=3)

    lines = ["## Executive Briefing\n"]

    # Core insight line
    if top_sents:
        lines.append(f"**Meeting Core Insight:**  \n{top_sents[0]}\n")

    lines.append("---\n")
    lines.append("**Key Highlights:**\n")

    # Topics covered
    if topic_titles:
        topics_str = " | ".join(topic_titles[:5])
        lines.append(f"• 📌 **Agenda Areas:** {topics_str}")
    elif keywords:
        lines.append(f"• 📌 **Central Themes:** {', '.join(keywords[:5])}")

    # Top decision
    if decision_descs:
        lines.append(f"• ✅ **Key Decision:** {decision_descs[0]}")
        for d in decision_descs[1:3]:
            lines.append(f"• ✅ {d}")

    # Top action item
    if action_descs:
        desc, owner, urgency, due = action_descs[0]
        owner_str = f" — *Owner: {owner}*" if owner else ""
        due_str = f" *({due})*" if due else ""
        lines.append(f"• 🎯 **Immediate Action:** {desc}{due_str}{owner_str} [{_urgency_label(urgency)}]")

    # Additional key sentences
    if len(top_sents) > 1:
        lines.append(f"• 💡 **Notable Point:** {top_sents[1]}")

    lines.append(f"\n*Analysed {total_segments} transcript segments | Themes: {meeting_theme}*")

    return "\n".join(lines)


def _generate_balanced(
    sentences, freq_table, keywords,
    topic_titles, action_descs, decision_descs,
    meeting_theme, num_speakers
) -> str:
    """Balanced: Three-paragraph structured overview with TF-IDF extracted key statements."""
    top_sents = _tfidf_rank(sentences, top_n=5)
    opening_sents = _rank_sentences(sentences[:max(1, len(sentences) // 3)], freq_table, top_n=1)
    closing_sents = _rank_sentences(sentences[-(len(sentences) // 3 + 1):], freq_table, top_n=1)

    sections = ["## Meeting Overview\n"]

    # ── Section 1: Context & Coverage ───────────────────────────────────────
    theme_phrase = f"centred around {meeting_theme}" if meeting_theme else "covered key organisational topics"
    participant_note = f"involving {num_speakers} speaker{'s' if num_speakers != 1 else ''}" if num_speakers > 1 else ""
    context_line = opening_sents[0] if opening_sents else (top_sents[0] if top_sents else sentences[0])
    topics_phrase = (
        f"Discussion spanned the following agenda areas: **{', '.join(topic_titles[:5])}**."
        if topic_titles else
        f"Core discussion themes included: *{', '.join(keywords[:6])}*."
    )

    sections.append(
        f"This meeting {theme_phrase}"
        + (f", {participant_note}" if participant_note else "")
        + f". {context_line} {topics_phrase}\n"
    )

    # ── Section 2: Decisions & Outcomes ─────────────────────────────────────
    if decision_descs or len(top_sents) >= 2:
        sections.append("### Decisions & Key Outcomes\n")
        if decision_descs:
            for d in decision_descs[:4]:
                sections.append(f"- **Agreed:** {d}")
            sections.append("")
        elif top_sents:
            for s in top_sents[1:3]:
                sections.append(f"- {s}")
            sections.append("")

    # ── Section 3: Next Steps ────────────────────────────────────────────────
    if action_descs:
        sections.append("### Next Steps & Commitments\n")
        for desc, owner, urgency, due in action_descs[:6]:
            owner_str = f"**{owner}**" if owner else "Unassigned"
            due_str = f" — {due}" if due else ""
            sections.append(f"- {owner_str}: {desc}{due_str} *(Priority: {urgency.title()})*")
        sections.append("")

    # Closing insight
    if closing_sents:
        sections.append(f"> 💬 *{closing_sents[0]}*\n")

    return "\n".join(sections)


def _generate_comprehensive(
    sentences, full_transcript, freq_table, keywords,
    topics_full, action_descs, decision_descs,
    meeting_theme, num_speakers, total_segments
) -> str:
    """Comprehensive: Full multi-section NLP-driven document with evidence sentences."""
    top_sents = _tfidf_rank(sentences, top_n=6)
    sections = []

    # ── Executive Summary ────────────────────────────────────────────────────
    sections.append("## Comprehensive Meeting Intelligence Report\n")
    intro_sent = top_sents[0] if top_sents else sentences[0]
    sections.append(
        f"**Executive Overview:** This meeting addressed core themes in *{meeting_theme}*, "
        f"spanning {total_segments} transcript segments"
        + (f" across {num_speakers} speakers" if num_speakers > 1 else "")
        + f". {intro_sent}\n"
    )

    # ── Meeting Themes & Keywords ────────────────────────────────────────────
    sections.append("---\n")
    sections.append("### 📊 Meeting Themes & Key Terminology\n")
    keyword_str = " · ".join(f"`{kw}`" for kw in keywords[:10])
    sections.append(f"**Dominant Keywords:** {keyword_str}\n")

    # ── Discussion Topics ────────────────────────────────────────────────────
    if topics_full:
        sections.append("### 🗂️ Discussion Topics\n")
        for idx, t in enumerate(topics_full, start=1):
            title = t.get("title", f"Topic {idx}")
            t_summary = t.get("summary", "")
            # Score sentences within the topic summary to find its most informative line
            t_sents = _sentence_split(t_summary)
            t_tokens = _tokenize(t_summary)
            t_freq = _word_frequencies(t_tokens) if t_tokens else freq_table
            t_top = _rank_sentences(t_sents, t_freq, top_n=1)
            best_line = t_top[0] if t_top else t_summary[:200]
            recurring_badge = " *(recurring topic)*" if t.get("is_recurring") else ""
            sections.append(f"**{idx}. {title}**{recurring_badge}  ")
            sections.append(f"{best_line}\n")

    # ── Key Extracted Insights (TF-IDF) ─────────────────────────────────────
    if len(top_sents) >= 2:
        sections.append("### 💡 Key Extracted Insights\n")
        sections.append("*Highest-relevance statements identified via TF-IDF scoring:*\n")
        for s in top_sents[1:5]:
            sections.append(f"> {s}\n")

    # ── Formal Decisions ────────────────────────────────────────────────────
    if decision_descs:
        sections.append("### ✅ Formal Decisions Reached\n")
        for idx, d in enumerate(decision_descs, start=1):
            sections.append(f"{idx}. {d}")
        sections.append("")

    # ── Action Items ─────────────────────────────────────────────────────────
    if action_descs:
        sections.append("### 🎯 Action Items & Assignments\n")
        sections.append("| # | Task | Owner | Due | Priority |")
        sections.append("|---|------|-------|-----|----------|")
        for idx, (desc, owner, urgency, due) in enumerate(action_descs, start=1):
            owner_col = owner if owner else "Unassigned"
            urgency_col = _urgency_label(urgency)
            # Truncate long descriptions
            desc_col = desc if len(desc) <= 100 else desc[:97] + "..."
            sections.append(f"| {idx} | {desc_col} | {owner_col} | {due or '—'} | {urgency_col} |")
        sections.append("")

    # ── Closing Statement ────────────────────────────────────────────────────
    closing_sents = _tfidf_rank(sentences[-max(1, len(sentences) // 4):], top_n=1)
    if closing_sents:
        sections.append("---\n")
        sections.append(f"**Closing Note:** {closing_sents[0]}")
    sections.append(
        f"\n*Report generated from {total_segments} transcript segments using extractive NLP (TF-IDF sentence ranking).*"
    )

    return "\n".join(sections)
