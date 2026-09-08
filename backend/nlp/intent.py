"""
nlp/intent.py — Context- and intent-aware extraction of action items and decisions.

Why this exists
---------------
The original classifier fired on keywords: any sentence containing "decide"
became a decision, any sentence containing "will" became a to-do.  That
produced output like *"We still need to decide on the vendor"* → **Decision**,
which is the opposite of what was said.

This module instead looks at *what the sentence does* (its speech act) and the
conversational context around it:

* **Commitments**  — "I'll send the deck by Friday"          → to-do, owner = speaker
* **Assignments**  — "Priya will update the docs"            → to-do, owner = Priya
* **Requests**     — "Karan, can you check the logs?"        → to-do, owner = Karan / responder
* **Collective**   — "We need to finalise the budget"        → to-do (team)
* **Open items**   — "We still need to decide on the vendor" → to-do: *Decide on the vendor*
* **Decisions**    — "Let's go with Postgres", "We agreed to postpone the launch",
                     proposal + agreement across two speakers → decision
* Questions, hypotheticals ("if we decide…"), negations ("we haven't decided"),
  hedges ("maybe we could…") and things already done ("I sent it yesterday")
  are recognised and *not* reported as decisions / to-dos.

Everything is offline and dependency-free (regex + small lexicons) so the demo
can never fail because of a missing model or network.  Every extracted item
carries a normalised description, owner, deadline, confidence, and the verbatim
sentence it came from.
"""

from __future__ import annotations

import re
from dataclasses import dataclass, field
from typing import Dict, Iterable, List, Optional, Sequence, Tuple


# ═════════════════════════════════════════════════════════════════════════════
# Data types
# ═════════════════════════════════════════════════════════════════════════════

@dataclass
class Utterance:
    """One transcript segment with its speaker display name."""
    index: int
    speaker: str
    text: str
    start: float = 0.0
    end: float = 0.0


@dataclass
class ActionItem:
    description: str
    owner: Optional[str]
    due: Optional[str]
    confidence: float
    evidence: str
    segment_index: int
    speaker: str
    kind: str = "task"          # task | open_item


@dataclass
class Decision:
    description: str
    rationale: Optional[str]
    confidence: float
    evidence: str
    segment_index: int
    speaker: str


@dataclass
class ExtractionResult:
    action_items: List[ActionItem] = field(default_factory=list)
    decisions: List[Decision] = field(default_factory=list)


@dataclass
class SentenceAnalysis:
    """Result of analysing a single sentence in isolation (used by classifier.classify)."""
    intent: str                     # commitment | assignment | request | collective | open_item |
                                    # decision | proposal | agreement | question | done | general
    confidence: float
    description: str
    owner: Optional[str] = None
    due: Optional[str] = None
    rationale: Optional[str] = None
    is_question: bool = False
    is_conditional: bool = False
    is_negated: bool = False
    is_hedged: bool = False


# ═════════════════════════════════════════════════════════════════════════════
# Lexicons
# ═════════════════════════════════════════════════════════════════════════════

_LEADING_FILLERS = re.compile(
    r"^(?:(?:so|okay|ok|yeah|yes|yep|yup|alright|all right|right|well|um+|uh+|hmm+|erm|"
    r"like|and|but|then|anyway|anyways|basically|actually|honestly|obviously|"
    r"i mean|you know|i think|i guess|i believe|i feel like|i suppose|look|listen|"
    r"great|cool|perfect|sure|fine|good|nice|no worries|no problem|thanks|thank you)"
    r"[,.!\s]+)+",
    re.IGNORECASE,
)
_INLINE_FILLERS = re.compile(
    r"\b(?:um+|uh+|hmm+|erm|you know|i mean|kind of|sort of|kinda|sorta)\b[,]?\s*",
    re.IGNORECASE,
)

_HEDGE_RE = re.compile(
    r"\b(?:maybe|perhaps|probably|possibly|might|may|could possibly|i think|i guess|i suppose|"
    r"not sure|i'?m not sure|we could|we might|one option|an option|ideally|hopefully|"
    r"at some point|eventually|someday|some time|sometime|if possible|if we can|"
    r"i'?d suggest|i suggest|i'?d propose|i propose|how about|what about|would it make sense)\b",
    re.IGNORECASE,
)
_CONDITIONAL_RE = re.compile(
    r"^(?:if|unless|in case|suppose|supposing|what if|assuming|should we|say we|imagine|"
    r"even if|whether)\b|"
    r"\b(?:if we|if you|if they|if he|if she|if it|if that|if this|unless we|in case we|"
    r"depending on|depends on|assuming that|as long as)\b",
    re.IGNORECASE,
)
_QUESTION_RE = re.compile(r"\?\s*$")
_WH_QUESTION_RE = re.compile(
    r"^(?:what|when|where|which|who|whom|whose|why|how|did|do|does|is|are|was|were|has|have|had|"
    r"should|shall|would|could|can|will|any idea|any thoughts)\b",
    re.IGNORECASE,
)

# Negations that cancel a commitment / decision when they precede the trigger.
_NEG_BEFORE_RE = re.compile(
    r"\b(?:not|no|never|haven'?t|hasn'?t|hadn'?t|didn'?t|don'?t|doesn'?t|won'?t|wouldn'?t|"
    r"can'?t|cannot|couldn'?t|shouldn'?t|isn'?t|aren'?t|wasn'?t|weren'?t|nobody|no one|"
    r"nothing|without|yet to|still to|unable to|not yet)\b",
    re.IGNORECASE,
)

# Things that are already finished — not a to-do.
_DONE_RE = re.compile(
    r"\b(?:already|yesterday|last (?:week|night|month|time|sprint)|this morning i|"
    r"i(?:'ve| have) (?:already )?(?:sent|done|finished|completed|updated|fixed|shared|pushed|merged|"
    r"deployed|submitted|reviewed|checked|talked|spoken|written|created|scheduled|booked)|"
    r"we(?:'ve| have) (?:already )?(?:sent|done|finished|completed|updated|fixed|shared|pushed|merged|"
    r"deployed|submitted|reviewed|checked|decided|agreed|closed|shipped)|"
    r"(?:is|are|was|were) (?:already )?(?:done|finished|complete|completed|sorted|resolved|closed|fixed|merged|deployed))\b",
    re.IGNORECASE,
)

# Verbs that indicate a real piece of work.
_ACTION_VERBS = {
    "send", "share", "prepare", "draft", "write", "update", "review", "check", "confirm",
    "schedule", "set", "setup", "create", "build", "design", "document", "present", "research",
    "investigate", "look", "analyze", "analyse", "validate", "coordinate", "notify", "escalate",
    "migrate", "fix", "resolve", "test", "deploy", "implement", "finish", "complete", "submit",
    "follow", "reach", "contact", "call", "email", "ping", "talk", "sync", "meet", "book", "order",
    "buy", "get", "gather", "collect", "compile", "summarize", "summarise", "circulate", "publish",
    "push", "merge", "release", "ship", "run", "add", "remove", "clean", "refactor", "integrate",
    "configure", "install", "upgrade", "replace", "move", "organize", "organise", "plan", "put",
    "work", "take", "handle", "own", "dig", "figure", "find", "decide", "finalize", "finalise",
    "sort", "wrap", "start", "kick", "arrange", "invite", "ask", "remind", "upload", "download",
    "record", "measure", "monitor", "track", "report", "bring", "brief", "train", "onboard", "hire",
    "recruit", "interview", "estimate", "calculate", "revise", "rewrite", "redo", "verify", "approve",
    "sign", "pay", "budget", "allocate", "assign", "delegate", "translate", "print", "demo",
    "rehearse", "practice", "practise", "study", "read", "learn", "explore", "evaluate", "compare",
    "benchmark", "profile", "optimize", "optimise", "debug", "patch", "rollback", "restart",
    "backup", "restore", "archive", "delete", "purge", "audit", "inspect", "survey", "poll",
    "reply", "respond", "circle", "loop", "align", "discuss", "connect", "introduce", "prioritize",
    "prioritise", "reschedule", "cancel", "postpone", "renew", "extend", "negotiate", "draft",
    "outline", "sketch", "mock", "wireframe", "prototype", "spec", "define", "clarify", "map",
    "list", "log", "file", "raise", "open", "close", "resolve", "triage", "answer", "provide",
    "give", "make", "do", "double-check", "recheck", "pull", "fetch", "generate", "export",
    "import", "convert", "label", "tag", "annotate", "collect", "consolidate", "reconcile",
    "coordinate", "communicate", "announce", "inform", "tell", "let", "walk", "go", "come", "try",
    "look", "think", "chase", "nudge", "pitch", "propose", "draft", "reserve", "register", "apply",
    "enroll", "enrol", "sign-up", "signup", "attend", "join", "host", "organise", "lead", "drive",
    "own", "manage", "oversee", "support", "help", "assist", "cover", "fill", "populate", "seed",
    "load", "wire", "hook", "connect", "ship", "bundle", "package", "version", "tag", "cut",
}

# "I'll <verb>" where the verb is in-meeting talk, not a piece of work.
_NON_WORK_PHRASES = re.compile(
    r"^(?:be (?:honest|quick|brief|short|right back|frank|clear)|say|tell you|mention|"
    r"explain|walk (?:you|us|everyone) through|show you|go through|come back to (?:that|this|it)|"
    r"get to (?:that|this|it)|skip|leave (?:it|that|this)|stop (?:here|there|now)|wait|hold on|"
    r"pass|move on|jump (?:in|to)|answer that|repeat|keep (?:it|this) short|take that as|"
    r"take it that|see|see you|talk (?:later|soon|then)|catch you|let you (?:go|finish|speak)|"
    r"share my screen|share the screen|share screen|mute|unmute|go on mute|drop off|"
    r"turn (?:on|off) (?:my|the) (?:camera|video|mic)|read (?:it|that|this) out|"
    r"put (?:it|that|this) (?:in|on) (?:the )?(?:chat|screen)|paste (?:it|that|this) in the chat|"
    r"give you (?:a|an|the) (?:example|overview|quick)|start with|begin with|go (?:first|next|last)|"
    r"present (?:next|first)|open (?:the|my) (?:slides|deck)|switch (?:to|over) (?:the )?(?:slides|deck|screen)|"
    r"stop sharing|hand (?:it )?over to|hand (?:it )?back to)\b",
    re.IGNORECASE,
)

# Objects that are too vague on their own ("I'll do it") → resolve from context.
_VAGUE_OBJECT_RE = re.compile(
    r"^(?:(?:do|handle|take|own|take care of|look into|check|get on|work on|sort|sort out|"
    r"pick up|take up|cover|manage|deal with|get|get it|go ahead|go ahead with|get that done|"
    r"get it done|take this one|take that one|take this|take that|do so|do the same|"
    r"do this|do that|do it|take it|take care of it|take care of that|handle it|handle that|"
    r"own it|own that|look into it|look into that|check that|check it|work on it|work on that|"
    r"sort it|sort it out|sort that out|pick it up|pick that up|take it on|take that on|get it done|get that done|"
    r"get this done|get them done|make it happen|make that happen)"
    r"(?:\s+(?:it|that|this|those|these|one|them))?(?:\s+(?:done|sorted|finished))?"
    r"(?:\s+(?:today|tonight|tomorrow|this week|next week|asap|by \w+(?: \w+)?|before \w+(?: \w+)?|"
    r"after \w+(?: \w+)?|later|now|right away|first))?)[.!]?$",
    re.IGNORECASE,
)

_CAP_NOT_NAME = {
    "I", "The", "This", "That", "These", "Those", "We", "You", "He", "She", "They", "It",
    "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday",
    "January", "February", "March", "April", "May", "June", "July", "August", "September",
    "October", "November", "December", "Q1", "Q2", "Q3", "Q4", "Team", "Everyone", "Someone",
    "Somebody", "Anyone", "Nobody", "Okay", "Ok", "Yes", "No", "So", "And", "But", "Also",
    "Then", "Now", "Today", "Tomorrow", "Next", "Last", "Please", "Thanks", "Thank", "Let",
    "Maybe", "Well", "Right", "Sure", "Great", "Good", "Fine", "Alright", "Um", "Uh", "Hi",
    "Hello", "Hey", "Speaker", "Client", "Customer", "Management", "Marketing", "Sales",
    "Engineering", "Design", "Product", "Finance", "Legal", "Ops", "Qa", "Hr", "Api", "Ui",
    "Ux", "Db", "Sql", "Aws", "Gcp", "Azure", "Github", "Jira", "Slack", "Google", "Microsoft",
    "Postgres", "Mysql", "Mongo", "Redis", "Docker", "Kubernetes", "React", "Python", "Java",
    "Node", "Whisper", "English", "Hindi", "Gujarati", "Cmis", "Ai", "Ml", "Nlp", "Mom", "Ppt",
    "Pdf", "Csv", "Json", "Http", "Https", "Url", "Id", "Ok", "Tbd", "Asap", "Eod", "Eow",
    "Cto", "Ceo", "Cfo", "Vp", "Hod", "Sir", "Madam", "Ma'am", "Mr", "Mrs", "Ms", "Dr", "Prof",
    "Professor", "Panel", "Guide", "Mentor", "Everybody", "All", "Both", "Each", "Either",
    "Which", "What", "When", "Where", "Who", "Why", "How", "If", "Because", "Since", "While",
    "After", "Before", "Until", "Once", "Whenever", "Meanwhile", "However", "Therefore",
    "Basically", "Actually", "Obviously", "Honestly", "Anyway", "Anyways", "Firstly", "Secondly",
    "Finally", "Lastly", "Overall", "Regarding", "About", "For", "From", "With", "Without",
}

_PERSON_TOKEN = r"(?-i:[A-Z][a-z]{1,20})"

# Deadline / time expressions.
_TIMEX = (
    r"(?:eod|eow|eom|cob|asap|"
    r"end of (?:the )?(?:day|week|month|quarter|sprint|year)|"
    r"(?:start|beginning) of (?:the )?(?:next )?(?:week|month|quarter|sprint)|"
    r"today|tonight|tomorrow(?: morning| afternoon| evening| noon)?|"
    r"(?:next|this|coming|the coming|early next|later this|end of next|end of this) "
    r"(?:week|month|quarter|sprint|year|monday|tuesday|wednesday|thursday|friday|saturday|sunday|weekend)|"
    r"(?:mon|tues|wednes|thurs|fri|satur|sun)day(?: (?:morning|afternoon|evening|noon|night))?|"
    r"q[1-4](?: \d{4})?|"
    r"(?:jan(?:uary)?|feb(?:ruary)?|mar(?:ch)?|apr(?:il)?|may|jun(?:e)?|jul(?:y)?|aug(?:ust)?|"
    r"sep(?:t|tember)?|oct(?:ober)?|nov(?:ember)?|dec(?:ember)?)(?: \d{1,2}(?:st|nd|rd|th)?)?(?:,? \d{4})?|"
    r"the \d{1,2}(?:st|nd|rd|th)(?: of [a-z]+)?|"
    r"\d{1,2}(?:st|nd|rd|th)? (?:of )?(?:jan(?:uary)?|feb(?:ruary)?|mar(?:ch)?|apr(?:il)?|may|jun(?:e)?|"
    r"jul(?:y)?|aug(?:ust)?|sep(?:t|tember)?|oct(?:ober)?|nov(?:ember)?|dec(?:ember)?)|"
    r"\d{1,2}/\d{1,2}(?:/\d{2,4})?|"
    r"(?:a|an|one|two|three|four|five|six|seven|\d+) (?:hour|day|week|month)s?|"
    r"(?:the )?(?:next )?(?:release|launch|demo|review|standup|stand-up|deadline|sprint|meeting|"
    r"call|viva|presentation|submission|deployment|go-live|go live|cutover|milestone|exam|semester)"
    r"(?: (?:on|next|this) \w+)?|"
    r"noon|midnight|lunch|\d{1,2}(?::\d{2})? ?(?:am|pm)"
    r")"
)
_DUE_RE = re.compile(
    r"\b((?:by|before|until|till|no later than|not later than|within|due|due by|due on|ahead of|"
    r"prior to|latest by|by the end of|by end of)\s+(?:the\s+)?(?:end of\s+)?(?:the\s+)?" + _TIMEX +
    r"(?:\s+(?:morning|afternoon|evening|night|noon|at \d{1,2}(?::\d{2})?\s?(?:am|pm)?))?)\b",
    re.IGNORECASE,
)
_STANDALONE_DUE_RE = re.compile(
    r"\b(today|tonight|tomorrow(?: morning| afternoon| evening)?|this week|next week|this weekend|"
    r"by then|asap|as soon as possible|right away|immediately|(?:on )?(?:mon|tues|wednes|thurs|fri|satur|sun)day)\b",
    re.IGNORECASE,
)

# Decision-ish predicates after "let's / we'll / we're going to".
_DECISION_PREDICATE = (
    r"(?:go|move|proceed|move forward|move ahead|push ahead|carry on|continue|stick|stay|settle|"
    r"finalize|finalise|lock|freeze|sign off|sign-off|approve|adopt|use|switch|migrate|standardize|"
    r"standardise|pick|choose|select|keep|drop|scrap|cancel|kill|shelve|park|postpone|delay|defer|"
    r"push|prioritize|prioritise|deprioritize|deprioritise|rename|split|merge|separate|combine|"
    r"replace|swap|retire|sunset|deprecate|remove|not|no longer|stop|start|launch|ship|release|"
    r"hire|outsource|extend|shorten|increase|reduce|cut|raise|lower|cap|limit|allow|ban|require|"
    r"make|treat|call it|call this|leave|hold off|wait|skip|pause|table|revisit|go ahead|go live|"
    r"target|aim for|commit to|agree on|opt for|go for|do)"
)

_PROPOSAL_RE = re.compile(
    r"^(?:(?:how|what) about|why don'?t we|why not|should we|shall we|could we|can we|"
    r"do you think we (?:should|could)|i(?:'d| would) (?:suggest|propose|recommend)|i suggest|"
    r"i propose|i recommend|my (?:suggestion|proposal|recommendation) (?:is|would be)|"
    r"one option (?:is|would be)|we could (?:also |just |maybe )?|we might (?:want to |as well )?|"
    r"maybe we (?:should|could|can)|perhaps we (?:should|could|can)|i think we (?:should|could|need to)|"
    r"what if we|i(?:'d| would) (?:say|go with|prefer|lean towards|lean toward)|"
    r"i(?:'m| am) (?:in favou?r of|leaning towards|leaning toward)|"
    r"(?:my|the) (?:vote|preference) (?:is|would be))\b",
    re.IGNORECASE,
)

_AGREEMENT_MARKERS = (
    r"(?:yes|yeah|yep|yup|ya|sure|okay|ok|alright|all right|fine|right|absolutely|definitely|"
    r"exactly|totally|agreed|agree|i agree|we agree|sounds good|sounds great|sounds like a plan|"
    r"works for me|fine by me|fine with me|good with me|okay with me|ok with me|makes sense|"
    r"that makes sense|let'?s do that|let'?s do it|let'?s go with that|go for it|go ahead|"
    r"perfect|great|cool|deal|done|good idea|great idea|nice|i'?m (?:fine|good|okay|ok) with that|"
    r"no objections?|no objection from me|\+1|plus one|same here|i(?:'m| am) on board|on board|"
    r"that works|works|fair enough|i(?:'m| am) okay with that|i(?:'m| am) fine with that|"
    r"i(?:'m| am) good with that|ship it|approved|sign(?:ed)? off|let'?s go for it|"
    r"that(?:'s| is) fine|that(?:'s| is) (?:a )?good|good call|good plan|sounds right|"
    r"i(?:'m| am) happy with that|happy with that|no problem|of course|yes please|please do|do it)"
)
_AGREEMENT_RE = re.compile(
    r"^(?:\b" + _AGREEMENT_MARKERS + r"\b[\s,.!]*)+(?:then|so|with that|on that|to that|to me)?[\s,.!]*$",
    re.IGNORECASE,
)
_DISAGREEMENT_RE = re.compile(
    r"^(?:no|nope|nah|not really|i(?:'m| am) not sure|i don'?t think so|i disagree|"
    r"i(?:'d| would) rather not|hmm|i(?:'m| am) not convinced|i(?:'d| would) push back|"
    r"not sure about that|that won'?t work|that doesn'?t work|i(?:'m| am) against)\b",
    re.IGNORECASE,
)

_SELF_INTRO_RE = re.compile(
    r"\b(?:this is|i(?:'m| am)|my name is|it'?s|myself)\s+(" + _PERSON_TOKEN + r")\b(?:\s+(?:here|speaking|from|on))?|"
    r"^(?:(?:hi|hello|hey|good (?:morning|afternoon|evening)|everyone|everybody|folks|team|guys|all|yeah|okay|ok|so)[,!.\s]+)*"
    r"(" + _PERSON_TOKEN + r") (?:here|speaking)\b",
    re.IGNORECASE,
)

_SPEAKER_LABEL_RE = re.compile(r"^SPEAKER[_ ]?\d+$", re.IGNORECASE)

_OPEN_ITEM_VERBS = {
    "decide": "Decide on", "make a decision": "Decide on", "make a call": "Decide on", "take a call": "Decide on",
    "take a decision": "Decide on", "come to a decision": "Decide on", "reach a decision": "Decide on",
    "agree": "Agree on", "align": "Align on", "settle": "Settle", "finalize": "Finalize", "finalise": "Finalise",
    "figure out": "Figure out", "work out": "Work out", "sort out": "Sort out", "nail down": "Nail down",
    "pin down": "Pin down", "lock down": "Lock down", "discuss": "Discuss", "resolve": "Resolve",
    "confirm": "Confirm", "pick": "Pick", "choose": "Choose", "clarify": "Clarify",
}


# ═════════════════════════════════════════════════════════════════════════════
# Text helpers
# ═════════════════════════════════════════════════════════════════════════════

def clean_text(text: str) -> str:
    """Remove disfluencies and leading discourse markers; normalise whitespace."""
    t = text.strip()
    t = _INLINE_FILLERS.sub("", t)
    t = _LEADING_FILLERS.sub("", t)
    t = re.sub(r"\s+", " ", t)
    t = re.sub(r"\s+([,.!?;:])", r"\1", t)
    t = re.sub(r"(,\s*){2,}", ", ", t)
    t = t.strip(" ,;:-–—")
    return t


def split_sentences(text: str) -> List[str]:
    """Split a segment into sentences on terminal punctuation."""
    text = text.strip()
    if not text:
        return []
    parts = re.split(r"(?<=[.!?])\s+(?=[A-Za-z\"'(])", text)
    out: List[str] = []
    for p in parts:
        p = p.strip()
        if not p:
            continue
        # ", so Dev will talk to finance" / "; I'll send it" — separate clauses
        for clause in re.split(r"(?:,|;)\s+(?:so|and then|then)\s+(?=(?:i|we|you|he|she|they|let'?s|" + _PERSON_TOKEN + r")\b)", p, flags=re.IGNORECASE):
            clause = clause.strip()
            if clause:
                out.append(clause)
    return out or [text]


def _tokens(text: str) -> List[str]:
    return re.findall(r"[a-z0-9']+", text.lower())


def _jaccard(a: Iterable[str], b: Iterable[str]) -> float:
    sa, sb = set(a), set(b)
    if not sa or not sb:
        return 0.0
    return len(sa & sb) / len(sa | sb)


def _capitalize(text: str) -> str:
    text = text.strip()
    if not text:
        return text
    if text[0].islower():
        text = text[0].upper() + text[1:]
    return text


_TRAILING_DISCOURSE = re.compile(
    r"(?:[,\s]+(?:though|anyway|anyways|then|right|okay|ok|i think|i guess|i suppose|you know|for now|"
    r"if that'?s okay|if possible|or so|basically|actually|honestly|really|obviously))+\s*$",
    re.IGNORECASE,
)


def _strip_terminal(text: str) -> str:
    text = text.strip().rstrip(".!?;:, ").strip()
    return _TRAILING_DISCOURSE.sub("", text).strip()


def _looks_like_name(token: str, known: Sequence[str] = ()) -> bool:
    if token in known:
        return True
    if token in _CAP_NOT_NAME:
        return False
    return bool(re.fullmatch(r"[A-Z][a-z]{1,20}", token))


def _find_due(text: str) -> Optional[str]:
    m = _DUE_RE.search(text)
    if m:
        return m.group(1).strip()
    m = _STANDALONE_DUE_RE.search(text)
    if m:
        return m.group(1).strip()
    return None


def _split_rationale(text: str) -> Tuple[str, Optional[str]]:
    m = re.search(r"\b(because|since|so that|given that|due to|the reason being|as it)\b", text, re.IGNORECASE)
    if not m or m.start() < 8:
        return text, None
    head = text[: m.start()].strip(" ,;-")
    tail = text[m.end():].strip(" ,;-")
    if len(tail.split()) < 2:
        return text, None
    return head, _capitalize(_strip_terminal(tail))


def _first_verb_ok(remainder: str) -> bool:
    """True when the remainder starts with something that reads as a task."""
    if not remainder:
        return False
    if _NON_WORK_PHRASES.match(remainder):
        return False
    words = _tokens(remainder)
    if not words:
        return False
    first = words[0]
    if first in ("be", "being", "have", "having", "get", "getting") and len(words) > 1:
        first = words[1]
    # "-ing" forms ("sending") and inflected forms ("sends") count too.
    stem = re.sub(r"(?:ing|es|s|ed)$", "", first)
    return first in _ACTION_VERBS or stem in _ACTION_VERBS or (first + "e") in _ACTION_VERBS


# ═════════════════════════════════════════════════════════════════════════════
# Trigger patterns (ordered — first match wins)
# ═════════════════════════════════════════════════════════════════════════════

_LEAD = r"^(?:(?:so|okay|ok|then|and|but|also|yeah|yes|sure|alright|well|right|now|next|first|"
_LEAD += r"secondly|finally|lastly|plus|anyway|i think|i guess|i believe|ideally|basically|probably|maybe)[,\s]+)*"
_VOCATIVE = r"(?:(?P<voc>" + _PERSON_TOKEN + r")[,:]\s+)?"
_SOFT = r"(?:(?:just|also|then|probably|maybe|quickly|definitely|go ahead and|go and|try to|try and|"
_SOFT += r"make sure to|make sure that|make sure|be sure to|remember to|please|kindly|start to|start)\s+)*"

_TRIGGERS: List[Tuple[str, re.Pattern, float]] = [
    # explicit labels ---------------------------------------------------------
    ("assignment", re.compile(
        _LEAD + r"(?:action item|to-?do|next step|follow-?up|homework|task)(?: for (?P<owner>" + _PERSON_TOKEN +
        r"))?(?: is| would be)?[:\-–]?\s*(?:to\s+)?(?:(?P<owner2>" + _PERSON_TOKEN + r") (?:to|will|should|needs? to)\s+)?"
        r"(?P<rest>.+)$", re.IGNORECASE), 0.9),
    # open items ("we still need to decide on X") -----------------------------
    ("open_item", re.compile(
        _LEAD + r"(?:we|the team|i|you|somebody|someone|everyone|nobody|no one|no-one)\s+(?:still\s+|also\s+|really\s+)?"
        r"(?:need(?:s)? to|have to|has to|got to|gotta|must|should|ought to|will have to|are yet to|is yet to|"
        r"haven'?t|hasn'?t|have not|has not|has|have)\s+(?:still\s+|yet\s+|not\s+)?(?:(?:actually|really|properly|finally)\s+)?"
        r"(?P<verb>decide|decided|figure out|figured out|agree|agreed|settle|settled|finalize|finalise|finalized|finalised|"
        r"work out|worked out|discuss|discussed|resolve|resolved|confirm|confirmed|pick|picked|choose|chosen|"
        r"align|aligned|sort out|sorted out|come to a decision|reach a decision|make a call|make a decision|"
        r"take a call|take a decision|nail down|pin down|lock down|clarify|clarified)\b"
        r"\s*(?P<rest>.*)$", re.IGNORECASE), 0.62),
    ("open_item", re.compile(
        _LEAD + r"(?:(?:that|this|it)(?:'s| is)|(?:the )?\w+ is)\s+(?:still\s+)?(?:open|undecided|tbd|to be decided|"
        r"up in the air|not (?:yet )?(?:decided|final|finalized|finalised|settled|confirmed))\b(?P<rest>.*)$",
        re.IGNORECASE), 0.5),
    # decisions ---------------------------------------------------------------
    ("decision", re.compile(
        _LEAD + r"(?:(?:we|the team|everyone|everybody|both of us|all of us|management|the client|the customer|"
        r"the panel|they|" + _PERSON_TOKEN + r")(?:'ve| have| has|'s)?\s+(?:all\s+|now\s+|finally\s+|just\s+|also\s+)?"
        r"(?:decided|agreed|settled|concluded|resolved|confirmed|approved|signed off|signed-off|finalized|finalised|"
        r"locked in|aligned|voted|committed)\s+(?P<prep>to|on|that|upon|with)?\s*(?P<rest>.+)$)", re.IGNORECASE), 0.9),
    ("decision", re.compile(
        _LEAD + r"(?:it(?:'s| is| was| has been|'s been)|that(?:'s| is| was)|this(?:'s| is| was))\s+"
        r"(?:now\s+|officially\s+|finally\s+|been\s+)?"
        r"(?:decided|agreed|settled|confirmed|approved|final|finalized|finalised|a go|official|locked|locked in)"
        r"\s*[:,]?\s*(?:that|to|on|then|:)?\s*(?P<rest>.*)$", re.IGNORECASE), 0.8),
    ("decision", re.compile(
        _LEAD + r"(?:the|our|that|this) (?:decision|final call|call|verdict|consensus|conclusion|outcome|resolution|agreement)"
        r"(?: here| then| for now)?(?:'s| is| was| will be| would be|:)\s+(?:that|to|on)?\s*(?P<rest>.+)$",
        re.IGNORECASE), 0.8),
    ("decision", re.compile(
        _LEAD + _VOCATIVE + r"(?:let'?s|we'?ll|we will|we(?:'re| are) going to|we(?:'re| are) gonna|we(?:'re| are)|"
        r"we should|we can|we'?d|we would|let us|the plan is to|plan is to|we(?:'re| are) planning to)\s+"
        r"(?:just\s+|then\s+|all\s+|simply\s+|officially\s+|now\s+|definitely\s+)?"
        r"(?P<rest>" + _DECISION_PREDICATE + r"\b.*)$", re.IGNORECASE), 0.72),
    ("decision", re.compile(
        _LEAD + r"(?:(?:so|then)\s+)?(?P<subj>(?:the |our |this |that )?(?:\w+ ){1,4})(?:is|are|has been|have been) "
        r"(?:now |officially |finally )?(?P<verdict>approved|agreed|signed off|green-?lit|greenlit|confirmed|a go|final|finalized|finalised|"
        r"locked|locked in|settled|decided|done deal|off the table|cancelled|canceled|postponed|rejected)\b\s*(?:then|now)?(?P<rest>.*)$",
        re.IGNORECASE), 0.75),
    ("decision", re.compile(
        _LEAD + r"(?:(?:so|then)\s+)?(?:(?:going|moving) (?:ahead|forward) with|no longer (?:doing|going|pursuing|"
        r"supporting|using)|not (?:doing|going ahead with|pursuing|going with|moving forward with)|"
        r"(?:consensus|final answer|final decision|verdict) (?:is|was))\s*(?P<rest>.*)$", re.IGNORECASE), 0.75),
    # requests ----------------------------------------------------------------
    ("request", re.compile(
        _LEAD + _VOCATIVE + r"(?:can|could|would|will|shall)\s+(?:you|u)\s+(?:please\s+|maybe\s+|just\s+|also\s+|quickly\s+)?"
        + _SOFT + r"(?P<rest>.+)$", re.IGNORECASE), 0.75),
    ("request", re.compile(
        _LEAD + _VOCATIVE + r"(?:please|kindly|pls|plz)\s+" + _SOFT + r"(?P<rest>.+)$", re.IGNORECASE), 0.72),
    ("request", re.compile(
        _LEAD + _VOCATIVE + r"(?:i(?:'d| would) like (?:you|someone|somebody) to|i(?:'d| would) appreciate it if you (?:could|would)|"
        r"i need (?:you|someone|somebody) to|i want (?:you|someone|somebody) to|it would be great if you (?:could|can)|"
        r"could someone|can someone|could somebody|can somebody|would someone|would somebody|"
        r"we need (?:someone|somebody) to|we need (?:you|" + _PERSON_TOKEN + r") to|"
        r"you(?:'ll| will) (?:need|have) to|you need to|you have to|you should|you must|you(?:'ll| will|'re going to| are going to)|"
        r"your (?:job|task|action item|homework) is to|make sure (?:you|that you)|don'?t forget to|remember to|"
        r"(?P<owner>" + _PERSON_TOKEN + r")(?:,)? (?:you(?:'ll| will)|you need to|you have to|you should|please))\s+"
        + _SOFT + r"(?P<rest>.+)$", re.IGNORECASE), 0.72),
    # assignments (third person) ----------------------------------------------
    ("assignment", re.compile(
        _LEAD + r"(?P<owner>" + _PERSON_TOKEN + r"(?: and " + _PERSON_TOKEN + r")?)\s+"
        r"(?:will|'ll|is going to|is gonna|shall|should|needs? to|has to|have to|must|is to|was asked to|"
        r"has been asked to|agreed to|volunteered to|offered to|is responsible for|is in charge of|will be responsible for|"
        r"takes care of|will take care of|will handle|will own|owns|is going to handle|is going to own|"
        r"can|could|would|is supposed to|has agreed to|is expected to|is on|is doing|will be doing|to)\s+"
        + _SOFT + r"(?P<rest>.+)$", re.IGNORECASE), 0.85),
    ("assignment", re.compile(
        _LEAD + r"(?:(?:let'?s|we(?:'ll| will| should| can))\s+)?(?:assign|give|hand|delegate|leave)\s+(?:that|this|it|the \w+(?: \w+)?)?\s*"
        r"(?:to|with)\s+(?P<owner>" + _PERSON_TOKEN + r")\b(?P<rest>.*)$", re.IGNORECASE), 0.7),
    ("assignment", re.compile(
        _LEAD + r"(?P<owner>" + _PERSON_TOKEN + r")(?:,)?\s+(?:you(?:'ll| will)|you(?:'re| are) going to|you can|you could|"
        r"you need to|you have to|you should|you take|take)\s+" + _SOFT + r"(?P<rest>.+)$", re.IGNORECASE), 0.8),
    ("assignment", re.compile(
        _LEAD + r"(?:(?:the )?(?:owner|point person|poc|driver|lead) (?:for (?:that|this|it|the \w+(?: \w+)?) )?"
        r"(?:is|will be|would be)|(?:that|this|it)(?:'s| is) (?:on|with|for)|(?:that|this|it) (?:goes|falls) to)\s+"
        r"(?P<owner>" + _PERSON_TOKEN + r")\b(?P<rest>.*)$", re.IGNORECASE), 0.6),
    # first-person commitments -----------------------------------------------
    ("commitment", re.compile(
        _LEAD + r"(?:i(?:'ll| will| shall| am going to|'m going to|'m gonna| am gonna| can| could| would| plan to|"
        r"'m planning to| am planning to| intend to| need to| have to|'ve got to| gotta| must| should|'d better|"
        r"'ll be| will be|'m happy to| am happy to|'ll go ahead and|'ll take|'ll own|'ll handle|'ll take care of|"
        r" will take| will own| will handle|'ll get|'ll try to| will try to|'ll make sure|'ll look)|let me|leave (?:it|that|this) (?:to|with) me|"
        r"i(?:'ll| will| can) take (?:that|this|it)(?: one)?(?: on)?|(?:that|this|it)(?:'s| is) on me|i(?:'m| am) on it|"
        r"i(?:'ve| have) got (?:that|this|it)|i got (?:that|this|it)|count on me|i(?:'ll| will) do (?:that|this|it))\s*"
        + _SOFT + r"(?P<rest>.*)$", re.IGNORECASE), 0.8),
    # collective obligations --------------------------------------------------
    ("collective", re.compile(
        _LEAD + r"(?:we|the team|everyone|everybody|somebody|someone|all of us|both of us|you guys|you all|y'all|"
        r"the (?:backend|frontend|dev|design|qa|ops|data|ml|marketing|sales) team)\s+"
        r"(?:(?:still|also|really|all|definitely|urgently|just)\s+)?"
        r"(?:need(?:s)? to|have to|has to|'ve got to|got to|gotta|must|should|ought to|will have to|are going to have to|"
        r"will|'ll|are going to|'re going to|are gonna|'re gonna|are to|will need to|need(?:s)? someone to|are supposed to)\s+"
        + _SOFT + r"(?P<rest>.+)$", re.IGNORECASE), 0.62),
    ("collective", re.compile(
        _LEAD + r"(?:let'?s|let us)\s+" + _SOFT + r"(?P<rest>.+)$", re.IGNORECASE), 0.55),
    ("collective", re.compile(
        _LEAD + r"(?:we|i|the team)\s+(?:still\s+|also\s+|urgently\s+)?(?P<obtain>need(?:s)?|require(?:s)?|will need|'ll need)\s+"
        r"(?P<rest>(?:a |an |the |some |more |another )?(?!to\b|someone|somebody|you\b)\w+(?: \w+){0,3}\s+(?:from|for|before|by|on|of)\b.+)$",
        re.IGNORECASE), 0.6),
    ("collective", re.compile(
        _LEAD + r"(?:(?:the )?next step(?:s)? (?:is|are|would be) to|(?:what|all) we need (?:to do )?(?:now )?is|"
        r"(?:the )?(?:first|next|only|last) thing (?:to do|we need to do|we should do|is to do) is(?: to)?|"
        r"(?:something|one thing|a thing) (?:we|i) (?:need|have|should) (?:to )?(?:do|look at|check) is(?: to)?|"
        r"(?:it|this|that) (?:needs|has) to be|(?:the \w+(?: \w+)?) (?:needs|has) to be|(?:it|this|that) (?:should|must) be|"
        r"(?:the \w+(?: \w+)?) (?:should|must) be)\s+(?P<rest>.+)$", re.IGNORECASE), 0.6),
]

# In-meeting navigation ("let's move on", "we'll come back to that") — never a decision or task.
_MEETING_FLOW_RE = re.compile(
    r"^(?:move on|move to the next|go to the next|go ahead and (?:start|begin|continue)|go through|go back|go over|"
    r"proceed(?: with)? the (?:next|agenda)|continue with the (?:next|agenda)|start with|come back to|"
    r"circle back to (?:that|this|it) later|wrap (?:up|it up)|call it a day|stop here|take a break|"
    r"table (?:this|that|it)|park (?:this|that|it)|leave it there|get started|get going|kick off the|"
    r"jump (?:in|to|into)|dive (?:in|into)|look at the next|skip (?:this|that|ahead)|do (?:a )?quick (?:recap|round)|"
    r"recap|summarize|summarise|go around the room|take (?:that|this|it) offline|discuss (?:that|this|it) offline|"
    r"keep (?:it|this) (?:short|brief|quick)|say|see|hear|assume|imagine|hope|wait|hold on|pause here)\b",
    re.IGNORECASE,
)

# Prefixes stripped from a decision remainder so it reads as a statement.
_DECISION_STRIP = re.compile(
    r"^(?:that\s+|to\s+|on\s+|upon\s+|with\s+|for\s+|be\s+)?(?:we(?:'ll| will|'re going to| are going to|'d| would| should| can)?\s+)?"
    r"(?:just\s+|all\s+|simply\s+|officially\s+|now\s+|definitely\s+|then\s+)?",
    re.IGNORECASE,
)


# ═════════════════════════════════════════════════════════════════════════════
# Sentence analysis
# ═════════════════════════════════════════════════════════════════════════════

def _addressee_name(text: str, known: Sequence[str]) -> Optional[str]:
    """Return a vocative name ("Karan, can you…" / "…, Karan?") if present."""
    m = re.match(r"^\s*(" + _PERSON_TOKEN + r")[,:]\s", text)
    if m and _looks_like_name(m.group(1), known):
        return m.group(1)
    m = re.search(r",\s*(" + _PERSON_TOKEN + r")[?.!]?\s*$", text)
    if m and _looks_like_name(m.group(1), known):
        return m.group(1)
    return None


def analyse_sentence(raw: str, known_names: Sequence[str] = ()) -> SentenceAnalysis:
    """
    Analyse a single sentence without conversational context.

    Returns the most likely intent, a normalised description and a confidence.
    Context-dependent adjustments (agreement resolution, addressee lookup, vague
    object resolution) happen in ``extract``.
    """
    text = clean_text(raw)
    if not text:
        return SentenceAnalysis("general", 0.0, "")

    is_question = bool(_QUESTION_RE.search(text))
    is_conditional = bool(_CONDITIONAL_RE.search(text))
    is_hedged = bool(_HEDGE_RE.search(text))
    is_done = bool(_DONE_RE.search(text))
    words = _tokens(text)

    # Agreement / disagreement markers are context signals -------------------
    if _AGREEMENT_RE.match(text) and len(words) <= 8:
        return SentenceAnalysis("agreement", 0.6, text)
    if _DISAGREEMENT_RE.match(text) and len(words) <= 10:
        return SentenceAnalysis("disagreement", 0.6, text)

    if len(words) < 2:
        return SentenceAnalysis("general", 0.0, text, is_question=is_question)

    proposal = bool(_PROPOSAL_RE.match(text))

    for intent, pattern, base in _TRIGGERS:
        m = pattern.match(text)
        if not m:
            continue

        rest = (m.groupdict().get("rest") or "").strip()
        if intent == "commitment" and rest[:1] in (",", ";", "-", "–"):
            tail = rest.lstrip(" ,;-–")
            if re.match(r"^(?:i|we|let me)\b", tail, re.IGNORECASE):
                inner = analyse_sentence(tail, known_names)
                if inner.intent in ("commitment", "collective") and inner.description:
                    return inner
            rest = tail
        owner = m.groupdict().get("owner") or m.groupdict().get("owner2")
        voc = m.groupdict().get("voc")
        verb = m.groupdict().get("verb")

        # Negation *before* the trigger cancels it ("we haven't decided", "I won't send").
        prefix = text[: m.start("rest")] if "rest" in m.groupdict() and m.group("rest") is not None else text
        neg_before = bool(_NEG_BEFORE_RE.search(prefix))

        if intent == "open_item":
            # "we haven't decided X" → open item too (negation is part of the trigger)
            subject = _strip_terminal(rest)
            subject = re.sub(r"^(?:on|about|upon|whether|if|what|which|how|where|when)\s+", "", subject, flags=re.IGNORECASE)
            subject = re.sub(r"^(?:yet|still|also)\s+", "", subject, flags=re.IGNORECASE)
            v = (verb or "decide").lower()
            if v not in _OPEN_ITEM_VERBS:
                for cand in (v[:-2] if v.endswith("ed") else "", v[:-1] if v.endswith("d") else "",
                             {"chosen": "choose", "agreed": "agree"}.get(v, "")):
                    if cand in _OPEN_ITEM_VERBS:
                        v = cand
                        break
            head = _OPEN_ITEM_VERBS.get(v, _capitalize(v))
            if head == "Decide on" and re.match(r"^(?:whether|if|what|which|how|where|when|who)\b", subject, re.IGNORECASE):
                head = "Decide"
            desc = f"{head} {subject}" if subject else ""
            if not subject or len(_tokens(subject)) < 1:
                return SentenceAnalysis("general", 0.2, text)
            conf = base
            if is_question:
                conf -= 0.35
            if is_conditional:
                conf -= 0.4
            due = _find_due(text)
            return SentenceAnalysis("open_item", max(0.0, min(1.0, conf)), _strip_terminal(desc), owner=None, due=due,
                                    is_question=is_question, is_conditional=is_conditional, is_hedged=is_hedged)

        if intent == "decision" and m.groupdict().get("verdict"):
            subj = (m.group("subj") or "").strip()
            if is_question or neg_before or not subj or subj.lower().split()[0] in ("it", "that", "this", "what", "which"):
                continue
            desc = _capitalize(f"{subj} {'is' if not subj.lower().endswith('s') else 'are'} {m.group('verdict').lower()}")
            tail = _strip_terminal(rest or "")
            body, rationale = _split_rationale(desc + (f" {tail}" if tail else ""))
            return SentenceAnalysis("decision", base, _capitalize(body), rationale=rationale, is_question=is_question,
                                    is_conditional=is_conditional, is_hedged=is_hedged)

        if intent == "decision":
            if neg_before or is_question or not rest:
                # "did we decide?", "we haven't decided" — not a decision
                continue
            # "decision making process", "decisions like this are hard" — noun mentions
            if re.match(r"^(?:making|makers?|process|tree|point|matrix|log|record)\b", rest, re.IGNORECASE):
                continue
            body = _DECISION_STRIP.sub("", rest).strip()
            body = _strip_terminal(body)
            if len(_tokens(body)) < 2:
                continue
            if _MEETING_FLOW_RE.match(body):
                return SentenceAnalysis("general", 0.2, text)
            # Negative decisions: "let's not do X" → "Do not do X"
            if re.match(r"^not\s+\w+ing\b", body, re.IGNORECASE):
                body = "Not " + body[4:]                      # "Not going ahead with X"
            else:
                body = re.sub(r"^not\s+", "Do not ", body, flags=re.IGNORECASE)   # "Do not do X"
            body, rationale = _split_rationale(body)
            prep = (m.groupdict().get("prep") or "").lower()
            if prep in ("on", "upon", "with") and not _first_verb_ok(body) and not re.match(
                r"^(?:go|use|not|do|keep|drop|stick|switch|move|postpon|cancel|hir|launch|ship)", body, re.IGNORECASE
            ):
                body = "Go with " + body[0].lower() + body[1:] if body[:1].isupper() and not body.split()[0].isupper() else "Go with " + body
            conf = base
            if is_conditional:
                conf -= 0.6
            if is_hedged or proposal:
                conf -= 0.35
            if re.search(r"\b(?:i think|i guess|probably|maybe|perhaps)\b", prefix, re.IGNORECASE):
                conf -= 0.2
            # "let's go with X?" style questions were removed above; "we could go with X" is a proposal
            if re.match(r"^(?:we could|we might|we can|we should|should we|shall we)\b", text, re.IGNORECASE):
                conf -= 0.3
            # "The team decided" vs a third party: slight discount when it's not "we"
            if re.match(r"^(?:they|the client|the customer|management|the panel)\b", text, re.IGNORECASE):
                conf -= 0.2
            due = _find_due(text)
            return SentenceAnalysis("decision", max(0.0, min(1.0, conf)), _capitalize(body), rationale=rationale, due=due,
                                    is_question=is_question, is_conditional=is_conditional, is_hedged=is_hedged)

        # ── action-like intents ──────────────────────────────────────────────
        if intent in ("request", "assignment", "commitment", "collective"):
            if neg_before:
                continue
            body = _strip_terminal(rest)
            if not body:
                # "I'll take that", "that's on me" → vague, resolve from context
                body = ""
            # Requests that are plain information questions ("can you tell me more?")
            if intent == "request" and re.match(
                r"^(?:tell me|explain|elaborate|clarify|hear|see|remind me what|walk me through|describe|repeat|"
                r"hear me|see (?:my|the) screen|imagine|believe|think|guess|confirm (?:if|whether|that)\b.*\?$)",
                body, re.IGNORECASE,
            ):
                return SentenceAnalysis("question", 0.5, text, is_question=True)
            if intent == "commitment" and _NON_WORK_PHRASES.match(body):
                return SentenceAnalysis("general", 0.2, text)
            if intent in ("collective", "commitment", "assignment") and re.match(
                r"^(?:be careful|be mindful|be aware|keep in mind|remember that|note that|see|wait|hope|think|"
                r"say|assume|expect|know|understand|realise|realize|bear in mind|move on|get started|start with|"
                r"begin|continue|go on|proceed|take a (?:break|step back|look at the next)|come back to|"
                r"talk about|discuss this|discuss that|discuss it|look at the next|jump to|skip)\b",
                body, re.IGNORECASE,
            ):
                return SentenceAnalysis("general", 0.25, text)

            if m.groupdict().get("obtain") and body:
                body = "Obtain " + body[0].lower() + body[1:]
            vague = not body or bool(_VAGUE_OBJECT_RE.match(body))
            body_for_desc = "" if vague else body
            due = _find_due(text)
            if due and body_for_desc:
                # keep the deadline inside the description too — it reads naturally
                pass
            body_for_desc, _ = _split_rationale(body_for_desc) if body_for_desc else ("", None)

            if owner and not _looks_like_name(owner.split()[0], known_names):
                owner = None
            if not owner and voc and _looks_like_name(voc, known_names):
                owner = voc

            conf = base
            if intent == "collective" and not _first_verb_ok(body) and not vague:
                conf -= 0.25
            if intent in ("commitment", "assignment", "request") and not vague and not _first_verb_ok(body):
                conf -= 0.12
            if is_question and intent != "request":
                conf -= 0.4
            if is_conditional:
                conf -= 0.5
            if is_hedged:
                conf -= 0.2
            if is_done:
                conf -= 0.45
            if proposal and intent == "collective":
                conf -= 0.1
            if due:
                conf += 0.08
            if owner:
                conf += 0.05
            if vague:
                conf -= 0.1   # resolved later from context, otherwise dropped

            desc = _capitalize(body_for_desc) if body_for_desc else ""
            return SentenceAnalysis(intent, max(0.0, min(1.0, conf)), desc, owner=owner, due=due,
                                    is_question=is_question, is_conditional=is_conditional, is_hedged=is_hedged)

    if proposal:
        # "How about we use Redis?" — a proposal; becomes a decision only when accepted.
        body = _PROPOSAL_RE.sub("", text, count=1).strip()
        body = re.sub(r"^(?:we|you|i)\s+(?:should|could|can|just|maybe)?\s*", "", body, flags=re.IGNORECASE)
        return SentenceAnalysis("proposal", 0.5, _capitalize(_strip_terminal(body)) or text, is_question=is_question,
                                is_hedged=True)

    if is_question or _WH_QUESTION_RE.match(text):
        return SentenceAnalysis("question", 0.5, text, is_question=True)

    if is_done:
        return SentenceAnalysis("done", 0.5, text)

    return SentenceAnalysis("general", 0.0, text, is_question=is_question, is_conditional=is_conditional,
                            is_hedged=is_hedged)


# ═════════════════════════════════════════════════════════════════════════════
# Speaker name inference
# ═════════════════════════════════════════════════════════════════════════════

def infer_speaker_names(utterances: Sequence[Utterance]) -> Dict[str, str]:
    """
    Map diarization labels (SPEAKER_00 …) to real names from self-introductions:
    "Hi, this is Karan", "I'm Priya from design", "Dev here".
    """
    names: Dict[str, str] = {}
    for u in utterances:
        if not _SPEAKER_LABEL_RE.match(u.speaker) or u.speaker in names:
            continue
        for sent in split_sentences(u.text)[:3]:
            m = _SELF_INTRO_RE.search(sent)
            if not m:
                continue
            cand = m.group(1) or m.group(2)
            if cand and _looks_like_name(cand):
                names[u.speaker] = cand
                break
    return names


def _display_name(label: str, names: Dict[str, str]) -> str:
    return names.get(label, label)


# ═════════════════════════════════════════════════════════════════════════════
# Main extraction
# ═════════════════════════════════════════════════════════════════════════════

@dataclass
class _Sent:
    utt: Utterance
    raw: str
    analysis: SentenceAnalysis


def _resolve_pronouns(desc: str, speaker: Optional[str], addressee: Optional[str]) -> str:
    """Replace "me/my" with the speaker's name, "you/your" with the addressee's, when known."""
    if speaker and not _SPEAKER_LABEL_RE.match(speaker):
        desc = re.sub(r"\bme\b", speaker, desc)
        desc = re.sub(r"\bmy\b", f"{speaker}'s", desc, flags=re.IGNORECASE)
        desc = re.sub(r"\bmyself\b", speaker, desc)
    if addressee and not _SPEAKER_LABEL_RE.match(addressee):
        desc = re.sub(r"\byour\b", f"{addressee}'s", desc, flags=re.IGNORECASE)
    return desc


def _dedupe_actions(items: List[ActionItem]) -> List[ActionItem]:
    kept: List[ActionItem] = []
    for item in sorted(items, key=lambda x: -x.confidence):
        toks = _tokens(item.description)
        dup = False
        for k in kept:
            if _jaccard(toks, _tokens(k.description)) >= 0.6 and (k.owner == item.owner or not item.owner or not k.owner):
                if not k.owner and item.owner:
                    k.owner = item.owner
                if not k.due and item.due:
                    k.due = item.due
                dup = True
                break
        if not dup:
            kept.append(item)
    return sorted(kept, key=lambda x: x.segment_index)


def _dedupe_decisions(items: List[Decision]) -> List[Decision]:
    kept: List[Decision] = []
    for item in sorted(items, key=lambda x: -x.confidence):
        toks = _tokens(item.description)
        if any(_jaccard(toks, _tokens(k.description)) >= 0.6 for k in kept):
            continue
        kept.append(item)
    return sorted(kept, key=lambda x: x.segment_index)


def extract(
    utterances: Sequence[Utterance],
    speaker_names: Optional[Dict[str, str]] = None,
    min_confidence: float = 0.45,
) -> ExtractionResult:
    """
    Extract action items and decisions from an ordered list of utterances.

    Args:
        utterances:     Transcript segments in order.
        speaker_names:  Optional {label: real name} mapping (user-set names).
                        Self-introductions in the transcript are also used.
        min_confidence: Items below this confidence are discarded.
    """
    if not utterances:
        return ExtractionResult()

    names: Dict[str, str] = dict(speaker_names or {})
    for label, name in infer_speaker_names(utterances).items():
        names.setdefault(label, name)
    known_names = tuple(sorted({n for n in names.values() if n}))

    # Flatten into sentences with per-sentence analysis
    sents: List[_Sent] = []
    for u in utterances:
        for raw in split_sentences(u.text):
            sents.append(_Sent(u, raw, analyse_sentence(raw, known_names)))

    speakers_in_meeting = {u.speaker for u in utterances}
    actions: List[ActionItem] = []
    decisions: List[Decision] = []

    def other_speaker(label: str) -> Optional[str]:
        others = [s for s in speakers_in_meeting if s != label]
        return others[0] if len(others) == 1 else None

    def prev_actionable(i: int, window: int = 3) -> Optional[Tuple[_Sent, SentenceAnalysis]]:
        """Nearest earlier sentence that carries a concrete task/proposal."""
        for j in range(i - 1, max(-1, i - 1 - window), -1):
            a = sents[j].analysis
            if a.intent in ("request", "collective", "proposal", "assignment", "open_item", "commitment") and a.description:
                return sents[j], a
            if a.intent == "decision" and a.description and a.confidence < min_confidence:
                return sents[j], a
        return None

    for i, s in enumerate(sents):
        a = s.analysis
        speaker = _display_name(s.utt.speaker, names)
        evidence = s.raw.strip()

        # ── Agreement → turns the previous proposal into a decision (or accepted request into a task)
        if a.intent == "agreement":
            prev = prev_actionable(i, window=2)
            if not prev:
                continue
            ps, pa = prev
            if ps.utt.speaker == s.utt.speaker and len(speakers_in_meeting) > 1:
                continue  # agreeing with yourself isn't a decision
            if pa.intent in ("proposal", "collective", "decision") and pa.description:
                body, rationale = _split_rationale(pa.description)
                decisions.append(Decision(
                    description=_capitalize(body), rationale=rationale, confidence=0.75,
                    evidence=f"{ps.raw.strip()} — {evidence}", segment_index=ps.utt.index, speaker=speaker,
                ))
            elif pa.intent == "request" and pa.description:
                # "Can you check the logs?" / "Sure." → task for the responder
                actions.append(ActionItem(
                    description=_capitalize(_resolve_pronouns(pa.description, _display_name(ps.utt.speaker, names), speaker)),
                    owner=pa.owner or speaker, due=pa.due, confidence=min(1.0, pa.confidence + 0.1),
                    evidence=f"{ps.raw.strip()} — {evidence}", segment_index=ps.utt.index, speaker=speaker,
                ))
            continue

        if a.intent == "decision":
            if a.confidence >= min_confidence:
                decisions.append(Decision(
                    description=a.description, rationale=a.rationale, confidence=a.confidence,
                    evidence=evidence, segment_index=s.utt.index, speaker=speaker,
                ))
                inner = analyse_sentence(a.description, known_names)
                if inner.intent == "assignment" and inner.owner and inner.description:
                    actions.append(ActionItem(
                        description=_capitalize(inner.description), owner=inner.owner, due=inner.due or a.due,
                        confidence=round(min(1.0, a.confidence), 2), evidence=evidence,
                        segment_index=s.utt.index, speaker=speaker,
                    ))
            continue

        if a.intent == "open_item":
            if a.confidence >= min_confidence and a.description:
                actions.append(ActionItem(
                    description=a.description, owner=None, due=a.due, confidence=a.confidence,
                    evidence=evidence, segment_index=s.utt.index, speaker=speaker, kind="open_item",
                ))
            continue

        if a.intent in ("commitment", "assignment", "request", "collective"):
            desc = a.description
            owner = a.owner
            conf = a.confidence

            # Resolve vague objects ("I'll do it") from the preceding request/proposal
            if not desc:
                prev = prev_actionable(i)
                if prev and prev[1].description:
                    desc = prev[1].description
                    conf = min(1.0, max(conf, prev[1].confidence) + 0.05)
                    if not a.due and prev[1].due:
                        a.due = prev[1].due
                    if a.intent == "commitment":
                        evidence = f"{prev[0].raw.strip()} — {evidence}"
                else:
                    continue  # nothing to resolve → drop

            if a.intent == "commitment":
                owner = speaker
                desc = _resolve_pronouns(desc, speaker, None)
            elif a.intent == "request":
                addressee = owner or _addressee_name(s.raw, known_names)
                if not addressee:
                    # If the next sentence is an acceptance by another speaker, they own it.
                    nxt = sents[i + 1] if i + 1 < len(sents) else None
                    if nxt and nxt.analysis.intent == "agreement" and nxt.utt.speaker != s.utt.speaker:
                        addressee = _display_name(nxt.utt.speaker, names)
                    elif nxt and nxt.analysis.intent == "commitment" and nxt.utt.speaker != s.utt.speaker:
                        addressee = None  # the commitment itself will be captured with a proper owner
                        continue
                    else:
                        addressee = other_speaker(s.utt.speaker)
                        addressee = _display_name(addressee, names) if addressee else None
                owner = addressee
                desc = _resolve_pronouns(desc, speaker, owner)
            elif a.intent == "assignment":
                desc = _resolve_pronouns(desc, speaker, owner)
            else:  # collective
                owner = None
                desc = _resolve_pronouns(desc, speaker, None)

            # Drop trailing vocatives / politeness
            desc = re.sub(r"[,\s]+(?:please|thanks|thank you|okay|ok|right)\s*$", "", desc, flags=re.IGNORECASE)
            desc = _capitalize(_strip_terminal(desc))
            if len(_tokens(desc)) < 2:
                continue
            if conf < min_confidence:
                continue
            actions.append(ActionItem(
                description=desc, owner=owner, due=a.due, confidence=round(conf, 2),
                evidence=evidence, segment_index=s.utt.index, speaker=speaker,
            ))

    return ExtractionResult(
        action_items=_dedupe_actions(actions),
        decisions=_dedupe_decisions(decisions),
    )
