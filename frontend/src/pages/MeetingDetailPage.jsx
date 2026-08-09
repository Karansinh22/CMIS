/**
 * MeetingDetailPage.jsx
 *
 * Shows full detail for one meeting:
 *  • Live processing pipeline (WebSocket) while status != done
 *  • Tabbed view: Transcript | Topics | Action Items | Decisions | Revision History
 *  • Inline Transcript Segment Editing & Audit Log Tracking
 */
import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
  ArrowLeft, Loader, RefreshCw, MessageSquare, Tag,
  CheckSquare, Gavel, User, Clock, RepeatIcon, AlertTriangle, Edit3, Check, X, History, Sparkles,
  Trash2, Plus
} from 'lucide-react';
import {
  getMeeting, getTranscript, getContext, patchActionItem, editTranscriptSegment,
  getTranscriptHistory, createActionItem, deleteActionItem, createDecision, deleteDecision
} from '../api';
import { useStatusSocket } from '../hooks/useStatusSocket';
import StatusBadge from '../components/StatusBadge';
import UrgencyBadge from '../components/UrgencyBadge';
import ProcessingStatus from '../components/ProcessingStatus';

// ── Helpers ───────────────────────────────────────────────────────────────────

function fmtDate(iso) {
  return new Date(iso).toLocaleString('en-IN', {
    weekday: 'long', day: 'numeric', month: 'long', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  });
}

function fmtTime(secs) {
  const m = Math.floor(secs / 60);
  const s = Math.floor(secs % 60);
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

const SPEAKER_COLORS = [
  'text-blue-300   bg-blue-500/10   border-blue-500/20',
  'text-purple-300 bg-purple-500/10 border-purple-500/20',
  'text-emerald-300 bg-emerald-500/10 border-emerald-500/20',
  'text-amber-300  bg-amber-500/10  border-amber-500/20',
  'text-rose-300   bg-rose-500/10   border-rose-500/20',
  'text-cyan-300   bg-cyan-500/10   border-cyan-500/20',
  'text-lime-300   bg-lime-500/10   border-lime-500/20',
  'text-pink-300   bg-pink-500/10   border-pink-500/20',
];

// ── Sub-components ─────────────────────────────────────────────────────────────

function TranscriptTab({ meetingId, segments, onSegmentUpdated }) {
  const [editingId, setEditingId] = useState(null);
  const [editText, setEditText] = useState('');
  const [saving, setSaving] = useState(false);

  const speakerMap = {};
  let colIdx = 0;
  segments.forEach((s) => {
    const lbl = s.speaker?.label || 'SPEAKER_00';
    if (!(lbl in speakerMap)) speakerMap[lbl] = colIdx++ % SPEAKER_COLORS.length;
  });

  const handleStartEdit = (seg) => {
    setEditingId(seg.id);
    setEditText(seg.text);
  };

  const handleSaveEdit = async (segId) => {
    if (!editText.trim()) return;
    setSaving(true);
    try {
      const { data } = await editTranscriptSegment(meetingId, segId, editText.trim());
      onSegmentUpdated(data);
      setEditingId(null);
    } catch (err) {
      alert('Failed to edit segment');
    } finally {
      setSaving(false);
    }
  };

  if (!segments.length) {
    return (
      <div className="glass p-10 text-center text-white/30 text-sm">
        No transcript segments yet.
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {segments.map((seg) => {
        const lbl = seg.speaker?.label || 'SPEAKER_00';
        const name = seg.speaker?.name || lbl;
        const colorCls = SPEAKER_COLORS[speakerMap[lbl]];
        const isEditing = editingId === seg.id;

        return (
          <div key={seg.id} className="glass p-3 rounded-xl border border-white/5 flex gap-3 group animate-fade-in items-start">
            <span className="text-white/20 text-xs font-mono pt-1 w-10 shrink-0">
              {fmtTime(seg.start_time)}
            </span>

            <span className={`badge ${colorCls} shrink-0 self-start mt-0.5 text-[10px]`}>
              {name}
            </span>

            {isEditing ? (
              <div className="flex-1 space-y-2">
                <textarea
                  value={editText}
                  onChange={(e) => setEditText(e.target.value)}
                  className="input text-xs w-full resize-none py-1.5"
                  rows={2}
                />
                <div className="flex justify-end gap-2">
                  <button
                    onClick={() => setEditingId(null)}
                    className="px-2.5 py-1 rounded text-xs text-white/50 hover:text-white"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={() => handleSaveEdit(seg.id)}
                    disabled={saving}
                    className="btn-primary text-xs py-1 px-3 gap-1"
                  >
                    <Check size={12} /> {saving ? 'Saving...' : 'Save'}
                  </button>
                </div>
              </div>
            ) : (
              <div className="flex-1 flex items-start justify-between gap-3">
                <p className="text-white/80 text-sm leading-relaxed">{seg.text}</p>
                <button
                  onClick={() => handleStartEdit(seg)}
                  className="opacity-0 group-hover:opacity-100 text-white/30 hover:text-brand-300 p-1 rounded transition-all"
                  title="Edit segment text"
                >
                  <Edit3 size={14} />
                </button>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

function HistoryTab({ meetingId }) {
  const [history, setHistory] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getTranscriptHistory(meetingId)
      .then(({ data }) => setHistory(data))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [meetingId]);

  if (loading) {
    return <div className="p-8 text-center text-white/30 text-xs">Loading edit history...</div>;
  }

  if (!history.length) {
    return (
      <div className="glass p-10 text-center text-white/30 text-sm">
        No edits have been made to this transcript yet. Edit any segment above to record revision history.
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {history.map((h) => (
        <div key={h.id} className="glass p-4 rounded-xl border border-white/10 space-y-2 text-xs">
          <div className="flex items-center justify-between text-white/40">
            <span>Edited by <strong className="text-white/70">{h.edited_by || 'User'}</strong> • {h.speaker_name}</span>
            <span>{new Date(h.edited_at).toLocaleString()}</span>
          </div>
          <div className="grid grid-cols-2 gap-3 pt-1">
            <div className="p-2.5 rounded-lg bg-red-500/10 border border-red-500/20 text-red-300">
              <span className="text-[10px] uppercase font-bold tracking-wider block text-red-400 mb-0.5">Original / Before</span>
              {h.old_text}
            </div>
            <div className="p-2.5 rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-emerald-300">
              <span className="text-[10px] uppercase font-bold tracking-wider block text-emerald-400 mb-0.5">Revised / After</span>
              {h.new_text}
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

function TopicsTab({ topics }) {
  if (!topics?.length) return <EmptyTab text="No topics extracted yet." />;
  return (
    <div className="space-y-3">
      {topics.map((t, idx) => (
        <div key={t.id} className="glass p-4 rounded-2xl border border-white/10 animate-fade-in">
          <div className="flex items-start justify-between gap-3">
            <div className="flex-1">
              <div className="flex items-center gap-2 mb-2">
                <span className="text-[10px] font-mono text-white/25 bg-white/5 px-1.5 py-0.5 rounded">#{idx + 1}</span>
                <h3 className="font-semibold text-white text-sm">{t.title}</h3>
                {t.is_recurring && (
                  <span className="badge badge-yellow text-[10px]">
                    <RepeatIcon size={9} /> Recurring
                  </span>
                )}
              </div>
              {t.summary && (
                <p className="text-white/50 text-xs leading-relaxed border-l-2 border-brand-500/30 pl-3">{t.summary}</p>
              )}
            </div>
            <Tag size={14} className="text-brand-400 shrink-0 mt-0.5" />
          </div>
        </div>
      ))}
    </div>
  );
}

function ActionItemsTab({ items = [], onToggle, onAdd, onDelete }) {
  const [showForm, setShowForm] = useState(false);
  const [desc, setDesc]         = useState('');
  const [owner, setOwner]       = useState('');
  const [urgency, setUrgency]   = useState('medium');

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!desc.trim()) return;
    await onAdd({ description: desc.trim(), owner: owner.trim() || null, urgency });
    setDesc('');
    setOwner('');
    setUrgency('medium');
    setShowForm(false);
  };

  const pending  = items.filter(i => !i.resolved);
  const resolved = items.filter(i => i.resolved);

  const urgencyOrder = { critical: 0, high: 1, medium: 2, low: 3 };
  const sorted = [...pending].sort((a, b) =>
    (urgencyOrder[a.urgency] ?? 3) - (urgencyOrder[b.urgency] ?? 3)
  );

  return (
    <div className="space-y-4">
      {/* Action Header bar */}
      <div className="flex items-center justify-between gap-4 bg-surface-50/50 p-3 rounded-2xl border border-white/[0.05]">
        <div className="flex items-center gap-3 text-xs text-white/40">
          <span>📋 {items.length} total</span>
          <span>⏳ {pending.length} pending</span>
          <span>✅ {resolved.length} resolved</span>
        </div>
        <button
          onClick={() => setShowForm((p) => !p)}
          className="btn-primary text-xs py-1.5 px-3"
        >
          {showForm ? <X size={13} /> : <Plus size={13} />}
          {showForm ? 'Cancel' : 'Add Action Item'}
        </button>
      </div>

      {/* Manual Add Action Form */}
      {showForm && (
        <form onSubmit={handleSubmit} className="glass p-4 rounded-2xl border border-brand-500/30 space-y-3 animate-fade-in bg-brand-600/[0.03]">
          <p className="text-xs font-bold text-brand-300 uppercase tracking-wider">New Action Item</p>
          <div>
            <input
              type="text"
              required
              placeholder="Task description (e.g. Prepare API endpoint for user profile)..."
              value={desc}
              onChange={(e) => setDesc(e.target.value)}
              className="input text-xs"
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label">Owner / Assignee</label>
              <input
                type="text"
                placeholder="e.g. Alex"
                value={owner}
                onChange={(e) => setOwner(e.target.value)}
                className="input text-xs"
              />
            </div>
            <div>
              <label className="label">Urgency Level</label>
              <select
                value={urgency}
                onChange={(e) => setUrgency(e.target.value)}
                className="input text-xs bg-surface-100"
              >
                <option value="critical">🔴 Critical (P0 / Blocker)</option>
                <option value="high">🟠 High (Urgent)</option>
                <option value="medium">🟡 Medium (Normal)</option>
                <option value="low">🔵 Low (Backlog)</option>
              </select>
            </div>
          </div>
          <div className="flex justify-end gap-2 pt-1">
            <button type="button" onClick={() => setShowForm(false)} className="btn-ghost text-xs py-1.5 px-3">
              Cancel
            </button>
            <button type="submit" className="btn-primary text-xs py-1.5 px-4">
              Save Action Item
            </button>
          </div>
        </form>
      )}

      {/* List items */}
      {items.length === 0 ? (
        <EmptyTab text="No action items yet. Click 'Add Action Item' to manually create one." icon={CheckSquare} />
      ) : (
        [...sorted, ...resolved].map((item) => (
          <div
            key={item.id}
            className={`glass p-4 rounded-2xl border animate-fade-in transition-all group relative ${
              item.resolved
                ? 'border-white/5 opacity-50'
                : item.urgency === 'critical'
                ? 'border-red-500/40 bg-red-500/5'
                : item.urgency === 'high'
                ? 'border-orange-500/30 bg-orange-500/[0.03]'
                : 'border-white/10'
            }`}
          >
            <div className="flex items-start gap-3">
              <button
                onClick={() => onToggle(item)}
                className={`mt-0.5 w-5 h-5 rounded-full border-2 flex items-center justify-center shrink-0 transition-all ${
                  item.resolved
                    ? 'border-emerald-500 bg-emerald-500/20 text-emerald-400'
                    : 'border-white/20 hover:border-brand-400'
                }`}
              >
                {item.resolved && <span className="text-[10px]">✓</span>}
              </button>

              <div className="flex-1 min-w-0 pr-8">
                <p className={`text-sm leading-relaxed ${
                  item.resolved ? 'line-through text-white/30' : 'text-white/85'
                }`}>
                  {item.description}
                </p>
                <div className="flex items-center gap-3 mt-2 flex-wrap">
                  <UrgencyBadge urgency={item.urgency} />
                  {item.owner && (
                    <span className="text-white/40 text-xs flex items-center gap-1 bg-white/5 px-2 py-0.5 rounded-full">
                      <User size={10} /> <strong className="text-white/60">{item.owner}</strong>
                    </span>
                  )}
                  {item.resolved && (
                    <span className="text-emerald-400/60 text-[10px] uppercase tracking-wider">Completed</span>
                  )}
                </div>
              </div>

              {/* Delete button */}
              <button
                onClick={() => onDelete(item.id)}
                className="absolute top-4 right-4 text-white/20 hover:text-red-400 transition-colors p-1 rounded-lg hover:bg-red-500/10"
                title="Delete Action Item"
              >
                <Trash2 size={14} />
              </button>
            </div>
          </div>
        ))
      )}
    </div>
  );
}

function DecisionsTab({ decisions = [], onAdd, onDelete }) {
  const [showForm, setShowForm] = useState(false);
  const [desc, setDesc]         = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!desc.trim()) return;
    await onAdd(desc.trim());
    setDesc('');
    setShowForm(false);
  };

  return (
    <div className="space-y-4">
      {/* Decisions Header bar */}
      <div className="flex items-center justify-between gap-4 bg-surface-50/50 p-3 rounded-2xl border border-white/[0.05]">
        <span className="text-xs text-white/40">🏛️ {decisions.length} recorded decision{decisions.length !== 1 ? 's' : ''}</span>
        <button
          onClick={() => setShowForm((p) => !p)}
          className="btn-primary text-xs py-1.5 px-3"
        >
          {showForm ? <X size={13} /> : <Plus size={13} />}
          {showForm ? 'Cancel' : 'Add Decision'}
        </button>
      </div>

      {/* Manual Add Decision Form */}
      {showForm && (
        <form onSubmit={handleSubmit} className="glass p-4 rounded-2xl border border-purple-500/30 space-y-3 animate-fade-in bg-purple-600/[0.03]">
          <p className="text-xs font-bold text-purple-300 uppercase tracking-wider">Record New Decision</p>
          <textarea
            required
            rows={2}
            placeholder="Decision details (e.g. Approved standardizing on FastAPI and Postgres for backend)..."
            value={desc}
            onChange={(e) => setDesc(e.target.value)}
            className="input text-xs"
          />
          <div className="flex justify-end gap-2 pt-1">
            <button type="button" onClick={() => setShowForm(false)} className="btn-ghost text-xs py-1.5 px-3">
              Cancel
            </button>
            <button type="submit" className="btn-primary text-xs py-1.5 px-4 bg-gradient-to-r from-purple-600 to-indigo-600">
              Save Decision
            </button>
          </div>
        </form>
      )}

      {/* List Decisions */}
      {decisions.length === 0 ? (
        <EmptyTab text="No decisions recorded yet. Click 'Add Decision' to record one." icon={Gavel} />
      ) : (
        decisions.map((d, idx) => (
          <div key={d.id} className="glass p-4 rounded-2xl border border-white/10 animate-fade-in relative group">
            <div className="flex items-start gap-3">
              <div className="w-6 h-6 rounded-full bg-purple-500/20 border border-purple-500/30 flex items-center justify-center shrink-0 mt-0.5">
                <span className="text-[10px] font-bold text-purple-400">{idx + 1}</span>
              </div>
              <div className="flex-1 pr-8">
                <p className="text-sm text-white/85 leading-relaxed">{d.description}</p>
                <p className="text-white/25 text-xs mt-1.5 flex items-center gap-1">
                  <Gavel size={9} className="text-purple-400/60" />
                  Decision recorded · {d.decided_on ? new Date(d.decided_on).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }) : 'Today'}
                </p>
              </div>
              <button
                onClick={() => onDelete(d.id)}
                className="absolute top-4 right-4 text-white/20 hover:text-red-400 transition-colors p-1 rounded-lg hover:bg-red-500/10"
                title="Delete Decision"
              >
                <Trash2 size={14} />
              </button>
            </div>
          </div>
        ))
      )}
    </div>
  );
}

/** Minimal inline markdown renderer for the summary (bold, italic, headers, bullets, blockquotes) */
function MarkdownRenderer({ text }) {
  const lines = text.split('\n');
  return (
    <div className="space-y-1.5 text-sm leading-relaxed">
      {lines.map((line, i) => {
        // --- headings
        if (/^### /.test(line)) return <h3 key={i} className="text-brand-300 font-bold text-xs uppercase tracking-widest mt-4 mb-1">{line.replace(/^### /, '')}</h3>;
        if (/^## /.test(line)) return <h2 key={i} className="text-white font-bold text-base mt-5 mb-1">{line.replace(/^## /, '')}</h2>;
        if (/^# /.test(line)) return <h1 key={i} className="text-white font-extrabold text-lg mt-5 mb-1">{line.replace(/^# /, '')}</h1>;
        // --- horizontal rule
        if (/^---/.test(line)) return <hr key={i} className="border-white/10 my-3" />;
        // --- blockquote
        if (/^> /.test(line)) return <blockquote key={i} className="border-l-2 border-brand-500/50 pl-3 text-white/60 italic text-xs my-1">{line.replace(/^> /, '')}</blockquote>;
        // --- table row
        if (/^\|/.test(line)) {
          if (/^\|[-|\s]+\|/.test(line)) return <tr key={i} />;
          const cells = line.split('|').filter((_, ci) => ci > 0 && ci < line.split('|').length - 1);
          const isHeader = i > 0 && /^\|[-|\s]+\|/.test(lines[i + 1] || '');
          return (
            <tr key={i} className="border-b border-white/5">
              {cells.map((cell, ci) => isHeader
                ? <th key={ci} className="px-3 py-1.5 text-left text-xs font-semibold text-white/60 uppercase tracking-wide">{cell.trim()}</th>
                : <td key={ci} className="px-3 py-1.5 text-xs text-white/70">{cell.trim()}</td>
              )}
            </tr>
          );
        }
        // --- bullet
        if (/^[•\-] /.test(line)) {
          const content = line.replace(/^[•\-] /, '').replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>').replace(/\*([^*]+)\*/g, '<em>$1</em>').replace(/`([^`]+)`/g, '<code class="bg-white/10 px-1 rounded text-[11px]">$1</code>');
          return <div key={i} className="flex gap-2 text-white/75 text-xs py-0.5"><span className="text-brand-400 shrink-0">•</span><span dangerouslySetInnerHTML={{ __html: content }} /></div>;
        }
        if (/^\d+\. /.test(line)) {
          const num = line.match(/^(\d+)\. /)?.[1];
          const content = line.replace(/^\d+\. /, '').replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>').replace(/\*([^*]+)\*/g, '<em>$1</em>');
          return <div key={i} className="flex gap-2 text-white/75 text-xs py-0.5"><span className="text-brand-400 font-mono shrink-0">{num}.</span><span dangerouslySetInnerHTML={{ __html: content }} /></div>;
        }
        // --- italic-only line (meta info)
        if (/^\*[^*]/.test(line) && line.endsWith('*')) return <p key={i} className="text-white/30 text-xs italic mt-2">{line.replace(/^\*/, '').replace(/\*$/, '')}</p>;
        // --- blank
        if (!line.trim()) return <div key={i} className="h-1" />;
        // --- paragraph with inline bold/italic/code
        const html = line
          .replace(/\*\*([^*]+)\*\*/g, '<strong class="text-white">$1</strong>')
          .replace(/\*([^*]+)\*/g, '<em class="text-white/60">$1</em>')
          .replace(/`([^`]+)`/g, '<code class="bg-white/10 px-1 rounded text-[11px] font-mono text-brand-300">$1</code>');
        return <p key={i} className="text-white/75 text-sm" dangerouslySetInnerHTML={{ __html: html }} />;
      })}
    </div>
  );
}

function SummaryTab({ summary, summaryType }) {
  if (!summary) {
    return <EmptyTab text="Summary will appear here once the transcript finishes processing." />;
  }
  const typeLabel =
    summaryType === 'brief' ? 'Brief Executive Summary' :
    summaryType === 'comprehensive' ? 'Comprehensive Intelligence Report' :
    'Balanced Overview';

  return (
    <div className="glass p-6 rounded-2xl border border-white/10 space-y-4 animate-fade-in">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-bold text-brand-300 uppercase tracking-wider flex items-center gap-2">
          <Sparkles size={16} /> Meeting Intelligence
        </h3>
        <span className="badge badge-brand text-[10px] uppercase font-semibold tracking-widest">
          {typeLabel}
        </span>
      </div>
      <div className="pt-2 border-t border-white/5">
        <MarkdownRenderer text={summary} />
      </div>
    </div>
  );
}

function EmptyTab({ text, icon: Icon }) {
  return (
    <div className="flex flex-col items-center gap-3 py-14 text-center">
      {Icon && <Icon size={28} className="text-white/10" />}
      <p className="text-white/30 text-sm">{text}</p>
    </div>
  );
}

const TABS = [
  { key: 'summary',    label: 'Summary',          icon: Sparkles,      count: null },
  { key: 'transcript', label: 'Transcript',        icon: MessageSquare, count: null },
  { key: 'topics',     label: 'Topics',            icon: Tag,           countKey: 'topics' },
  { key: 'actions',    label: 'Actions',           icon: CheckSquare,   countKey: 'action_items' },
  { key: 'decisions',  label: 'Decisions',         icon: Gavel,         countKey: 'decisions' },
  { key: 'history',    label: 'History',           icon: History,       count: null },
];

export default function MeetingDetailPage() {
  const { id }   = useParams();
  const navigate = useNavigate();

  const [meeting,  setMeeting]  = useState(null);
  const [segments, setSegments] = useState([]);
  const [context,  setContext]  = useState(null);
  const [wsStatus, setWsStatus] = useState(null);
  const [tab,      setTab]      = useState('summary');
  const [loading,  setLoading]  = useState(true);
  const [error,    setError]    = useState(null);

  useStatusSocket(
    meeting && meeting.status !== 'done' ? id : null,
    (event) => {
      if (event.status === 'ping') return;
      setWsStatus(event);
      if (event.status === 'done') loadAll();
    }
  );

  const loadAll = async () => {
    try {
      const [mRes, tRes] = await Promise.all([getMeeting(id), getTranscript(id)]);
      setMeeting(mRes.data);
      setSegments(tRes.data);

      if (mRes.data.status === 'done') {
        try {
          const cRes = await getContext(id);
          setContext(cRes.data);
        } catch { /* ignore */ }
      }
    } catch {
      setError('Meeting not found or backend unavailable.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { loadAll(); }, [id]);

  const handleSegmentUpdated = (updatedSeg) => {
    setSegments((prev) => prev.map((s) => (s.id === updatedSeg.id ? updatedSeg : s)));
  };

  const handleToggleAction = async (item) => {
    setContext((prev) => ({
      ...prev,
      action_items: (prev?.action_items || []).map((a) => (a.id === item.id ? { ...a, resolved: !a.resolved } : a)),
    }));
    try {
      await patchActionItem(item.id, { resolved: !item.resolved });
    } catch {
      setContext((prev) => ({
        ...prev,
        action_items: (prev?.action_items || []).map((a) => (a.id === item.id ? { ...a, resolved: item.resolved } : a)),
      }));
    }
  };

  const handleAddAction = async (data) => {
    try {
      const res = await createActionItem(id, data);
      setContext((prev) => ({
        ...prev,
        action_items: [...(prev?.action_items || []), res.data],
      }));
    } catch {
      /* error fallback */
    }
  };

  const handleDeleteAction = async (itemId) => {
    try {
      await deleteActionItem(itemId);
      setContext((prev) => ({
        ...prev,
        action_items: (prev?.action_items || []).filter((a) => a.id !== itemId),
      }));
    } catch {
      /* error fallback */
    }
  };

  const handleAddDecision = async (description) => {
    try {
      const res = await createDecision(id, { description });
      setContext((prev) => ({
        ...prev,
        decisions: [...(prev?.decisions || []), res.data],
      }));
    } catch {
      /* error fallback */
    }
  };

  const handleDeleteDecision = async (decisionId) => {
    try {
      await deleteDecision(decisionId);
      setContext((prev) => ({
        ...prev,
        decisions: (prev?.decisions || []).filter((d) => d.id !== decisionId),
      }));
    } catch {
      /* error fallback */
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh] text-white/30 gap-2">
        <Loader size={20} className="animate-spin" /> Loading meeting…
      </div>
    );
  }

  if (error) {
    return (
      <div className="max-w-xl mx-auto py-16 px-4 text-center animate-fade-in">
        <AlertTriangle size={36} className="text-red-400 mx-auto mb-3" />
        <p className="text-red-400 text-sm">{error}</p>
        <button onClick={() => navigate('/meetings')} className="btn-secondary mt-4 mx-auto">
          Back to Meetings
        </button>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto py-8 px-4 animate-slide-up">
      {/* Back nav */}
      <button onClick={() => navigate('/meetings')} className="btn-ghost mb-5 text-xs pl-0">
        <ArrowLeft size={13} /> Back to Meetings
      </button>

      {/* Meeting header card */}
      <div className="glass p-5 rounded-2xl border border-white/[0.07] mb-6 flex items-start gap-4">
        <div className="w-12 h-12 rounded-xl bg-gradient-brand/10 border border-brand-500/20
                        flex items-center justify-center shrink-0">
          <MessageSquare size={18} className="text-brand-400" />
        </div>
        <div className="flex-1 min-w-0">
          <h1 className="text-xl font-bold text-white tracking-tight leading-tight">{meeting.title}</h1>
          <p className="text-white/35 text-xs mt-1 flex items-center gap-2">
            <Clock size={10} />
            {fmtDate(meeting.date)}
            {meeting.summary_type && (
              <>
                <span className="text-white/15">·</span>
                <span className="capitalize">{meeting.summary_type} summary</span>
              </>
            )}
          </p>
          {context && (
            <div className="flex gap-3 mt-2.5 text-[10px] text-white/40">
              {context.topics?.length > 0 && (
                <span className="flex items-center gap-1">
                  <Tag size={9} className="text-brand-400" /> {context.topics.length} topics
                </span>
              )}
              {context.action_items?.length > 0 && (
                <span className="flex items-center gap-1">
                  <CheckSquare size={9} className="text-emerald-400" />
                  {context.action_items.filter(a => !a.resolved).length} pending actions
                </span>
              )}
              {context.decisions?.length > 0 && (
                <span className="flex items-center gap-1">
                  <Gavel size={9} className="text-purple-400" /> {context.decisions.length} decisions
                </span>
              )}
            </div>
          )}
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <StatusBadge status={wsStatus?.status || meeting.status} />
          <button onClick={loadAll} className="btn-icon p-1.5" title="Refresh">
            <RefreshCw size={13} className="text-white/35" />
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div className="tab-bar mb-5">
        {TABS.map(({ key, label, icon: Icon, countKey }) => {
          const count = countKey && context?.[countKey]?.length;
          return (
            <button
              key={key}
              onClick={() => setTab(key)}
              className={tab === key ? 'tab-btn-active' : 'tab-btn-inactive'}
            >
              <Icon size={12} />
              <span className="hidden sm:inline">{label}</span>
              {count > 0 && (
                <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded-full ${
                  tab === key ? 'bg-white/20 text-white' : 'bg-white/[0.06] text-white/40'
                }`}>
                  {count}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* Tab Content */}
      <div className="animate-fade-in-fast">
        {tab === 'summary'    && <SummaryTab summary={context?.summary} summaryType={context?.summary_type || meeting?.summary_type} />}
        {tab === 'transcript' && (
          <TranscriptTab meetingId={id} segments={segments} onSegmentUpdated={handleSegmentUpdated} />
        )}
        {tab === 'history'   && <HistoryTab meetingId={id} />}
        {tab === 'topics'    && <TopicsTab topics={context?.topics} />}
        {tab === 'actions'   && (
          <ActionItemsTab
            items={context?.action_items}
            onToggle={handleToggleAction}
            onAdd={handleAddAction}
            onDelete={handleDeleteAction}
          />
        )}
        {tab === 'decisions' && (
          <DecisionsTab
            decisions={context?.decisions}
            onAdd={handleAddDecision}
            onDelete={handleDeleteDecision}
          />
        )}
      </div>
    </div>
  );
}
