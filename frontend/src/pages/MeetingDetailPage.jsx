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
import {
  ArrowLeft, Loader, RefreshCw, MessageSquare, Tag,
  CheckSquare, Gavel, User, Clock, RepeatIcon, AlertTriangle, Edit3, Check, X, History
} from 'lucide-react';
import { getMeeting, getTranscript, getContext, patchActionItem, editTranscriptSegment, getTranscriptHistory } from '../api';
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
      {topics.map((t) => (
        <div key={t.id} className="card p-4 animate-fade-in">
          <div className="flex items-start justify-between gap-3">
            <div className="flex-1">
              <div className="flex items-center gap-2 mb-1">
                <h3 className="font-semibold text-white text-sm">{t.title}</h3>
                {t.is_recurring && (
                  <span className="badge badge-yellow">
                    <RepeatIcon size={10} /> Recurring
                  </span>
                )}
              </div>
              {t.summary && (
                <p className="text-white/40 text-xs leading-relaxed">{t.summary}</p>
              )}
            </div>
            <Tag size={14} className="text-brand-400 shrink-0 mt-0.5" />
          </div>
        </div>
      ))}
    </div>
  );
}

function ActionItemsTab({ items, onToggle }) {
  if (!items?.length) return <EmptyTab text="No action items extracted." />;
  return (
    <div className="space-y-2">
      {items.map((item) => (
        <div
          key={item.id}
          className={`card p-4 flex items-start gap-3 animate-fade-in transition-opacity ${item.resolved ? 'opacity-50' : ''}`}
        >
          <button
            onClick={() => onToggle(item)}
            className={`mt-0.5 w-5 h-5 rounded-full border-2 flex items-center justify-center shrink-0 transition-all ${
              item.resolved ? 'border-emerald-500 bg-emerald-500/20 text-emerald-400' : 'border-white/20 hover:border-brand-400'
            }`}
          >
            {item.resolved && <span className="text-[10px]">✓</span>}
          </button>

          <div className="flex-1 min-w-0">
            <p className={`text-sm leading-relaxed ${item.resolved ? 'line-through text-white/30' : 'text-white/80'}`}>
              {item.description}
            </p>
            <div className="flex items-center gap-3 mt-1.5 flex-wrap">
              <UrgencyBadge urgency={item.urgency} />
              {item.owner && (
                <span className="text-white/30 text-xs flex items-center gap-1">
                  <User size={10} /> {item.owner}
                </span>
              )}
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

function DecisionsTab({ decisions }) {
  if (!decisions?.length) return <EmptyTab text="No decisions recorded." />;
  return (
    <div className="space-y-2">
      {decisions.map((d) => (
        <div key={d.id} className="card p-4 flex items-start gap-3 animate-fade-in">
          <Gavel size={14} className="text-purple-400 mt-0.5 shrink-0" />
          <div>
            <p className="text-sm text-white/80 leading-relaxed">{d.description}</p>
            <p className="text-white/25 text-xs mt-1 flex items-center gap-1">
              <Clock size={10} />
              {new Date(d.decided_on).toLocaleDateString('en-IN')}
            </p>
          </div>
        </div>
      ))}
    </div>
  );
}

function EmptyTab({ text }) {
  return <div className="glass p-10 text-center text-white/30 text-sm">{text}</div>;
}

const TABS = [
  { key: 'transcript', label: 'Transcript',        icon: MessageSquare },
  { key: 'history',    label: 'Revision History', icon: History       },
  { key: 'topics',     label: 'Topics',            icon: Tag           },
  { key: 'actions',    label: 'Action Items',      icon: CheckSquare   },
  { key: 'decisions',  label: 'Decisions',         icon: Gavel         },
];

export default function MeetingDetailPage() {
  const { id }   = useParams();
  const navigate = useNavigate();

  const [meeting,  setMeeting]  = useState(null);
  const [segments, setSegments] = useState([]);
  const [context,  setContext]  = useState(null);
  const [wsStatus, setWsStatus] = useState(null);
  const [tab,      setTab]      = useState('transcript');
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
      action_items: prev.action_items.map((a) => (a.id === item.id ? { ...a, resolved: !a.resolved } : a)),
    }));
    try {
      await patchActionItem(item.id, { resolved: !item.resolved });
    } catch {
      setContext((prev) => ({
        ...prev,
        action_items: prev.action_items.map((a) => (a.id === item.id ? { ...a, resolved: item.resolved } : a)),
      }));
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
    <div className="max-w-4xl mx-auto py-10 px-4 animate-slide-up">
      <button onClick={() => navigate('/meetings')} className="btn-secondary mb-6 text-xs">
        <ArrowLeft size={14} /> All Meetings
      </button>

      <div className="flex items-start justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-bold text-white leading-tight">{meeting.title}</h1>
          <p className="text-white/30 text-sm mt-1">{fmtDate(meeting.date)}</p>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <StatusBadge status={wsStatus?.status || meeting.status} />
          <button onClick={loadAll} className="btn-icon">
            <RefreshCw size={14} className="text-white/40" />
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 mb-5 bg-surface-50 rounded-xl p-1 border border-white/5">
        {TABS.map(({ key, label, icon: Icon }) => (
          <button
            key={key}
            onClick={() => setTab(key)}
            className={`flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg text-xs font-medium transition-all ${
              tab === key ? 'bg-brand-600/20 text-brand-300 shadow' : 'text-white/30 hover:text-white/60'
            }`}
          >
            <Icon size={13} />
            <span className="hidden sm:inline">{label}</span>
          </button>
        ))}
      </div>

      {/* Tab Content */}
      <div>
        {tab === 'transcript' && (
          <TranscriptTab meetingId={id} segments={segments} onSegmentUpdated={handleSegmentUpdated} />
        )}
        {tab === 'history'   && <HistoryTab meetingId={id} />}
        {tab === 'topics'    && <TopicsTab topics={context?.topics} />}
        {tab === 'actions'   && <ActionItemsTab items={context?.action_items} onToggle={handleToggleAction} />}
        {tab === 'decisions' && <DecisionsTab decisions={context?.decisions} />}
      </div>
    </div>
  );
}
