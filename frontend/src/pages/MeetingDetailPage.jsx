/**
 * MeetingDetailPage.jsx
 *
 * Full meeting intelligence detail page:
 *  • Real-time processing status card when status != done
 *  • Tabbed workspace: Summary | Transcript | Topics | Actions | Decisions | History
 *  • Inline Transcript Editing & Revision Audit History
 *  • Strict Enterprise Monochrome UI
 */
import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  ArrowLeft, Loader, RefreshCw, MessageSquare, Tag,
  CheckSquare, Gavel, User, Clock, RepeatIcon, AlertCircle, Edit3, Check, X, History, Sparkles,
  Trash2, Plus, Calendar, FileText, Quote, HelpCircle, Radio, Download, Presentation, FileDown, Mic
} from 'lucide-react';
import {
  getMeeting, getTranscript, getContext, patchActionItem, editTranscriptSegment,
  getTranscriptHistory, createActionItem, deleteActionItem, createDecision, deleteDecision,
  deleteMeeting, generateReport, listReports, deleteReport, downloadReport
} from '../api';
import { useStatusSocket } from '../hooks/useStatusSocket';
import StatusBadge from '../components/StatusBadge';
import UrgencyBadge from '../components/UrgencyBadge';
import ProcessingStatus from '../components/ProcessingStatus';
import LiveTranscript from '../components/LiveTranscript';
import DeleteConfirmModal from '../components/DeleteConfirmModal';

// ── Helpers ───────────────────────────────────────────────────────────────────

function fmtDate(iso) {
  if (!iso) return '';
  return new Date(iso).toLocaleString('en-IN', {
    weekday: 'short', day: 'numeric', month: 'short', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  });
}

function fmtTime(secs) {
  const m = Math.floor(secs / 60);
  const s = Math.floor(secs % 60);
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

// ── Sub-components ─────────────────────────────────────────────────────────────

function TranscriptTab({ meetingId, segments, onSegmentUpdated }) {
  const [editingId, setEditingId] = useState(null);
  const [editText, setEditText]   = useState('');
  const [saving, setSaving]       = useState(false);

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
    } catch {
      alert('Failed to update transcript segment.');
    } finally {
      setSaving(false);
    }
  };

  if (!segments.length) {
    return <EmptyTab text="No transcript segments available for this recording." icon={MessageSquare} />;
  }

  return (
    <div className="space-y-2.5">
      {segments.map((seg) => {
        const lbl = seg.speaker?.label || 'SPEAKER_00';
        const name = seg.speaker?.name || lbl;
        const isEditing = editingId === seg.id;

        return (
          <div
            key={seg.id}
            className="card p-3.5 flex gap-3 group items-start hover:border-border-strong transition-colors"
          >
            {/* Timestamp */}
            <span className="text-text-muted text-xs font-mono pt-0.5 w-12 shrink-0">
              {fmtTime(seg.start_time)}
            </span>

            {/* Speaker Tag */}
            <span className="badge badge-strong shrink-0 text-[10px] uppercase font-semibold tracking-wider">
              {name}
            </span>

            {isEditing ? (
              <div className="flex-1 space-y-2">
                <textarea
                  value={editText}
                  onChange={(e) => setEditText(e.target.value)}
                  className="input text-xs w-full resize-none py-1.5"
                  rows={2}
                  autoFocus
                />
                <div className="flex justify-end gap-2">
                  <button
                    onClick={() => setEditingId(null)}
                    className="btn-ghost text-xs py-1 px-2.5"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={() => handleSaveEdit(seg.id)}
                    disabled={saving}
                    className="btn-primary text-xs py-1 px-3"
                  >
                    <Check size={12} /> {saving ? 'Saving...' : 'Save'}
                  </button>
                </div>
              </div>
            ) : (
              <div className="flex-1 flex items-start justify-between gap-3">
                <p className="text-text-primary text-xs sm:text-sm leading-relaxed">{seg.text}</p>
                <button
                  onClick={() => handleStartEdit(seg)}
                  className="opacity-0 group-hover:opacity-100 text-text-muted hover:text-text-primary p-1 rounded transition-all shrink-0"
                  title="Edit segment"
                >
                  <Edit3 size={13} />
                </button>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

/** "Where did this come from?" — the verbatim transcript sentence behind an extracted item. */
function EvidenceQuote({ evidence, segmentIndex, segmentsByIndex }) {
  const [open, setOpen] = useState(false);
  if (!evidence) return null;
  const seg = segmentIndex != null ? segmentsByIndex?.[segmentIndex] : null;
  const who = seg?.speaker?.name || seg?.speaker?.label;
  return (
    <div className="mt-2">
      <button
        type="button"
        onClick={() => setOpen((p) => !p)}
        className="text-[10px] uppercase tracking-wider font-semibold text-text-muted hover:text-text-primary flex items-center gap-1"
      >
        <Quote size={10} /> {open ? 'Hide source' : 'Show source'}
        {seg && <span className="font-mono normal-case tracking-normal">· {fmtTime(seg.start_time)}</span>}
      </button>
      {open && (
        <blockquote className="mt-1.5 border-l-2 border-border-strong pl-3 text-[11px] text-text-secondary italic leading-relaxed">
          {who && <span className="not-italic font-semibold text-text-primary mr-1">{who}:</span>}
          “{evidence}”
        </blockquote>
      )}
    </div>
  );
}

function ConfidenceChip({ confidence }) {
  if (confidence == null || confidence >= 0.75) return null;
  return (
    <span
      className="text-[10px] text-text-muted flex items-center gap-1 bg-surface-hover px-2 py-0.5 rounded border border-border-default"
      title={`Extraction confidence ${Math.round(confidence * 100)}% — please verify`}
    >
      <HelpCircle size={10} /> {Math.round(confidence * 100)}% sure
    </span>
  );
}

function HistoryTab({ meetingId }) {
  const [history, setHistory] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getTranscriptHistory(meetingId)
      .then(({ data }) => setHistory(data || []))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [meetingId]);

  if (loading) {
    return <div className="p-8 text-center text-text-muted text-xs">Loading audit history...</div>;
  }

  if (!history.length) {
    return (
      <EmptyTab
        text="No edits have been made to this transcript yet. Edit any segment in the Transcript tab to record changes."
        icon={History}
      />
    );
  }

  return (
    <div className="space-y-3">
      {history.map((h) => (
        <div key={h.id} className="card p-4 space-y-2 text-xs">
          <div className="flex items-center justify-between text-text-muted">
            <span>
              Edited by <strong className="text-text-primary">{h.edited_by || 'User'}</strong> • {h.speaker_name}
            </span>
            <span className="font-mono">{new Date(h.edited_at).toLocaleString()}</span>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pt-1">
            <div className="p-2.5 rounded bg-semantic-error/5 border border-semantic-error/20 text-text-primary">
              <span className="text-[10px] uppercase font-bold tracking-wider block text-semantic-error mb-1">
                Original text
              </span>
              <p className="line-through text-text-secondary">{h.old_text}</p>
            </div>
            <div className="p-2.5 rounded bg-semantic-success/5 border border-semantic-success/20 text-text-primary">
              <span className="text-[10px] uppercase font-bold tracking-wider block text-semantic-success mb-1">
                Revised text
              </span>
              <p>{h.new_text}</p>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

function TopicsTab({ topics }) {
  if (!topics?.length) return <EmptyTab text="No topics extracted yet." icon={Tag} />;
  return (
    <div className="space-y-3">
      {topics.map((t, idx) => (
        <div key={t.id} className="card p-4 space-y-2">
          <div className="flex items-start justify-between gap-3">
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-1 flex-wrap">
                <span className="text-[10px] font-mono text-text-muted bg-surface-hover px-1.5 py-0.5 rounded border border-border-default">
                  #{idx + 1}
                </span>
                <h3 className="font-semibold text-text-primary text-sm">{t.title}</h3>
                {t.is_recurring && (
                  <span className="badge badge-warning text-[10px]">
                    <RepeatIcon size={10} /> Recurring Topic
                  </span>
                )}
              </div>
              {t.summary && (
                <p className="text-text-secondary text-xs leading-relaxed border-l-2 border-border-strong pl-3 mt-2">
                  {t.summary}
                </p>
              )}
            </div>
            <Tag size={15} className="text-text-muted shrink-0 mt-1" />
          </div>
        </div>
      ))}
    </div>
  );
}

function ActionItemsTab({ items = [], onToggle, onAdd, onDelete, segmentsByIndex }) {
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
      <div className="flex items-center justify-between gap-4 p-3 card">
        <div className="flex items-center gap-3 text-xs text-text-secondary">
          <span>{items.length} Total</span>
          <span>•</span>
          <span className="font-semibold text-text-primary">{pending.length} Pending</span>
          <span>•</span>
          <span>{resolved.length} Resolved</span>
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
        <form onSubmit={handleSubmit} className="card p-4 space-y-3 bg-surface-hover">
          <p className="text-xs font-bold text-text-primary uppercase tracking-wider">New Action Item</p>
          <div>
            <input
              type="text"
              required
              placeholder="Task description (e.g. Prepare API endpoints for integration)..."
              value={desc}
              onChange={(e) => setDesc(e.target.value)}
              className="input text-xs"
              autoFocus
            />
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
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
                className="input text-xs"
              >
                <option value="critical">Critical (P0 / Immediate)</option>
                <option value="high">High (Priority)</option>
                <option value="medium">Medium (Normal)</option>
                <option value="low">Low (Backlog)</option>
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
        <EmptyTab text="No action items identified yet. Click 'Add Action Item' to manually create one." icon={CheckSquare} />
      ) : (
        [...sorted, ...resolved].map((item) => (
          <div
            key={item.id}
            className={`card p-4 transition-all relative ${
              item.resolved ? 'opacity-50' : ''
            }`}
          >
            <div className="flex items-start gap-3">
              {/* Checkbox */}
              <button
                onClick={() => onToggle(item)}
                className={`mt-0.5 w-5 h-5 rounded border flex items-center justify-center shrink-0 transition-colors ${
                  item.resolved
                    ? 'border-semantic-success bg-semantic-success text-canvas'
                    : 'border-border-strong hover:border-text-primary bg-surface'
                }`}
                title={item.resolved ? 'Mark pending' : 'Mark completed'}
              >
                {item.resolved && <Check size={12} strokeWidth={3} className="text-white" />}
              </button>

              <div className="flex-1 min-w-0 pr-8">
                <p className={`text-xs sm:text-sm leading-relaxed ${
                  item.resolved ? 'line-through text-text-muted' : 'text-text-primary'
                }`}>
                  {item.description}
                </p>
                <div className="flex items-center gap-2.5 mt-2 flex-wrap">
                  <UrgencyBadge urgency={item.urgency} />
                  <span className="text-text-secondary text-xs flex items-center gap-1 bg-surface-hover px-2 py-0.5 rounded border border-border-default">
                    <User size={10} />
                    {item.owner
                      ? <strong className="text-text-primary">{item.owner}</strong>
                      : <span className="text-text-muted">Unassigned</span>}
                  </span>
                  {item.due && (
                    <span className="text-text-secondary text-xs flex items-center gap-1 bg-surface-hover px-2 py-0.5 rounded border border-border-default">
                      <Clock size={10} /> {item.due}
                    </span>
                  )}
                  <ConfidenceChip confidence={item.confidence} />
                  {item.resolved && (
                    <span className="text-semantic-success text-[10px] uppercase font-bold tracking-wider">
                      Resolved
                    </span>
                  )}
                </div>
                <EvidenceQuote evidence={item.evidence} segmentIndex={item.segment_index} segmentsByIndex={segmentsByIndex} />
              </div>

              {/* Delete button */}
              <button
                onClick={() => onDelete(item.id)}
                className="absolute top-3.5 right-3.5 text-text-muted hover:text-semantic-error transition-colors p-1 rounded"
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

function DecisionsTab({ decisions = [], onAdd, onDelete, segmentsByIndex }) {
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
      <div className="flex items-center justify-between gap-4 p-3 card">
        <span className="text-xs text-text-secondary">{decisions.length} recorded decision{decisions.length !== 1 ? 's' : ''}</span>
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
        <form onSubmit={handleSubmit} className="card p-4 space-y-3 bg-surface-hover">
          <p className="text-xs font-bold text-text-primary uppercase tracking-wider">Record Decision</p>
          <textarea
            required
            rows={2}
            placeholder="Decision details (e.g. Approved database migration schedule for Q3)..."
            value={desc}
            onChange={(e) => setDesc(e.target.value)}
            className="input text-xs"
            autoFocus
          />
          <div className="flex justify-end gap-2 pt-1">
            <button type="button" onClick={() => setShowForm(false)} className="btn-ghost text-xs py-1.5 px-3">
              Cancel
            </button>
            <button type="submit" className="btn-primary text-xs py-1.5 px-4">
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
          <div key={d.id} className="card p-4 relative group">
            <div className="flex items-start gap-3">
              <div className="w-6 h-6 rounded bg-surface-hover border border-border-default flex items-center justify-center shrink-0 mt-0.5">
                <span className="text-[10px] font-bold text-text-primary">{idx + 1}</span>
              </div>
              <div className="flex-1 pr-8">
                <p className="text-xs sm:text-sm text-text-primary leading-relaxed">{d.description}</p>
                {d.rationale && (
                  <p className="text-text-secondary text-xs mt-1.5 leading-relaxed">
                    <span className="font-semibold text-text-primary">Why:</span> {d.rationale}
                  </p>
                )}
                <div className="flex items-center gap-2.5 mt-1.5 flex-wrap">
                  <p className="text-text-muted text-[11px] flex items-center gap-1">
                    <Gavel size={11} />
                    Recorded • {d.decided_on ? new Date(d.decided_on).toLocaleDateString() : 'Today'}
                  </p>
                  <ConfidenceChip confidence={d.confidence} />
                </div>
                <EvidenceQuote evidence={d.evidence} segmentIndex={d.segment_index} segmentsByIndex={segmentsByIndex} />
              </div>
              <button
                onClick={() => onDelete(d.id)}
                className="absolute top-3.5 right-3.5 text-text-muted hover:text-semantic-error transition-colors p-1 rounded"
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

/** Clean Markdown renderer */
function MarkdownRenderer({ text }) {
  const lines = text.split('\n');
  return (
    <div className="space-y-2 text-sm leading-relaxed text-text-primary">
      {lines.map((line, i) => {
        if (/^### /.test(line)) {
          return <h3 key={i} className="font-bold text-xs uppercase tracking-wider text-text-secondary mt-4 mb-1">{line.replace(/^### /, '')}</h3>;
        }
        if (/^## /.test(line)) {
          return <h2 key={i} className="font-bold text-base text-text-primary mt-5 mb-1">{line.replace(/^## /, '')}</h2>;
        }
        if (/^# /.test(line)) {
          return <h1 key={i} className="font-extrabold text-lg text-text-primary mt-5 mb-1">{line.replace(/^# /, '')}</h1>;
        }
        if (/^---/.test(line)) {
          return <hr key={i} className="border-border-subtle my-3" />;
        }
        if (/^> /.test(line)) {
          return <blockquote key={i} className="border-l-2 border-border-strong pl-3 text-text-secondary italic text-xs my-1">{line.replace(/^> /, '')}</blockquote>;
        }
        if (/^[•\-] /.test(line)) {
          const content = line.replace(/^[•\-] /, '').replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>').replace(/\*([^*]+)\*/g, '<em>$1</em>').replace(/`([^`]+)`/g, '<code class="bg-surface-hover px-1 rounded text-xs">$1</code>');
          return (
            <div key={i} className="flex gap-2 text-text-secondary text-xs sm:text-sm py-0.5">
              <span className="text-text-primary shrink-0">•</span>
              <span dangerouslySetInnerHTML={{ __html: content }} />
            </div>
          );
        }
        if (/^\d+\. /.test(line)) {
          const num = line.match(/^(\d+)\. /)?.[1];
          const content = line.replace(/^\d+\. /, '').replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>').replace(/\*([^*]+)\*/g, '<em>$1</em>');
          return (
            <div key={i} className="flex gap-2 text-text-secondary text-xs sm:text-sm py-0.5">
              <span className="text-text-primary font-mono shrink-0">{num}.</span>
              <span dangerouslySetInnerHTML={{ __html: content }} />
            </div>
          );
        }
        if (!line.trim()) return <div key={i} className="h-1" />;
        const html = line
          .replace(/\*\*([^*]+)\*\*/g, '<strong class="text-text-primary font-semibold">$1</strong>')
          .replace(/\*([^*]+)\*/g, '<em class="text-text-secondary">$1</em>')
          .replace(/`([^`]+)`/g, '<code class="bg-surface-hover px-1 rounded text-xs font-mono text-text-primary border border-border-default">$1</code>');
        return <p key={i} className="text-text-secondary text-xs sm:text-sm" dangerouslySetInnerHTML={{ __html: html }} />;
      })}
    </div>
  );
}

function SummaryTab({ summary, summaryType, processing }) {
  if (!summary) {
    return (
      <EmptyTab
        text={processing
          ? 'The transcript is streaming in on the Transcript tab. The summary, decisions and action items are generated as soon as transcription finishes.'
          : 'Summary will appear here once the intelligence pipeline completes processing.'}
        icon={processing ? Radio : FileText}
      />
    );
  }
  const typeLabel =
    summaryType === 'brief' ? 'Brief Summary' :
    summaryType === 'comprehensive' ? 'Comprehensive Summary' :
    'Balanced Overview';

  return (
    <div className="card p-6 space-y-4">
      <div className="flex items-center justify-between pb-3 border-b border-border-subtle">
        <h3 className="text-xs font-bold text-text-primary uppercase tracking-wider flex items-center gap-2">
          <Sparkles size={14} /> Meeting Summary &amp; Key Takeaways
        </h3>
        <span className="badge badge-brand text-[10px] uppercase font-semibold">
          {typeLabel}
        </span>
      </div>
      <div>
        <MarkdownRenderer text={summary} />
      </div>
    </div>
  );
}

/** Phase 6 — documents generated from the context store (no re-processing). */
const REPORT_KINDS = [
  { format: 'docx', label: 'Minutes of Meeting', sub: 'Word document (.docx)', icon: FileText },
  { format: 'pptx', label: 'Slide deck',         sub: 'PowerPoint (.pptx)',    icon: Presentation },
  { format: 'md',   label: 'Markdown minutes',   sub: 'Plain text (.md)',      icon: FileDown },
];

function ReportsTab({ meetingId, ready }) {
  const [reports, setReports] = useState([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(null);           // format being generated
  const [withTranscript, setWithTranscript] = useState(true);
  const [error, setError] = useState(null);

  const load = () => {
    listReports(meetingId)
      .then(({ data }) => setReports(data || []))
      .catch(() => {})
      .finally(() => setLoading(false));
  };
  useEffect(load, [meetingId]);

  const handleGenerate = async (format) => {
    setBusy(format); setError(null);
    try {
      const { data } = await generateReport(meetingId, format, withTranscript);
      setReports((prev) => [data, ...prev]);
      await downloadReport(data.id, data.file_path?.split(/[\\/]/).pop());
    } catch (err) {
      setError(err.response?.data?.detail || 'Could not generate the report.');
    } finally {
      setBusy(null);
    }
  };

  const handleDelete = async (id) => {
    try {
      await deleteReport(id);
      setReports((prev) => prev.filter((r) => r.id !== id));
    } catch { /* ignore */ }
  };

  const fileName = (r) => (r.file_path || '').split(/[\\/]/).pop() || `${r.format} report`;

  return (
    <div className="space-y-4">
      {!ready && (
        <div className="card p-3 text-xs text-text-secondary flex items-center gap-2">
          <Clock size={13} /> Reports become available once processing has finished.
        </div>
      )}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        {REPORT_KINDS.map(({ format, label, sub, icon: Icon }) => (
          <button
            key={format}
            disabled={!ready || !!busy}
            onClick={() => handleGenerate(format)}
            className="card p-4 text-left hover:border-border-strong transition-colors disabled:opacity-50"
          >
            <div className="flex items-center gap-2 mb-1">
              {busy === format ? <Loader size={15} className="animate-spin" /> : <Icon size={15} className="text-text-primary" />}
              <span className="text-sm font-semibold text-text-primary">{label}</span>
            </div>
            <p className="text-[11px] text-text-muted">{sub}</p>
            <p className="text-[11px] text-text-secondary mt-2 flex items-center gap-1"><Download size={11} /> Generate &amp; download</p>
          </button>
        ))}
      </div>
      <label className="flex items-center gap-2 text-xs text-text-secondary">
        <input type="checkbox" checked={withTranscript} onChange={(e) => setWithTranscript(e.target.checked)} />
        Append the full transcript (Word / Markdown)
      </label>
      {error && <p className="text-xs text-semantic-error">{error}</p>}

      <div className="card divide-y divide-border-subtle">
        <div className="px-4 py-2.5 text-[10px] uppercase tracking-wider font-semibold text-text-muted">
          Generated reports {loading ? '' : `(${reports.length})`}
        </div>
        {loading ? (
          <div className="p-6 text-center text-xs text-text-muted">Loading…</div>
        ) : reports.length === 0 ? (
          <div className="p-6 text-center text-xs text-text-muted">No reports generated yet.</div>
        ) : (
          reports.map((r) => (
            <div key={r.id} className="px-4 py-3 flex items-center gap-3 text-xs">
              <span className="badge badge-gray uppercase text-[10px] w-12 justify-center">{r.format}</span>
              <span className="flex-1 min-w-0 truncate text-text-primary">{fileName(r)}</span>
              <span className="text-text-muted font-mono hidden sm:inline">{new Date(r.generated_on).toLocaleString()}</span>
              <button onClick={() => downloadReport(r.id, fileName(r))} className="btn-icon p-1.5" title="Download">
                <Download size={13} />
              </button>
              <button onClick={() => handleDelete(r.id)} className="btn-icon p-1.5 text-text-muted hover:text-semantic-error" title="Delete">
                <Trash2 size={13} />
              </button>
            </div>
          ))
        )}
      </div>
    </div>
  );
}

function EmptyTab({ text, icon: Icon }) {
  return (
    <div className="empty-state py-12">
      {Icon && <Icon size={24} className="text-text-muted" />}
      <p className="text-text-secondary text-xs max-w-sm">{text}</p>
    </div>
  );
}

const TABS = [
  { key: 'summary',    label: 'Summary',          icon: Sparkles,      count: null },
  { key: 'transcript', label: 'Transcript',        icon: MessageSquare, count: null },
  { key: 'topics',     label: 'Topics',            icon: Tag,           countKey: 'topics' },
  { key: 'actions',    label: 'Actions',           icon: CheckSquare,   countKey: 'action_items' },
  { key: 'decisions',  label: 'Decisions',         icon: Gavel,         countKey: 'decisions' },
  { key: 'reports',    label: 'Reports',           icon: FileDown,      count: null },
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

  // Deletion modal state
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [isDeleting, setIsDeleting]       = useState(false);
  const [deleteError, setDeleteError]     = useState(null);

  const handleDeleteMeeting = async () => {
    setIsDeleting(true);
    setDeleteError(null);
    try {
      await deleteMeeting(id);
      navigate('/meetings', { replace: true });
    } catch (err) {
      setDeleteError(err.response?.data?.detail || 'Failed to delete meeting. Please try again.');
    } finally {
      setIsDeleting(false);
    }
  };

  const [autoTabbed, setAutoTabbed] = useState(false);

  const refreshTranscript = async () => {
    try {
      const tRes = await getTranscript(id);
      setSegments(tRes.data || []);
    } catch { /* ignore */ }
  };

  useStatusSocket(
    meeting && meeting.status !== 'done' && meeting.status !== 'error' ? id : null,
    (event) => {
      switch (event.type) {
        case 'segments':
          // Lines arrive while Whisper is still running — append them straight away.
          setSegments((prev) => {
            const seen = new Set(prev.map((s) => s.id));
            const fresh = (event.segments || []).filter((s) => !seen.has(s.id));
            if (!fresh.length) return prev;
            return [...prev, ...fresh].sort((a, b) => a.segment_index - b.segment_index);
          });
          if (event.progress != null) setWsStatus((prev) => ({ ...(prev || {}), progress: event.progress }));
          break;
        case 'transcript_ready':
          // Diarization finished → speaker labels changed on existing lines.
          refreshTranscript();
          break;
        case 'context_ready':
          loadAll();
          break;
        case 'status':
          setWsStatus(event);
          if (event.status === 'done' || event.status === 'error') loadAll();
          break;
        default:
          break;
      }
    }
  );

  const loadAll = async () => {
    try {
      const [mRes, tRes] = await Promise.all([getMeeting(id), getTranscript(id)]);
      setMeeting(mRes.data);
      setSegments(tRes.data || []);

      if (mRes.data.status === 'done') {
        try {
          const cRes = await getContext(id);
          setContext(cRes.data);
        } catch { /* ignore */ }
      }
    } catch {
      setError('Meeting record not found or server is unreachable.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { loadAll(); }, [id]);

  // While the recording is still being transcribed, show the transcript tab
  // so the user sees lines appearing instead of an empty summary.
  useEffect(() => {
    if (!autoTabbed && meeting && (meeting.status === 'transcribing' || meeting.status === 'queued')) {
      setTab('transcript');
      setAutoTabbed(true);
    }
  }, [meeting, autoTabbed]);

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
      <div className="page-wrapper py-24 flex flex-col items-center justify-center gap-2 text-text-muted">
        <Loader size={20} className="animate-spin text-text-primary" />
        <span className="text-xs">Loading meeting intelligence...</span>
      </div>
    );
  }

  if (error) {
    return (
      <div className="page-wrapper py-16 text-center">
        <AlertCircle size={32} className="text-semantic-error mx-auto mb-3" />
        <p className="text-sm text-semantic-error">{error}</p>
        <button onClick={() => navigate('/meetings')} className="btn-secondary mt-4 mx-auto text-xs">
          Back to Meetings
        </button>
      </div>
    );
  }

  const currentStatus = wsStatus?.status || meeting.status;
  const isProcessing = currentStatus !== 'done' && currentStatus !== 'error';
  const isTranscribing = currentStatus === 'transcribing' || currentStatus === 'queued';
  const segmentsByIndex = Object.fromEntries(segments.map((s) => [s.segment_index, s]));

  return (
    <div className="page-wrapper space-y-6">
      {/* Back button */}
      <button onClick={() => navigate('/meetings')} className="btn-ghost text-xs pl-0">
        <ArrowLeft size={13} /> Back to Meetings
      </button>

      {/* Live Processing Pipeline Card (if in progress) */}
      {currentStatus !== 'done' && (
        <ProcessingStatus status={currentStatus} message={wsStatus?.message} progress={wsStatus?.progress} />
      )}

      {/* Meeting Header Card */}
      <div className="card p-5 space-y-3">
        <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
          <div className="flex-1 min-w-0 space-y-1.5">
            <div className="flex items-center gap-2 flex-wrap">
              <h1 className="text-lg sm:text-xl font-bold text-text-primary tracking-tight">{meeting.title}</h1>
              <StatusBadge status={currentStatus} />
              {meeting.source === 'live' && (
                <span className="badge badge-gray text-[10px] flex items-center gap-1" title="Recorded live from the microphone">
                  <Mic size={10} /> Live
                </span>
              )}
            </div>

            <div className="flex items-center gap-3 text-xs text-text-muted flex-wrap">
              <span className="flex items-center gap-1">
                <Calendar size={11} />
                {fmtDate(meeting.date)}
              </span>
              {meeting.summary_type && (
                <>
                  <span>•</span>
                  <span className="capitalize">{meeting.summary_type} summary</span>
                </>
              )}
            </div>

            {context && (
              <div className="flex items-center gap-3 pt-1 text-xs text-text-secondary flex-wrap">
                {context.topics?.length > 0 && (
                  <span className="flex items-center gap-1">
                    <Tag size={10} /> {context.topics.length} topics
                  </span>
                )}
                {context.action_items?.length > 0 && (
                  <span className="flex items-center gap-1">
                    <CheckSquare size={10} />
                    {context.action_items.filter(a => !a.resolved).length} open actions
                  </span>
                )}
                {context.decisions?.length > 0 && (
                  <span className="flex items-center gap-1">
                    <Gavel size={10} /> {context.decisions.length} decisions
                  </span>
                )}
              </div>
            )}
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <button onClick={loadAll} className="btn-icon p-2" title="Refresh intelligence">
              <RefreshCw size={15} className="text-text-secondary hover:text-text-primary" />
            </button>

            <button
              onClick={() => setConfirmDelete(true)}
              className="btn-secondary text-xs text-semantic-error border-semantic-error/30 hover:bg-semantic-error/10 hover:border-semantic-error/50 font-bold px-3 py-1.5 flex items-center gap-1.5"
              title="Delete meeting"
            >
              <Trash2 size={14} />
              <span>Delete</span>
            </button>
          </div>
        </div>
      </div>

      {/* Delete Confirmation Modal */}
      <DeleteConfirmModal
        isOpen={confirmDelete}
        title={`Delete "${meeting.title}"?`}
        message="This meeting and all its associated transcripts, reports, speakers, and action items will be permanently removed from your CMIS workspace."
        confirmText="Delete Meeting"
        loading={isDeleting}
        error={deleteError}
        onConfirm={handleDeleteMeeting}
        onClose={() => {
          if (!isDeleting) {
            setConfirmDelete(false);
            setDeleteError(null);
          }
        }}
      />

      {/* Tabs */}
      <div className="tab-bar">
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
                <span className="text-[9px] font-bold px-1.5 py-0.2 rounded-full bg-surface-hover text-text-primary border border-border-default">
                  {count}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* Tab Content */}
      <div>
        {tab === 'summary'    && <SummaryTab summary={context?.summary} summaryType={context?.summary_type || meeting?.summary_type} processing={isProcessing} />}
        {tab === 'transcript' && (
          isTranscribing
            ? <LiveTranscript segments={segments} live progress={wsStatus?.progress} maxHeight="60vh" />
            : <TranscriptTab meetingId={id} segments={segments} onSegmentUpdated={handleSegmentUpdated} />
        )}
        {tab === 'history'   && <HistoryTab meetingId={id} />}
        {tab === 'reports'   && <ReportsTab meetingId={id} ready={currentStatus === 'done'} />}
        {tab === 'topics'    && <TopicsTab topics={context?.topics} />}
        {tab === 'actions'   && (
          <ActionItemsTab
            items={context?.action_items}
            onToggle={handleToggleAction}
            onAdd={handleAddAction}
            onDelete={handleDeleteAction}
            segmentsByIndex={segmentsByIndex}
          />
        )}
        {tab === 'decisions' && (
          <DecisionsTab
            decisions={context?.decisions}
            onAdd={handleAddDecision}
            onDelete={handleDeleteDecision}
            segmentsByIndex={segmentsByIndex}
          />
        )}
      </div>
    </div>
  );
}
