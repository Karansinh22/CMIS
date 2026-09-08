"""
reports/charts.py — Small, clean charts for the Word report (PNG via matplotlib).

Every function returns ``BytesIO`` with a PNG, or ``None`` when matplotlib is
not installed or there is nothing to draw, so callers can fall back to tables.
Colours follow a restrained palette that prints well in black and white.
"""

from __future__ import annotations

import logging
from collections import Counter
from io import BytesIO
from typing import Dict, List, Optional, Sequence, Tuple

logger = logging.getLogger(__name__)

PALETTE = ["#1F3A5F", "#3E6D9C", "#7FA7C9", "#B8CCE0", "#D9E3EE", "#8FA3B8"]
PRIORITY_COLOURS = {"critical": "#8B1E1E", "high": "#C0392B", "medium": "#D68910", "low": "#7F8C8D"}
PRIORITY_ORDER = ["critical", "high", "medium", "low"]


def _plt():
    try:
        import matplotlib
        matplotlib.use("Agg")
        import matplotlib.pyplot as plt
        plt.rcParams.update({
            "font.family": "DejaVu Sans",
            "font.size": 9,
            "axes.edgecolor": "#888888",
            "axes.spines.top": False,
            "axes.spines.right": False,
            "figure.dpi": 150,
        })
        return plt
    except Exception as exc:  # noqa: BLE001
        logger.info("matplotlib unavailable (%s); charts skipped.", exc)
        return None


def _png(fig) -> BytesIO:
    buf = BytesIO()
    fig.savefig(buf, format="png", bbox_inches="tight", facecolor="white")
    buf.seek(0)
    import matplotlib.pyplot as plt
    plt.close(fig)
    return buf


def _fmt_mmss(seconds: float) -> str:
    m, s = divmod(int(seconds), 60)
    return f"{m:02d}:{s:02d}"


# ── Charts ────────────────────────────────────────────────────────────────────

def priority_chart(urgencies: Sequence[str]) -> Optional[BytesIO]:
    """Horizontal bars: number of action items per priority."""
    plt = _plt()
    if plt is None or not urgencies:
        return None
    counts = Counter((u or "low").lower() for u in urgencies)
    labels = [p for p in PRIORITY_ORDER if counts.get(p)]
    values = [counts[p] for p in labels]
    fig, ax = plt.subplots(figsize=(4.2, 1.2 + 0.4 * len(labels)))
    bars = ax.barh([p.title() for p in labels], values, color=[PRIORITY_COLOURS[p] for p in labels])
    ax.invert_yaxis()
    ax.set_xlabel("Action items")
    ax.xaxis.get_major_locator().set_params(integer=True)
    for b, v in zip(bars, values):
        ax.text(b.get_width() + 0.05, b.get_y() + b.get_height() / 2, str(v), va="center", fontsize=9)
    ax.set_title("Action items by priority", loc="left", fontsize=10, fontweight="bold")
    return _png(fig)


def owner_chart(owners: Sequence[Optional[str]]) -> Optional[BytesIO]:
    """Horizontal bars: action items per owner (unassigned shown last)."""
    plt = _plt()
    if plt is None or not owners:
        return None
    counts = Counter((o or "Unassigned") for o in owners)
    items = sorted(counts.items(), key=lambda kv: (kv[0] == "Unassigned", -kv[1], kv[0]))[:10]
    labels = [k for k, _ in items]
    values = [v for _, v in items]
    fig, ax = plt.subplots(figsize=(4.2, 1.2 + 0.38 * len(labels)))
    bars = ax.barh(labels, values, color=[PALETTE[i % len(PALETTE)] if l != "Unassigned" else "#BBBBBB" for i, l in enumerate(labels)])
    ax.invert_yaxis()
    ax.set_xlabel("Action items")
    ax.xaxis.get_major_locator().set_params(integer=True)
    for b, v in zip(bars, values):
        ax.text(b.get_width() + 0.05, b.get_y() + b.get_height() / 2, str(v), va="center", fontsize=9)
    ax.set_title("Ownership of action items", loc="left", fontsize=10, fontweight="bold")
    return _png(fig)


def speaker_chart(talk_time: Dict[str, float]) -> Optional[BytesIO]:
    """Donut of speaking time per participant."""
    plt = _plt()
    if plt is None or not talk_time or sum(talk_time.values()) <= 0:
        return None
    items = sorted(talk_time.items(), key=lambda kv: -kv[1])[:8]
    labels = [k for k, _ in items]
    values = [v for _, v in items]
    total = sum(values)
    fig, ax = plt.subplots(figsize=(4.2, 3.0))
    wedges, _ = ax.pie(values, colors=PALETTE[: len(values)], startangle=90, counterclock=False,
                       wedgeprops={"width": 0.42, "edgecolor": "white"})
    ax.legend(wedges, [f"{l} — {v / total:.0%} ({_fmt_mmss(v)})" for l, v in zip(labels, values)],
              loc="center left", bbox_to_anchor=(1.0, 0.5), frameon=False, fontsize=8)
    ax.set_title("Speaking time", loc="left", fontsize=10, fontweight="bold")
    ax.set_aspect("equal")
    return _png(fig)


def timeline_chart(spans: List[Tuple[str, float, float]], duration: float) -> Optional[BytesIO]:
    """Horizontal timeline of topics across the meeting."""
    plt = _plt()
    if plt is None or not spans or duration <= 0:
        return None
    fig, ax = plt.subplots(figsize=(6.4, 0.9 + 0.42 * len(spans)))
    for i, (title, start, end) in enumerate(spans):
        ax.barh(i, max(end - start, duration * 0.01), left=start, color=PALETTE[i % len(PALETTE)], height=0.6)
        ax.text(start + duration * 0.01, i, f"{title}", va="center", ha="left", fontsize=8,
                color="white" if i % len(PALETTE) < 2 else "black")
    ax.set_yticks(range(len(spans)))
    ax.set_yticklabels([f"{i + 1}" for i in range(len(spans))])
    ax.invert_yaxis()
    ax.set_xlim(0, duration)
    ticks = [duration * k / 6 for k in range(7)]
    ax.set_xticks(ticks)
    ax.set_xticklabels([_fmt_mmss(t) for t in ticks])
    ax.set_xlabel("Time into meeting")
    ax.set_title("Meeting timeline by topic", loc="left", fontsize=10, fontweight="bold")
    ax.grid(axis="x", color="#EEEEEE")
    ax.set_axisbelow(True)
    return _png(fig)


def status_chart(open_count: int, done_count: int) -> Optional[BytesIO]:
    """Simple stacked bar: open vs completed action items."""
    plt = _plt()
    if plt is None or open_count + done_count == 0:
        return None
    fig, ax = plt.subplots(figsize=(4.2, 1.0))
    ax.barh([0], [open_count], color="#C0392B", label=f"Open ({open_count})")
    ax.barh([0], [done_count], left=[open_count], color="#27AE60", label=f"Completed ({done_count})")
    ax.set_yticks([])
    ax.set_xlim(0, open_count + done_count)
    ax.legend(loc="upper center", bbox_to_anchor=(0.5, -0.35), ncol=2, frameon=False, fontsize=8)
    ax.set_title("Action item status", loc="left", fontsize=10, fontweight="bold")
    return _png(fig)
