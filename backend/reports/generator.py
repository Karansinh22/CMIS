"""
reports/generator.py — Phase 6: generate documents from the context store.

Every report is a *view* of data that already exists (transcript, summary,
topics, decisions, action items) — nothing is re-transcribed or re-analysed.

Formats
-------
    docx  Minutes of Meeting: cover block, at-a-glance metrics, agenda with
          timeline, executive summary, discussion by topic, decisions with
          rationale, action-item register with charts, open questions,
          participation, sign-off, transcript appendix.
    pptx  Slide deck: title, agenda, at-a-glance tiles, summary, timeline,
          participation chart, one slide per topic, decisions, action-item
          chart + register, open questions, next steps, closing.
    md    Markdown minutes with the same sections (tables instead of charts).

Project-level reports aggregate every completed meeting in a project.
"""

from __future__ import annotations

import logging
import re
from collections import defaultdict
from dataclasses import dataclass, field
from datetime import datetime
from pathlib import Path
from typing import Dict, List, Optional, Tuple

from sqlalchemy.orm import Session

from db.models import ActionItem, ContextEntry, Decision, Meeting, Project, Topic, TranscriptSegment
from reports import charts

logger = logging.getLogger(__name__)

FORMATS = ("docx", "pptx", "md")
PREPARED_BY = "CMIS — Contextual Meeting Intelligence System"

# Action items that are really "things still to be settled" (from nlp.intent open items)
_OPEN_ITEM_RE = re.compile(
    r"^(?:decide|agree|align|settle|finali[sz]e|figure out|work out|sort out|nail down|pin down|lock down|"
    r"discuss|resolve|confirm|pick|choose|clarify)\b",
    re.IGNORECASE,
)


# ── Data gathering ────────────────────────────────────────────────────────────

@dataclass
class TopicSpan:
    topic: Topic
    start: float
    end: float
    decisions: List[Decision] = field(default_factory=list)
    actions: List[ActionItem] = field(default_factory=list)


@dataclass
class MeetingData:
    meeting: Meeting
    summary: str
    summary_type: str
    topics: List[Topic]
    decisions: List[Decision]
    action_items: List[ActionItem]
    speakers: List[str]
    duration_seconds: float
    transcript: List[TranscriptSegment]
    talk_time: Dict[str, float]
    spans: List[TopicSpan]
    generated_at: datetime

    # Derived views -----------------------------------------------------------
    @property
    def open_actions(self) -> List[ActionItem]:
        return [a for a in self.action_items if not a.resolved]

    @property
    def done_actions(self) -> List[ActionItem]:
        return [a for a in self.action_items if a.resolved]

    @property
    def open_questions(self) -> List[ActionItem]:
        return [a for a in self.action_items if not a.owner and _OPEN_ITEM_RE.match(a.description or "")]

    @property
    def tasks(self) -> List[ActionItem]:
        oq = {id(a) for a in self.open_questions}
        return [a for a in self.action_items if id(a) not in oq]

    def seg_time(self, index: Optional[int]) -> Optional[float]:
        if index is None or index < 0 or index >= len(self.transcript):
            return None
        return self.transcript[index].start_time

    def seg_speaker(self, index: Optional[int]) -> Optional[str]:
        if index is None or index < 0 or index >= len(self.transcript):
            return None
        s = self.transcript[index].speaker
        return (s.name or s.label) if s else None


def _speaker_name(seg: TranscriptSegment) -> str:
    return (seg.speaker.name or seg.speaker.label) if seg.speaker else "Speaker"


def collect_meeting(db: Session, meeting: Meeting) -> MeetingData:
    entry: Optional[ContextEntry] = meeting.context_entry
    segments = sorted(meeting.segments, key=lambda s: s.segment_index)
    duration = (max((s.end_time for s in segments), default=0.0) - min((s.start_time for s in segments), default=0.0))
    duration = max(0.0, duration)

    talk: Dict[str, float] = defaultdict(float)
    for s in segments:
        talk[_speaker_name(s)] += max(0.0, s.end_time - s.start_time)
    speakers = sorted(talk.keys(), key=lambda k: -talk[k])

    topics = list(entry.topics) if entry else []
    decisions = list(entry.decisions) if entry else []
    actions = list(entry.action_items) if entry else []

    # Topic spans: stored times, else an even split of the recording
    spans: List[TopicSpan] = []
    if topics:
        if all(t.start_time is not None and t.end_time is not None for t in topics):
            spans = [TopicSpan(t, float(t.start_time), float(t.end_time)) for t in topics]
        else:
            width = duration / len(topics) if duration else 0.0
            spans = [TopicSpan(t, i * width, (i + 1) * width) for i, t in enumerate(topics)]

    data = MeetingData(
        meeting=meeting,
        summary=(entry.summary if entry and entry.summary else ""),
        summary_type=(entry.summary_type if entry and entry.summary_type else meeting.summary_type or "balanced"),
        topics=topics, decisions=decisions, action_items=actions,
        speakers=speakers, duration_seconds=duration, transcript=segments,
        talk_time=dict(talk), spans=spans, generated_at=datetime.utcnow(),
    )

    # Attach decisions / actions to the topic they were raised in
    def span_for(index: Optional[int]) -> Optional[TopicSpan]:
        t = data.seg_time(index)
        if t is None or not spans:
            return None
        for sp in spans:
            if sp.start <= t <= sp.end:
                return sp
        return min(spans, key=lambda sp: abs(sp.start - t))

    for d in decisions:
        sp = span_for(d.segment_index)
        if sp:
            sp.decisions.append(d)
    for a in actions:
        sp = span_for(a.segment_index)
        if sp:
            sp.actions.append(a)
    return data


# ── Helpers ───────────────────────────────────────────────────────────────────

def _fmt_date(dt: Optional[datetime]) -> str:
    return dt.strftime("%d %B %Y") if dt else "—"


def _fmt_datetime(dt: Optional[datetime]) -> str:
    return dt.strftime("%d %b %Y, %H:%M") if dt else "—"


def _fmt_duration(seconds: float) -> str:
    seconds = int(seconds)
    if seconds < 60:
        return f"{seconds} s"
    m, s = divmod(seconds, 60)
    h, m = divmod(m, 60)
    return f"{h} h {m:02d} min" if h else f"{m} min {s:02d} s"


def _fmt_time(seconds: Optional[float]) -> str:
    if seconds is None:
        return "—"
    m, s = divmod(int(seconds), 60)
    return f"{m:02d}:{s:02d}"


def _strip_md(text: str) -> str:
    text = re.sub(r"\*\*([^*]+)\*\*", r"\1", text)
    text = re.sub(r"\*([^*]+)\*", r"\1", text)
    text = re.sub(r"`([^`]+)`", r"\1", text)
    return text


def _summary_blocks(summary: str) -> List[Tuple[str, str]]:
    """Yield (kind, text) tuples: heading | bullet | quote | para."""
    blocks: List[Tuple[str, str]] = []
    for raw in (summary or "").splitlines():
        line = raw.rstrip()
        if not line.strip() or line.strip() == "---":
            continue
        if line.startswith("#"):
            blocks.append(("heading", _strip_md(line.lstrip("# ").strip())))
        elif re.match(r"^\s*[•\-]\s+", line):
            blocks.append(("bullet", _strip_md(re.sub(r"^\s*[•\-]\s+", "", line))))
        elif re.match(r"^\s*\d+\.\s+", line):
            blocks.append(("bullet", _strip_md(re.sub(r"^\s*\d+\.\s+", "", line))))
        elif line.startswith(">"):
            blocks.append(("quote", _strip_md(line.lstrip("> ").strip())))
        elif line.startswith("|"):
            continue
        else:
            blocks.append(("para", _strip_md(line.strip())))
    # The summary's own title ("## Meeting Overview") duplicates the section heading
    if blocks and blocks[0][0] == "heading":
        blocks = blocks[1:]
    return blocks


def _summary_points(data: MeetingData, limit: int = 6) -> List[str]:
    """Short bullet points for slides: prefer bullets/paras from the summary."""
    pts = [t for k, t in _summary_blocks(data.summary) if k in ("para", "bullet") and len(t) > 20]
    if not pts:
        pts = [d.description for d in data.decisions] + [a.description for a in data.tasks]
    return pts[:limit]


def _safe_name(title: str) -> str:
    name = re.sub(r"[^A-Za-z0-9._ -]+", "", title).strip().replace(" ", "_")
    return name[:60] or "meeting"


def _source_label(m: Meeting) -> str:
    return "Live recording (microphone)" if m.source == "live" else "Uploaded recording"


def _next_agenda(data: MeetingData) -> List[str]:
    """Proposed agenda for the next meeting: open questions, then overdue-looking tasks."""
    items = [f"Settle: {a.description}" for a in data.open_questions]
    items += [f"Status of: {a.description}" + (f" ({a.owner})" if a.owner else "")
              for a in data.open_actions if a not in data.open_questions][:6]
    items += [f"Review decision: {d.description}" for d in data.decisions[:2]]
    return items[:8] or ["Review progress on the items above."]


# ═════════════════════════════════════════════════════════════════════════════
# Markdown
# ═════════════════════════════════════════════════════════════════════════════

def render_markdown(data: MeetingData, include_transcript: bool = False) -> str:
    m = data.meeting
    out: List[str] = []
    out += [f"# Minutes of Meeting — {m.title}", ""]
    out += [
        f"| | |", f"|---|---|",
        f"| **Date** | {_fmt_datetime(m.date)} |",
        f"| **Duration** | {_fmt_duration(data.duration_seconds)} |",
        f"| **Participants** | {', '.join(data.speakers) if data.speakers else '—'} |",
        f"| **Source** | {_source_label(m)} |",
        f"| **Prepared by** | {PREPARED_BY}, {_fmt_datetime(data.generated_at)} UTC |",
        "",
    ]

    out += ["## Meeting at a glance", "",
            f"| Topics | Decisions | Action items | Open | Completed | Open questions | Participants |",
            f"|---|---|---|---|---|---|---|",
            f"| {len(data.topics)} | {len(data.decisions)} | {len(data.tasks)} | {len([a for a in data.tasks if not a.resolved])} | "
            f"{len(data.done_actions)} | {len(data.open_questions)} | {len(data.speakers)} |", ""]

    if data.spans:
        out += ["## Agenda / topics covered", ""]
        for i, sp in enumerate(data.spans, 1):
            flag = " *(recurring)*" if sp.topic.is_recurring else ""
            out.append(f"{i}. **{sp.topic.title}**{flag} — {_fmt_time(sp.start)}–{_fmt_time(sp.end)}")
        out.append("")

    if data.summary:
        out += ["## Executive summary", "", data.summary.strip(), ""]

    if data.spans:
        out += ["## Discussion by topic", ""]
        for i, sp in enumerate(data.spans, 1):
            out.append(f"### {i}. {sp.topic.title}  \n*{_fmt_time(sp.start)}–{_fmt_time(sp.end)}*")
            out.append("")
            if sp.topic.summary:
                out += [sp.topic.summary, ""]
            for d in sp.decisions:
                out.append(f"- **Decision:** {d.description}" + (f" — {d.rationale}" if d.rationale else ""))
            for a in sp.actions:
                out.append(f"- **Action:** {a.description}" + (f" — {a.owner}" if a.owner else "") + (f", {a.due}" if a.due else ""))
            out.append("")

    out += ["## Decisions", ""]
    if data.decisions:
        out += ["| # | Decision | Rationale | Raised at | By |", "|---|---|---|---|---|"]
        for i, d in enumerate(data.decisions, 1):
            out.append(f"| {i} | {d.description} | {d.rationale or '—'} | {_fmt_time(data.seg_time(d.segment_index))} | {data.seg_speaker(d.segment_index) or '—'} |")
    else:
        out.append("_No decisions were recorded._")
    out.append("")

    out += ["## Action items", ""]
    if data.tasks:
        out += ["| # | Task | Owner | Due | Priority | Status |", "|---|---|---|---|---|---|"]
        for i, a in enumerate(data.tasks, 1):
            out.append(f"| {i} | {a.description} | {a.owner or 'Unassigned'} | {a.due or '—'} | "
                       f"{(a.urgency or 'low').title()} | {'Done' if a.resolved else 'Open'} |")
    else:
        out.append("_No action items were recorded._")
    out.append("")

    out += ["## Open questions & follow-ups", ""]
    if data.open_questions:
        out += [f"- {a.description}" for a in data.open_questions]
    else:
        out.append("_Nothing left open._")
    out += ["", "**Proposed agenda for the next meeting**", ""] + [f"- {x}" for x in _next_agenda(data)] + [""]

    if data.talk_time:
        total = sum(data.talk_time.values()) or 1.0
        out += ["## Participation", "", "| Participant | Speaking time | Share |", "|---|---|---|"]
        for spk in data.speakers:
            out.append(f"| {spk} | {_fmt_time(data.talk_time[spk])} | {data.talk_time[spk] / total:.0%} |")
        out.append("")

    if include_transcript and data.transcript:
        out += ["## Appendix — Transcript", ""]
        for s in data.transcript:
            out.append(f"- `{_fmt_time(s.start_time)}` **{_speaker_name(s)}:** {s.text}")
        out.append("")

    out.append(f"_Generated by {PREPARED_BY} on {_fmt_datetime(data.generated_at)} UTC. "
               f"Automatically extracted items should be verified by the meeting owner._")
    return "\n".join(out)


# ═════════════════════════════════════════════════════════════════════════════
# Word (docx)
# ═════════════════════════════════════════════════════════════════════════════

_NAVY = (0x1F, 0x3A, 0x5F)
_GREY = (0x55, 0x55, 0x55)


def _docx_page_number(paragraph) -> None:
    from docx.oxml import OxmlElement
    from docx.oxml.ns import qn

    run = paragraph.add_run()
    fld = OxmlElement("w:fldSimple")
    fld.set(qn("w:instr"), "PAGE")
    r = OxmlElement("w:r")
    t = OxmlElement("w:t")
    t.text = "1"
    r.append(t)
    fld.append(r)
    run._r.append(fld)


def _docx_shade(cell, hex_fill: str) -> None:
    from docx.oxml import OxmlElement
    from docx.oxml.ns import qn

    tc_pr = cell._tc.get_or_add_tcPr()
    shd = OxmlElement("w:shd")
    shd.set(qn("w:val"), "clear")
    shd.set(qn("w:color"), "auto")
    shd.set(qn("w:fill"), hex_fill)
    tc_pr.append(shd)


def _docx_table(doc, header: List[str], rows: List[List[str]], widths: Optional[List[float]] = None):
    from docx.shared import Inches, Pt, RGBColor

    table = doc.add_table(rows=1, cols=len(header))
    table.style = "Table Grid"
    for i, h in enumerate(header):
        cell = table.rows[0].cells[i]
        cell.text = ""
        run = cell.paragraphs[0].add_run(h)
        run.bold = True
        run.font.size = Pt(9)
        run.font.color.rgb = RGBColor(0xFF, 0xFF, 0xFF)
        _docx_shade(cell, "1F3A5F")
    for r_idx, row in enumerate(rows):
        cells = table.add_row().cells
        for i, val in enumerate(row):
            cells[i].text = ""
            run = cells[i].paragraphs[0].add_run(str(val))
            run.font.size = Pt(9)
            if r_idx % 2 == 1:
                _docx_shade(cells[i], "F2F5F9")
    if widths:
        for row in table.rows:
            for i, w in enumerate(widths):
                row.cells[i].width = Inches(w)
    return table


def _docx_kv_table(doc, pairs: List[Tuple[str, str]]):
    from docx.shared import Inches, Pt

    table = doc.add_table(rows=0, cols=2)
    table.style = "Table Grid"
    for k, v in pairs:
        cells = table.add_row().cells
        cells[0].text = ""
        r = cells[0].paragraphs[0].add_run(k)
        r.bold = True
        r.font.size = Pt(9)
        _docx_shade(cells[0], "E8EDF3")
        cells[1].text = ""
        cells[1].paragraphs[0].add_run(v).font.size = Pt(9)
        cells[0].width = Inches(1.6)
        cells[1].width = Inches(4.9)
    return table


def _docx_pictures(doc, images: List, width_in: float) -> None:
    """Place up to two chart images side by side."""
    from docx.shared import Inches

    images = [i for i in images if i is not None]
    if not images:
        return
    table = doc.add_table(rows=1, cols=len(images))
    for i, buf in enumerate(images):
        cell = table.rows[0].cells[i]
        cell.paragraphs[0].add_run().add_picture(buf, width=Inches(width_in))


def render_docx(data: MeetingData, path: Path, include_transcript: bool = True) -> Path:
    from docx import Document
    from docx.enum.table import WD_TABLE_ALIGNMENT
    from docx.enum.text import WD_ALIGN_PARAGRAPH
    from docx.shared import Inches, Pt, RGBColor

    m = data.meeting
    doc = Document()
    normal = doc.styles["Normal"]
    normal.font.name = "Calibri"
    normal.font.size = Pt(10.5)
    for level, size in ((1, 15), (2, 12.5), (3, 11)):
        st = doc.styles[f"Heading {level}"]
        st.font.name = "Calibri"
        st.font.size = Pt(size)
        st.font.color.rgb = RGBColor(*_NAVY)

    section = doc.sections[0]
    section.left_margin = section.right_margin = Inches(0.9)
    section.top_margin = section.bottom_margin = Inches(0.8)

    # Header / footer
    hdr = section.header.paragraphs[0]
    hdr.text = f"Minutes of Meeting  ·  {m.title}"
    hdr.alignment = WD_ALIGN_PARAGRAPH.RIGHT
    hdr.runs[0].font.size = Pt(8)
    hdr.runs[0].font.color.rgb = RGBColor(*_GREY)
    ftr = section.footer.paragraphs[0]
    ftr.alignment = WD_ALIGN_PARAGRAPH.CENTER
    fr = ftr.add_run(f"{PREPARED_BY}  ·  Confidential  ·  Page ")
    fr.font.size = Pt(8)
    fr.font.color.rgb = RGBColor(*_GREY)
    _docx_page_number(ftr)

    # Cover block --------------------------------------------------------------
    title = doc.add_paragraph()
    tr = title.add_run("MINUTES OF MEETING")
    tr.bold = True
    tr.font.size = Pt(11)
    tr.font.color.rgb = RGBColor(*_GREY)
    h = doc.add_paragraph()
    hr = h.add_run(m.title)
    hr.bold = True
    hr.font.size = Pt(22)
    hr.font.color.rgb = RGBColor(*_NAVY)

    _docx_kv_table(doc, [
        ("Date & time", _fmt_datetime(m.date)),
        ("Duration", _fmt_duration(data.duration_seconds)),
        ("Participants", ", ".join(data.speakers) if data.speakers else "—"),
        ("Recording", _source_label(m)),
        ("Summary depth", data.summary_type.title()),
        ("Prepared by", f"{PREPARED_BY} on {_fmt_datetime(data.generated_at)} UTC"),
    ])
    doc.add_paragraph()

    # At a glance --------------------------------------------------------------
    doc.add_heading("Meeting at a glance", level=1)
    glance = doc.add_table(rows=2, cols=6)
    glance.style = "Table Grid"
    glance.alignment = WD_TABLE_ALIGNMENT.CENTER
    tiles = [
        ("Topics", len(data.topics)), ("Decisions", len(data.decisions)), ("Action items", len(data.tasks)),
        ("Open", len([a for a in data.tasks if not a.resolved])), ("Open questions", len(data.open_questions)),
        ("Participants", len(data.speakers)),
    ]
    for i, (label, value) in enumerate(tiles):
        top = glance.rows[0].cells[i]
        top.text = ""
        vr = top.paragraphs[0].add_run(str(value))
        vr.bold = True
        vr.font.size = Pt(18)
        vr.font.color.rgb = RGBColor(*_NAVY)
        top.paragraphs[0].alignment = WD_ALIGN_PARAGRAPH.CENTER
        bottom = glance.rows[1].cells[i]
        bottom.text = ""
        lr = bottom.paragraphs[0].add_run(label)
        lr.font.size = Pt(8)
        lr.font.color.rgb = RGBColor(*_GREY)
        bottom.paragraphs[0].alignment = WD_ALIGN_PARAGRAPH.CENTER
        _docx_shade(top, "F2F5F9")
        _docx_shade(bottom, "F2F5F9")
    doc.add_paragraph()

    # Agenda + timeline ---------------------------------------------------------
    doc.add_heading("1. Agenda and timeline", level=1)
    if data.spans:
        for i, sp in enumerate(data.spans, 1):
            p = doc.add_paragraph(style="List Number")
            r = p.add_run(sp.topic.title)
            r.bold = True
            p.add_run(f"  ({_fmt_time(sp.start)}–{_fmt_time(sp.end)})").font.color.rgb = RGBColor(*_GREY)
            if sp.topic.is_recurring:
                p.add_run("  · recurring topic").italic = True
        timeline = charts.timeline_chart([(sp.topic.title, sp.start, sp.end) for sp in data.spans], data.duration_seconds)
        if timeline:
            doc.add_picture(timeline, width=Inches(6.3))
    else:
        doc.add_paragraph("No agenda items could be derived from the recording.")

    # Executive summary ---------------------------------------------------------
    doc.add_heading("2. Executive summary", level=1)
    if data.summary:
        for kind, text in _summary_blocks(data.summary):
            if kind == "heading":
                doc.add_heading(text, level=2)
            elif kind == "bullet":
                doc.add_paragraph(text, style="List Bullet")
            elif kind == "quote":
                p = doc.add_paragraph()
                r = p.add_run(text)
                r.italic = True
                r.font.color.rgb = RGBColor(*_GREY)
            else:
                doc.add_paragraph(text)
    else:
        doc.add_paragraph("No summary available.")

    # Discussion by topic -------------------------------------------------------
    doc.add_heading("3. Discussion by topic", level=1)
    if data.spans:
        for i, sp in enumerate(data.spans, 1):
            doc.add_heading(f"3.{i} {sp.topic.title}", level=2)
            meta = doc.add_paragraph()
            mr = meta.add_run(f"{_fmt_time(sp.start)}–{_fmt_time(sp.end)}"
                              + ("  ·  recurring topic" if sp.topic.is_recurring else ""))
            mr.font.size = Pt(8.5)
            mr.font.color.rgb = RGBColor(*_GREY)
            if sp.topic.summary:
                doc.add_paragraph(sp.topic.summary)
            for d in sp.decisions:
                p = doc.add_paragraph(style="List Bullet")
                p.add_run("Decision: ").bold = True
                p.add_run(d.description)
                if d.rationale:
                    p.add_run(f" — {d.rationale}").italic = True
            for a in sp.actions:
                p = doc.add_paragraph(style="List Bullet")
                p.add_run("Action: ").bold = True
                p.add_run(a.description)
                tail = ", ".join(x for x in [a.owner, a.due] if x)
                if tail:
                    p.add_run(f" ({tail})").font.color.rgb = RGBColor(*_GREY)
            if not sp.topic.summary and not sp.decisions and not sp.actions:
                doc.add_paragraph("General discussion; no decisions or actions recorded.")
    else:
        doc.add_paragraph("No topics extracted.")

    # Decisions ------------------------------------------------------------------
    doc.add_heading("4. Decisions", level=1)
    if data.decisions:
        _docx_table(
            doc, ["#", "Decision", "Rationale", "Raised at", "By"],
            [[str(i), d.description, d.rationale or "—", _fmt_time(data.seg_time(d.segment_index)),
              data.seg_speaker(d.segment_index) or "—"] for i, d in enumerate(data.decisions, 1)],
            widths=[0.3, 3.0, 1.9, 0.7, 0.9],
        )
    else:
        doc.add_paragraph("No decisions were recorded in this meeting.")

    # Action items ---------------------------------------------------------------
    doc.add_heading("5. Action item register", level=1)
    if data.tasks:
        _docx_table(
            doc, ["#", "Task", "Owner", "Due", "Priority", "Status"],
            [[str(i), a.description, a.owner or "Unassigned", a.due or "—", (a.urgency or "low").title(),
              "Done" if a.resolved else "Open"] for i, a in enumerate(data.tasks, 1)],
            widths=[0.3, 3.2, 1.0, 0.9, 0.7, 0.7],
        )
        doc.add_paragraph()
        _docx_pictures(doc, [
            charts.priority_chart([a.urgency for a in data.tasks]),
            charts.owner_chart([a.owner for a in data.tasks]),
        ], width_in=3.05)
    else:
        doc.add_paragraph("No action items were recorded in this meeting.")

    # Open questions ---------------------------------------------------------------
    doc.add_heading("6. Open questions and follow-ups", level=1)
    if data.open_questions:
        for a in data.open_questions:
            doc.add_paragraph(a.description, style="List Bullet")
    else:
        doc.add_paragraph("Nothing was left open.")
    p = doc.add_paragraph()
    p.add_run("Proposed agenda for the next meeting").bold = True
    for item in _next_agenda(data):
        doc.add_paragraph(item, style="List Bullet")

    # Participation -----------------------------------------------------------------
    doc.add_heading("7. Participation", level=1)
    if data.talk_time:
        total = sum(data.talk_time.values()) or 1.0
        lines = defaultdict(int)
        for s in data.transcript:
            lines[_speaker_name(s)] += 1
        _docx_table(
            doc, ["Participant", "Speaking time", "Share", "Contributions"],
            [[spk, _fmt_time(data.talk_time[spk]), f"{data.talk_time[spk] / total:.0%}", str(lines[spk])]
             for spk in data.speakers],
            widths=[2.4, 1.4, 1.0, 1.4],
        )
        doc.add_paragraph()
        _docx_pictures(doc, [charts.speaker_chart(data.talk_time),
                             charts.status_chart(len([a for a in data.tasks if not a.resolved]), len(data.done_actions))],
                       width_in=3.05)
    else:
        doc.add_paragraph("No speaker information available.")

    # Sign-off -----------------------------------------------------------------------
    doc.add_heading("8. Approval", level=1)
    _docx_table(doc, ["Role", "Name", "Date", "Signature"],
                [["Prepared by", PREPARED_BY, _fmt_date(data.generated_at), ""],
                 ["Reviewed by", "", "", ""],
                 ["Approved by", "", "", ""]],
                widths=[1.3, 2.6, 1.2, 1.5])
    note = doc.add_paragraph()
    nr = note.add_run("Decisions and action items were extracted automatically from the recording and should be "
                      "confirmed by the meeting owner before circulation.")
    nr.italic = True
    nr.font.size = Pt(8.5)
    nr.font.color.rgb = RGBColor(*_GREY)

    # Appendix -------------------------------------------------------------------------
    if include_transcript and data.transcript:
        doc.add_page_break()
        doc.add_heading("Appendix A — Transcript", level=1)
        for s in data.transcript:
            p = doc.add_paragraph()
            p.paragraph_format.space_after = Pt(2)
            r = p.add_run(f"[{_fmt_time(s.start_time)}] {_speaker_name(s)}: ")
            r.bold = True
            r.font.size = Pt(9)
            r2 = p.add_run(s.text)
            r2.font.size = Pt(9)

    path.parent.mkdir(parents=True, exist_ok=True)
    doc.save(str(path))
    return path


# ═════════════════════════════════════════════════════════════════════════════
# PowerPoint (pptx)
# ═════════════════════════════════════════════════════════════════════════════

def render_pptx(data: MeetingData, path: Path) -> Path:
    from pptx import Presentation
    from pptx.chart.data import CategoryChartData
    from pptx.dml.color import RGBColor
    from pptx.enum.chart import XL_CHART_TYPE, XL_LEGEND_POSITION
    from pptx.enum.shapes import MSO_SHAPE
    from pptx.enum.text import MSO_ANCHOR, PP_ALIGN
    from pptx.util import Inches, Pt

    NAVY = RGBColor(*_NAVY)
    GREY = RGBColor(*_GREY)
    LIGHT = RGBColor(0xF2, 0xF5, 0xF9)
    WHITE = RGBColor(0xFF, 0xFF, 0xFF)
    ACCENTS = [RGBColor(0x1F, 0x3A, 0x5F), RGBColor(0x3E, 0x6D, 0x9C), RGBColor(0x7F, 0xA7, 0xC9),
               RGBColor(0xB8, 0xCC, 0xE0), RGBColor(0x8F, 0xA3, 0xB8), RGBColor(0xD9, 0xE3, 0xEE)]
    PRIO = {"critical": RGBColor(0x8B, 0x1E, 0x1E), "high": RGBColor(0xC0, 0x39, 0x2B),
            "medium": RGBColor(0xD6, 0x89, 0x10), "low": RGBColor(0x7F, 0x8C, 0x8D)}

    m = data.meeting
    prs = Presentation()
    prs.slide_width, prs.slide_height = Inches(13.333), Inches(7.5)
    W, H = prs.slide_width, prs.slide_height
    BLANK = prs.slide_layouts[6]
    slide_no = [0]

    def text(slide, x, y, w, h, s, size=14, bold=False, color=None, align=PP_ALIGN.LEFT, anchor=MSO_ANCHOR.TOP):
        tb = slide.shapes.add_textbox(x, y, w, h)
        tf = tb.text_frame
        tf.word_wrap = True
        tf.vertical_anchor = anchor
        p = tf.paragraphs[0]
        p.text = s
        p.alignment = align
        p.font.size = Pt(size)
        p.font.bold = bold
        if color is not None:
            p.font.color.rgb = color
        return tb

    def bullets(slide, x, y, w, h, items, size=16, color=None):
        tb = slide.shapes.add_textbox(x, y, w, h)
        tf = tb.text_frame
        tf.word_wrap = True
        for i, item in enumerate(items):
            p = tf.paragraphs[0] if i == 0 else tf.add_paragraph()
            p.text = f"•  {item}"
            p.font.size = Pt(size)
            p.space_after = Pt(6)
            if color is not None:
                p.font.color.rgb = color
        return tb

    def rect(slide, x, y, w, h, fill, shape=MSO_SHAPE.RECTANGLE):
        sh = slide.shapes.add_shape(shape, x, y, w, h)
        sh.fill.solid()
        sh.fill.fore_color.rgb = fill
        sh.line.fill.background()
        sh.shadow.inherit = False
        return sh

    def new_slide(title: str, subtitle: str = ""):
        slide = prs.slides.add_slide(BLANK)
        slide_no[0] += 1
        rect(slide, 0, 0, W, Inches(1.05), NAVY)
        text(slide, Inches(0.5), Inches(0.18), W - Inches(1.0), Inches(0.7), title, size=26, bold=True, color=WHITE,
             anchor=MSO_ANCHOR.MIDDLE)
        if subtitle:
            text(slide, Inches(0.5), Inches(1.12), W - Inches(1.0), Inches(0.4), subtitle, size=12, color=GREY)
        rect(slide, 0, H - Inches(0.4), W, Inches(0.4), LIGHT)
        text(slide, Inches(0.5), H - Inches(0.38), W - Inches(2.0), Inches(0.35),
             f"{m.title}  ·  {_fmt_date(m.date)}  ·  {PREPARED_BY}", size=9, color=GREY, anchor=MSO_ANCHOR.MIDDLE)
        text(slide, W - Inches(1.4), H - Inches(0.38), Inches(0.9), Inches(0.35), str(slide_no[0]), size=9,
             color=GREY, align=PP_ALIGN.RIGHT, anchor=MSO_ANCHOR.MIDDLE)
        return slide

    def table(slide, x, y, w, header, rows, col_widths, font=11, row_h=0.4):
        shape = slide.shapes.add_table(len(rows) + 1, len(header), x, y, w, Inches(row_h) * (len(rows) + 1))
        tbl = shape.table
        for i, cw in enumerate(col_widths):
            tbl.columns[i].width = Inches(cw)
        for c, hname in enumerate(header):
            cell = tbl.cell(0, c)
            cell.text = hname
            cell.fill.solid()
            cell.fill.fore_color.rgb = NAVY
            para = cell.text_frame.paragraphs[0]
            para.font.bold = True
            para.font.size = Pt(font)
            para.font.color.rgb = WHITE
        for r, row in enumerate(rows, 1):
            for c, val in enumerate(row):
                cell = tbl.cell(r, c)
                cell.text = str(val)
                cell.fill.solid()
                cell.fill.fore_color.rgb = LIGHT if r % 2 == 0 else WHITE
                cell.text_frame.paragraphs[0].font.size = Pt(font)
        return tbl

    # 1. Title -----------------------------------------------------------------
    slide = prs.slides.add_slide(BLANK)
    slide_no[0] += 1
    rect(slide, 0, 0, W, H, NAVY)
    rect(slide, Inches(0.8), Inches(2.3), Inches(0.12), Inches(2.4), ACCENTS[2])
    text(slide, Inches(1.1), Inches(2.2), W - Inches(2.0), Inches(1.4), m.title, size=40, bold=True, color=WHITE)
    text(slide, Inches(1.1), Inches(3.6), W - Inches(2.0), Inches(0.6), "Meeting minutes and intelligence summary",
         size=20, color=RGBColor(0xD9, 0xE3, 0xEE))
    text(slide, Inches(1.1), Inches(4.3), W - Inches(2.0), Inches(0.5),
         f"{_fmt_datetime(m.date)}   ·   {_fmt_duration(data.duration_seconds)}   ·   "
         f"{len(data.speakers) or 1} participant{'s' if len(data.speakers) != 1 else ''}   ·   {_source_label(m)}",
         size=14, color=RGBColor(0xB8, 0xCC, 0xE0))
    text(slide, Inches(1.1), H - Inches(1.0), W - Inches(2.0), Inches(0.5),
         f"Prepared by {PREPARED_BY}  ·  {_fmt_datetime(data.generated_at)} UTC", size=11, color=RGBColor(0x8F, 0xA3, 0xB8))

    # 2. Agenda ----------------------------------------------------------------
    slide = new_slide("Agenda", "Topics in the order they were discussed")
    if data.spans:
        y = Inches(1.7)
        for i, sp in enumerate(data.spans[:10], 1):
            rect(slide, Inches(0.6), y, Inches(0.55), Inches(0.5), ACCENTS[(i - 1) % len(ACCENTS)], MSO_SHAPE.ROUNDED_RECTANGLE)
            text(slide, Inches(0.6), y, Inches(0.55), Inches(0.5), str(i), size=16, bold=True, color=WHITE,
                 align=PP_ALIGN.CENTER, anchor=MSO_ANCHOR.MIDDLE)
            text(slide, Inches(1.35), y, Inches(8.5), Inches(0.5),
                 sp.topic.title + ("   (recurring)" if sp.topic.is_recurring else ""), size=18, anchor=MSO_ANCHOR.MIDDLE)
            text(slide, Inches(10.2), y, Inches(2.6), Inches(0.5), f"{_fmt_time(sp.start)} – {_fmt_time(sp.end)}",
                 size=14, color=GREY, align=PP_ALIGN.RIGHT, anchor=MSO_ANCHOR.MIDDLE)
            y += Inches(0.58)
    else:
        text(slide, Inches(0.6), Inches(1.8), W - Inches(1.2), Inches(1), "No agenda items could be derived.", size=16, color=GREY)

    # 3. At a glance -------------------------------------------------------------
    slide = new_slide("Meeting at a glance")
    tiles = [
        ("Duration", _fmt_duration(data.duration_seconds)), ("Participants", str(len(data.speakers))),
        ("Topics", str(len(data.topics))), ("Decisions", str(len(data.decisions))),
        ("Action items", str(len(data.tasks))), ("Open questions", str(len(data.open_questions))),
    ]
    tw, th, gap = Inches(3.9), Inches(1.9), Inches(0.3)
    for i, (label, value) in enumerate(tiles):
        col, row = i % 3, i // 3
        x = Inches(0.6) + col * (tw + gap)
        y = Inches(1.7) + row * (th + gap)
        rect(slide, x, y, tw, th, LIGHT, MSO_SHAPE.ROUNDED_RECTANGLE)
        rect(slide, x, y, Inches(0.12), th, ACCENTS[i % len(ACCENTS)])
        text(slide, x + Inches(0.4), y + Inches(0.25), tw - Inches(0.6), Inches(0.9), value, size=34, bold=True, color=NAVY)
        text(slide, x + Inches(0.4), y + Inches(1.2), tw - Inches(0.6), Inches(0.5), label, size=14, color=GREY)
    open_n = len([a for a in data.tasks if not a.resolved])
    text(slide, Inches(0.6), Inches(6.2), W - Inches(1.2), Inches(0.5),
         f"{open_n} action item{'s' if open_n != 1 else ''} still open  ·  {len(data.done_actions)} completed  ·  "
         f"summary depth: {data.summary_type}", size=13, color=GREY)

    # 4. Executive summary -------------------------------------------------------
    slide = new_slide("Executive summary")
    pts = _summary_points(data, limit=6)
    bullets(slide, Inches(0.6), Inches(1.6), W - Inches(1.2), Inches(5.2), pts or ["No summary available."], size=18)

    # 5. Timeline ----------------------------------------------------------------
    if data.spans and data.duration_seconds > 0:
        slide = new_slide("Meeting timeline", "How the discussion time was spent")
        x0, x1 = Inches(0.8), W - Inches(0.8)
        span_w = x1 - x0
        y = Inches(1.9)
        for i, sp in enumerate(data.spans[:10]):
            bx = x0 + int(span_w * (sp.start / data.duration_seconds))
            bw = max(int(span_w * ((sp.end - sp.start) / data.duration_seconds)), Inches(0.3))
            rect(slide, bx, y, bw, Inches(0.42), ACCENTS[i % len(ACCENTS)], MSO_SHAPE.ROUNDED_RECTANGLE)
            label = f"{sp.topic.title}  ({_fmt_time(sp.end - sp.start)})"
            if bw >= Inches(3.2):
                text(slide, bx + Inches(0.1), y - Inches(0.05), bw - Inches(0.2), Inches(0.5), label, size=11,
                     color=WHITE if i % len(ACCENTS) < 2 else NAVY, anchor=MSO_ANCHOR.MIDDLE)
            elif bx + bw + Inches(3.5) <= x1:
                text(slide, bx + bw + Inches(0.1), y - Inches(0.05), Inches(3.5), Inches(0.5), label, size=11,
                     color=NAVY, anchor=MSO_ANCHOR.MIDDLE)
            else:
                text(slide, bx - Inches(3.6), y - Inches(0.05), Inches(3.5), Inches(0.5), label, size=11,
                     color=NAVY, align=PP_ALIGN.RIGHT, anchor=MSO_ANCHOR.MIDDLE)
            y += Inches(0.5)
        # axis
        rect(slide, x0, y + Inches(0.15), span_w, Inches(0.03), GREY)
        for k in range(7):
            tx = x0 + int(span_w * k / 6)
            text(slide, tx - Inches(0.4), y + Inches(0.2), Inches(0.8), Inches(0.3),
                 _fmt_time(data.duration_seconds * k / 6), size=10, color=GREY, align=PP_ALIGN.CENTER)

    # 6. Participation --------------------------------------------------------------
    if data.talk_time:
        slide = new_slide("Participation", "Speaking time per participant")
        cd = CategoryChartData()
        items = sorted(data.talk_time.items(), key=lambda kv: -kv[1])[:8]
        cd.categories = [k for k, _ in items]
        cd.add_series("Speaking time (s)", [round(v, 1) for _, v in items])
        gf = slide.shapes.add_chart(XL_CHART_TYPE.DOUGHNUT, Inches(0.6), Inches(1.6), Inches(6.2), Inches(5.2), cd)
        chart = gf.chart
        chart.has_title = False
        chart.has_legend = True
        chart.legend.position = XL_LEGEND_POSITION.BOTTOM
        chart.legend.include_in_layout = False
        chart.legend.font.size = Pt(12)
        dl = chart.plots[0].data_labels
        dl.show_percentage = True
        dl.show_value = False
        dl.show_category_name = False
        dl.number_format = "0%"
        dl.number_format_is_linked = False
        dl.font.size = Pt(12)
        dl.font.bold = True
        dl.font.color.rgb = WHITE
        for idx in range(len(items)):
            pt = chart.plots[0].series[0].points[idx]
            pt.format.fill.solid()
            pt.format.fill.fore_color.rgb = ACCENTS[idx % len(ACCENTS)]
        total = sum(data.talk_time.values()) or 1.0
        lines = defaultdict(int)
        for s in data.transcript:
            lines[_speaker_name(s)] += 1
        table(slide, Inches(7.2), Inches(1.7), Inches(5.6), ["Participant", "Time", "Share", "Turns"],
              [[k, _fmt_time(v), f"{v / total:.0%}", str(lines[k])] for k, v in items], [2.3, 1.1, 1.0, 1.2])

    # 7. One slide per topic -----------------------------------------------------------
    for i, sp in enumerate(data.spans[:12], 1):
        slide = new_slide(f"Topic {i}: {sp.topic.title}",
                          f"{_fmt_time(sp.start)} – {_fmt_time(sp.end)}" + ("  ·  recurring topic" if sp.topic.is_recurring else ""))
        left_w = Inches(7.4) if (sp.decisions or sp.actions) else W - Inches(1.2)
        text(slide, Inches(0.6), Inches(1.65), left_w, Inches(0.4), "Discussion", size=13, bold=True, color=NAVY)
        text(slide, Inches(0.6), Inches(2.05), left_w, Inches(4.6),
             sp.topic.summary or "General discussion; see the transcript for details.", size=15)
        if sp.decisions or sp.actions:
            x = Inches(8.3)
            rect(slide, x, Inches(1.65), Inches(4.5), Inches(5.0), LIGHT, MSO_SHAPE.ROUNDED_RECTANGLE)
            y = Inches(1.8)
            if sp.decisions:
                text(slide, x + Inches(0.25), y, Inches(4.0), Inches(0.35), "Decisions", size=12, bold=True, color=NAVY)
                y += Inches(0.35)
                for d in sp.decisions[:3]:
                    text(slide, x + Inches(0.25), y, Inches(4.0), Inches(0.75), f"•  {d.description}", size=11)
                    y += Inches(0.72)
            if sp.actions:
                text(slide, x + Inches(0.25), y, Inches(4.0), Inches(0.35), "Actions", size=12, bold=True, color=NAVY)
                y += Inches(0.35)
                for a in sp.actions[:4]:
                    tail = " — " + ", ".join(v for v in [a.owner, a.due] if v) if (a.owner or a.due) else ""
                    text(slide, x + Inches(0.25), y, Inches(4.0), Inches(0.7), f"•  {a.description}{tail}", size=11)
                    y += Inches(0.65)

    # 8. Decisions ------------------------------------------------------------------------
    slide = new_slide("Decisions", f"{len(data.decisions)} decision{'s' if len(data.decisions) != 1 else ''} recorded")
    if data.decisions:
        rows = [[str(i), d.description, d.rationale or "—", _fmt_time(data.seg_time(d.segment_index))]
                for i, d in enumerate(data.decisions[:8], 1)]
        table(slide, Inches(0.6), Inches(1.7), Inches(12.1), ["#", "Decision", "Rationale", "When"], rows,
              [0.5, 6.0, 4.4, 1.2], font=12, row_h=0.55)
    else:
        text(slide, Inches(0.6), Inches(1.8), W - Inches(1.2), Inches(1), "No decisions were recorded in this meeting.",
             size=16, color=GREY)

    # 9. Action items — chart -------------------------------------------------------------
    if data.tasks:
        slide = new_slide("Action items — overview", "By priority and by owner")
        counts = defaultdict(int)
        for a in data.tasks:
            counts[(a.urgency or "low").lower()] += 1
        cats = [p for p in ("critical", "high", "medium", "low") if counts.get(p)]
        cd = CategoryChartData()
        cd.categories = [c.title() for c in cats]
        cd.add_series("Action items", [counts[c] for c in cats])
        gf = slide.shapes.add_chart(XL_CHART_TYPE.BAR_CLUSTERED, Inches(0.6), Inches(1.6), Inches(6.0), Inches(4.8), cd)
        ch = gf.chart
        ch.has_title = False
        ch.has_legend = False
        ch.plots[0].has_data_labels = True
        ch.plots[0].data_labels.font.size = Pt(12)
        ch.category_axis.tick_labels.font.size = Pt(12)
        ch.category_axis.reverse_order = True
        ch.value_axis.has_major_gridlines = False
        ch.value_axis.major_unit = 1
        ch.value_axis.minimum_scale = 0
        ch.value_axis.tick_labels.font.size = Pt(10)
        for idx, c in enumerate(cats):
            pt = ch.plots[0].series[0].points[idx]
            pt.format.fill.solid()
            pt.format.fill.fore_color.rgb = PRIO[c]
        text(slide, Inches(0.6), Inches(6.4), Inches(6), Inches(0.4), "Action items by priority", size=12, bold=True, color=NAVY)

        owners = defaultdict(int)
        for a in data.tasks:
            owners[a.owner or "Unassigned"] += 1
        oitems = sorted(owners.items(), key=lambda kv: (kv[0] == "Unassigned", -kv[1]))[:8]
        cd2 = CategoryChartData()
        cd2.categories = [k for k, _ in oitems]
        cd2.add_series("Action items", [v for _, v in oitems])
        gf2 = slide.shapes.add_chart(XL_CHART_TYPE.COLUMN_CLUSTERED, Inches(7.0), Inches(1.6), Inches(5.8), Inches(4.8), cd2)
        ch2 = gf2.chart
        ch2.has_title = False
        ch2.has_legend = False
        ch2.plots[0].has_data_labels = True
        ch2.plots[0].data_labels.font.size = Pt(12)
        ch2.category_axis.tick_labels.font.size = Pt(11)
        ch2.value_axis.has_major_gridlines = False
        ch2.value_axis.major_unit = 1
        ch2.value_axis.minimum_scale = 0
        ch2.value_axis.tick_labels.font.size = Pt(10)
        ch2.plots[0].series[0].format.fill.solid()
        ch2.plots[0].series[0].format.fill.fore_color.rgb = ACCENTS[1]
        text(slide, Inches(7.0), Inches(6.4), Inches(6), Inches(0.4), "Ownership", size=12, bold=True, color=NAVY)

    # 10. Action items — register ------------------------------------------------------------
    per = 7
    tasks = data.tasks
    for start in range(0, max(len(tasks), 1), per):
        chunk = tasks[start:start + per]
        slide = new_slide("Action item register" + (" (cont.)" if start else ""),
                          f"{len([a for a in tasks if not a.resolved])} open · {len([a for a in tasks if a.resolved])} completed")
        if not chunk:
            text(slide, Inches(0.6), Inches(1.8), W - Inches(1.2), Inches(1), "No action items were recorded.", size=16, color=GREY)
            break
        rows = [[str(start + i), a.description, a.owner or "Unassigned", a.due or "—", (a.urgency or "low").title(),
                 "Done" if a.resolved else "Open"] for i, a in enumerate(chunk, 1)]
        tbl = table(slide, Inches(0.6), Inches(1.7), Inches(12.1), ["#", "Task", "Owner", "Due", "Priority", "Status"],
                    rows, [0.5, 5.6, 1.8, 1.6, 1.3, 1.3], font=12, row_h=0.55)
        for r, a in enumerate(chunk, 1):
            cell = tbl.cell(r, 4)
            cell.fill.solid()
            cell.fill.fore_color.rgb = PRIO.get((a.urgency or "low").lower(), PRIO["low"])
            cell.text_frame.paragraphs[0].font.color.rgb = WHITE
            cell.text_frame.paragraphs[0].font.bold = True

    # 11. Open questions --------------------------------------------------------------------
    slide = new_slide("Open questions and follow-ups", "Items that still need a decision")
    if data.open_questions:
        bullets(slide, Inches(0.6), Inches(1.7), W - Inches(1.2), Inches(5), [a.description for a in data.open_questions[:10]], size=17)
    else:
        text(slide, Inches(0.6), Inches(1.8), W - Inches(1.2), Inches(1), "Nothing was left open.", size=16, color=GREY)

    # 12. Next steps ------------------------------------------------------------------------
    slide = new_slide("Next steps", "Proposed agenda for the next meeting")
    bullets(slide, Inches(0.6), Inches(1.7), W - Inches(1.2), Inches(5), _next_agenda(data), size=17)

    # 13. Closing ---------------------------------------------------------------------------
    slide = prs.slides.add_slide(BLANK)
    slide_no[0] += 1
    rect(slide, 0, 0, W, H, NAVY)
    text(slide, Inches(1.1), Inches(2.6), W - Inches(2.2), Inches(1.0), "Thank you", size=40, bold=True, color=WHITE)
    text(slide, Inches(1.1), Inches(3.6), W - Inches(2.2), Inches(1.6),
         f"These minutes were generated automatically from the recording of “{m.title}”.\n"
         f"Decisions and action items should be confirmed by the meeting owner before circulation.",
         size=15, color=RGBColor(0xD9, 0xE3, 0xEE))
    text(slide, Inches(1.1), H - Inches(1.0), W - Inches(2.2), Inches(0.5),
         f"{PREPARED_BY}  ·  {_fmt_datetime(data.generated_at)} UTC", size=11, color=RGBColor(0x8F, 0xA3, 0xB8))

    path.parent.mkdir(parents=True, exist_ok=True)
    prs.save(str(path))
    return path


# ═════════════════════════════════════════════════════════════════════════════
# Project-level report
# ═════════════════════════════════════════════════════════════════════════════

def render_project_docx(db: Session, project: Project, path: Path) -> Path:
    from docx import Document
    from docx.enum.text import WD_ALIGN_PARAGRAPH
    from docx.shared import Inches, Pt, RGBColor

    meetings = sorted([mt for mt in project.meetings if mt.status == "done"], key=lambda x: x.date or datetime.min)
    doc = Document()
    doc.styles["Normal"].font.name = "Calibri"
    doc.styles["Normal"].font.size = Pt(10.5)
    section = doc.sections[0]
    section.left_margin = section.right_margin = Inches(0.9)
    ftr = section.footer.paragraphs[0]
    ftr.alignment = WD_ALIGN_PARAGRAPH.CENTER
    fr = ftr.add_run(f"{PREPARED_BY}  ·  Page ")
    fr.font.size = Pt(8)
    _docx_page_number(ftr)

    t = doc.add_paragraph()
    tr = t.add_run("PROJECT REPORT")
    tr.bold = True
    tr.font.size = Pt(11)
    tr.font.color.rgb = RGBColor(*_GREY)
    h = doc.add_paragraph()
    hr = h.add_run(project.name)
    hr.bold = True
    hr.font.size = Pt(22)
    hr.font.color.rgb = RGBColor(*_NAVY)

    total_dur = 0.0
    all_open: List[Tuple[str, ActionItem]] = []
    all_decisions: List[Tuple[Meeting, Decision]] = []
    recurring = 0
    for mt in meetings:
        segs = mt.segments
        if segs:
            total_dur += max(s.end_time for s in segs) - min(s.start_time for s in segs)
        if mt.context_entry:
            all_open += [(mt.title, a) for a in mt.context_entry.action_items if not a.resolved]
            all_decisions += [(mt, d) for d in mt.context_entry.decisions]
            recurring += sum(1 for tp in mt.context_entry.topics if tp.is_recurring)

    _docx_kv_table(doc, [
        ("Company", project.company or "—"), ("Category", project.category or "—"),
        ("Meetings covered", str(len(meetings))), ("Total meeting time", _fmt_duration(total_dur)),
        ("Open action items", str(len(all_open))), ("Decisions recorded", str(len(all_decisions))),
        ("Recurring topics flagged", str(recurring)),
        ("Prepared by", f"{PREPARED_BY} on {_fmt_datetime(datetime.utcnow())} UTC"),
    ])
    if project.description:
        doc.add_paragraph()
        doc.add_paragraph(project.description)

    doc.add_heading("1. Overall summary", level=1)
    if project.summary and project.summary.overall_summary:
        for kind, text in _summary_blocks(project.summary.overall_summary):
            if kind == "heading":
                doc.add_heading(text, level=2)
            elif kind == "bullet":
                doc.add_paragraph(text, style="List Bullet")
            else:
                doc.add_paragraph(text)
    else:
        doc.add_paragraph("No project summary has been synthesised yet.")

    doc.add_heading("2. Meetings", level=1)
    if meetings:
        _docx_table(doc, ["Date", "Meeting", "Decisions", "Actions", "Open"],
                    [[_fmt_date(mt.date), mt.title,
                      str(len(mt.context_entry.decisions) if mt.context_entry else 0),
                      str(len(mt.context_entry.action_items) if mt.context_entry else 0),
                      str(len([a for a in (mt.context_entry.action_items if mt.context_entry else []) if not a.resolved]))]
                     for mt in meetings], widths=[1.2, 3.4, 0.9, 0.9, 0.7])
    else:
        doc.add_paragraph("No completed meetings yet.")

    doc.add_heading("3. Open action items across meetings", level=1)
    if all_open:
        _docx_table(doc, ["Meeting", "Task", "Owner", "Due", "Priority"],
                    [[title, a.description, a.owner or "Unassigned", a.due or "—", (a.urgency or "low").title()]
                     for title, a in all_open], widths=[1.6, 3.0, 1.0, 0.8, 0.7])
        doc.add_paragraph()
        _docx_pictures(doc, [charts.priority_chart([a.urgency for _, a in all_open]),
                             charts.owner_chart([a.owner for _, a in all_open])], width_in=3.05)
    else:
        doc.add_paragraph("No open action items.")

    doc.add_heading("4. Decisions by meeting", level=1)
    if all_decisions:
        current = None
        for mt, d in all_decisions:
            if mt is not current:
                doc.add_heading(f"{mt.title} — {_fmt_date(mt.date)}", level=2)
                current = mt
            p = doc.add_paragraph(style="List Bullet")
            p.add_run(d.description)
            if d.rationale:
                p.add_run(f" — {d.rationale}").italic = True
    else:
        doc.add_paragraph("No decisions recorded yet.")

    path.parent.mkdir(parents=True, exist_ok=True)
    doc.save(str(path))
    return path


# ═════════════════════════════════════════════════════════════════════════════
# Entry point
# ═════════════════════════════════════════════════════════════════════════════

def generate_meeting_report(db: Session, meeting: Meeting, fmt: str, out_dir: Path,
                            include_transcript: bool = True) -> Path:
    if fmt not in FORMATS:
        raise ValueError(f"Unsupported format '{fmt}'. Choose one of {', '.join(FORMATS)}.")
    data = collect_meeting(db, meeting)
    stamp = datetime.utcnow().strftime("%Y%m%d-%H%M%S")
    base = f"{_safe_name(meeting.title)}_{stamp}"
    if fmt == "docx":
        return render_docx(data, out_dir / f"{base}_MoM.docx", include_transcript=include_transcript)
    if fmt == "pptx":
        return render_pptx(data, out_dir / f"{base}_slides.pptx")
    path = out_dir / f"{base}_MoM.md"
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(render_markdown(data, include_transcript=include_transcript), encoding="utf-8")
    return path
