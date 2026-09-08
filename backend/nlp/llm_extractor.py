"""
nlp/llm_extractor.py — Optional LLM-based meeting understanding.

Enabled with ``NLP_ENGINE=llm``.  Sends the speaker-labelled transcript to a
language model and asks for a structured JSON result (topics, decisions with
rationale, action items with owner/deadline, summary).  Two providers:

* ``LLM_PROVIDER=anthropic`` — Claude via the official ``anthropic`` SDK
  (needs ``ANTHROPIC_API_KEY``; ``pip install anthropic``).
* ``LLM_PROVIDER=ollama``    — any local model served by Ollama
  (``ollama run llama3.1``), fully offline.

Any failure (no key, no network, bad JSON) raises ``LLMUnavailable`` and the
pipeline falls back to the local intent engine, so the demo can't break.
"""

from __future__ import annotations

import json
import logging
import re
from typing import List, Optional

from pydantic import BaseModel, Field

from config import settings
from nlp.intent import Utterance

logger = logging.getLogger(__name__)


class LLMUnavailable(RuntimeError):
    """Raised when the LLM engine can't produce a result."""


# ── Output schema ─────────────────────────────────────────────────────────────

class LLMActionItem(BaseModel):
    description: str = Field(description="Imperative task, e.g. 'Send the revised deck to the client'")
    owner: Optional[str] = Field(default=None, description="Person responsible, or null if unassigned")
    due: Optional[str] = Field(default=None, description="Deadline as spoken, e.g. 'by Friday', or null")
    urgency: str = Field(default="medium", description="critical | high | medium | low")
    evidence: str = Field(description="Verbatim transcript sentence(s) this came from")
    segment_index: Optional[int] = Field(default=None, description="Index of the transcript segment")
    confidence: float = Field(default=0.8, ge=0.0, le=1.0)


class LLMDecision(BaseModel):
    description: str = Field(description="What was decided, as a clear statement")
    rationale: Optional[str] = Field(default=None, description="Why, if stated")
    evidence: str
    segment_index: Optional[int] = None
    confidence: float = Field(default=0.8, ge=0.0, le=1.0)


class LLMTopic(BaseModel):
    title: str
    summary: str


class LLMMeetingAnalysis(BaseModel):
    summary: str = Field(description="Markdown meeting summary at the requested depth")
    topics: List[LLMTopic]
    decisions: List[LLMDecision]
    action_items: List[LLMActionItem]
    open_questions: List[str] = Field(default_factory=list)


SYSTEM_PROMPT = """You analyse meeting transcripts for a personal meeting-intelligence tool.

Read the whole transcript and reason about what people actually meant — not which words they used.

Rules:
- A DECISION is something the participants settled on ("let's go with X", "we agreed to postpone", a proposal that others accepted). "We still need to decide", "did we decide?", "if we decide…" are NOT decisions — the first is an open item.
- An ACTION ITEM is a concrete piece of work someone committed to or was asked to do. Resolve "I'll do it" using the preceding request. Use the speaker's name as owner for first-person commitments. In-meeting talk ("I'll share my screen", "let's move on") is not an action item. Things already done are not action items.
- Rewrite each item as a short, clean, self-contained statement (strip fillers, resolve pronouns). Keep deadlines as spoken.
- Quote the exact transcript sentence(s) as evidence and give the segment index.
- Include hedged suggestions only when someone accepted them.
- Only report what is supported by the transcript."""


def _format_transcript(utterances: List[Utterance], names: dict) -> str:
    lines = []
    for u in utterances:
        spk = names.get(u.speaker, u.speaker)
        lines.append(f"[{u.index}] {spk}: {u.text.strip()}")
    return "\n".join(lines)


def _user_prompt(transcript: str, summary_type: str) -> str:
    depth = {
        "brief": "3–5 bullet executive briefing",
        "balanced": "three short sections: context, decisions & outcomes, next steps",
        "comprehensive": "a full report with themes, per-topic discussion, decisions, and an action table",
    }.get(summary_type, "three short sections")
    return (
        f"Summary depth requested: {summary_type} ({depth}).\n\n"
        f"Transcript (each line is `[segment_index] speaker: text`):\n\n{transcript}"
    )


# ── Providers ─────────────────────────────────────────────────────────────────

def _run_anthropic(transcript: str, summary_type: str) -> LLMMeetingAnalysis:
    try:
        import anthropic
    except ImportError as exc:
        raise LLMUnavailable("anthropic SDK not installed (pip install anthropic)") from exc

    kwargs = {}
    if settings.anthropic_api_key:
        kwargs["api_key"] = settings.anthropic_api_key
    client = anthropic.Anthropic(timeout=settings.llm_timeout_seconds, **kwargs)

    try:
        response = client.messages.parse(
            model=settings.llm_model or "claude-opus-5",
            max_tokens=16000,
            system=SYSTEM_PROMPT,
            messages=[{"role": "user", "content": _user_prompt(transcript, summary_type)}],
            output_format=LLMMeetingAnalysis,
        )
    except anthropic.AuthenticationError as exc:
        raise LLMUnavailable("Anthropic API key missing or invalid") from exc
    except anthropic.RateLimitError as exc:
        raise LLMUnavailable("Anthropic rate limit hit") from exc
    except anthropic.APIStatusError as exc:
        raise LLMUnavailable(f"Anthropic API error {exc.status_code}: {exc.message}") from exc
    except anthropic.APIConnectionError as exc:
        raise LLMUnavailable("Could not reach the Anthropic API (network)") from exc

    if getattr(response, "stop_reason", None) == "refusal":
        raise LLMUnavailable("Model declined the request")
    parsed = getattr(response, "parsed_output", None)
    if parsed is None:
        raise LLMUnavailable("Model returned no structured output")
    return parsed


def _run_ollama(transcript: str, summary_type: str) -> LLMMeetingAnalysis:
    import httpx

    schema = LLMMeetingAnalysis.model_json_schema()
    payload = {
        "model": settings.llm_model or "llama3.1",
        "stream": False,
        "format": schema,
        "options": {"temperature": 0.1},
        "messages": [
            {"role": "system", "content": SYSTEM_PROMPT},
            {"role": "user", "content": _user_prompt(transcript, summary_type)},
        ],
    }
    try:
        r = httpx.post(
            f"{settings.ollama_base_url.rstrip('/')}/api/chat",
            json=payload,
            timeout=settings.llm_timeout_seconds,
        )
        r.raise_for_status()
        content = r.json()["message"]["content"]
    except Exception as exc:  # noqa: BLE001
        raise LLMUnavailable(f"Ollama request failed: {exc}") from exc

    try:
        data = json.loads(content)
    except json.JSONDecodeError:
        m = re.search(r"\{.*\}", content, re.DOTALL)
        if not m:
            raise LLMUnavailable("Ollama returned non-JSON output")
        data = json.loads(m.group(0))
    return LLMMeetingAnalysis.model_validate(data)


# ── Public API ────────────────────────────────────────────────────────────────

def analyse_meeting(
    utterances: List[Utterance],
    speaker_names: Optional[dict] = None,
    summary_type: str = "balanced",
) -> LLMMeetingAnalysis:
    """Run the configured LLM provider over the transcript."""
    if not utterances:
        raise LLMUnavailable("Empty transcript")

    transcript = _format_transcript(utterances, speaker_names or {})
    provider = (settings.llm_provider or "anthropic").lower()
    logger.info("Running LLM extraction via %s (%s)…", provider, settings.llm_model)

    if provider == "anthropic":
        return _run_anthropic(transcript, summary_type)
    if provider == "ollama":
        return _run_ollama(transcript, summary_type)
    raise LLMUnavailable(f"Unknown LLM_PROVIDER '{provider}'")
