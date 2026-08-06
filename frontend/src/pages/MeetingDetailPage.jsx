/**
 * MeetingDetailPage.jsx
 *
 * Shows full detail for one meeting:
 *  • Live processing pipeline (WebSocket) while status != done
 *  • Tabbed view: Transcript | Topics | Action Items | Decisions
 *  • Speaker colour coding across transcript
 */
import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  ArrowLeft, Loader, RefreshCw, MessageSquare, Tag,
  CheckSquare, Gavel, User, Clock, RepeatIcon, AlertTriangle,
} from 'lucide-react';
import { getMeeting, getTranscript, getContext, patchActionItem } from '../api';
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

// 8 distinct colours for speaker labels
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

function TranscriptTab({ segments }) {
  // Build speaker → colour index map
  const speakerMap = {};
  let colIdx = 0;
  segments.forEach((s) => {
    const lbl = s.speaker?.label || 'SPEAKER_00';
    if (!(lbl in speakerMap)) speakerMap[lbl] = colIdx++ % SPEAKER_COLORS.length;
  });

  if (!segments.length) {
    return (
      <div className="glass p-10 text-center text-white/30 text-sm">
        No transcript segments yet.
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {segments.map((seg) => {
        const lbl = seg.speaker?.label || 'SPEAKER_00';
        const name = seg.speaker?.name || lbl;
        const colorCls = SPEAKER_COLORS[speakerMap[lbl]];
        return (
          <div key={seg.id} className="flex gap-3 group animate-fade-in">
            {/* Timestamp */}
            <span className="text-white/20 text-xs font-mono pt-1 w-10 shrink-0">
              {fmtTime(seg.start_time)}
            </span>

            {/* Speaker pill */}
            <span className={`badge ${colorCls} shrink-0 self-start mt-0.5 text-[10px]`}>
              {name}
            </span>

            {/* Text */}
            <p className="text-white/80 text-sm leading-relaxed">{seg.text}</p>
          </div>
        );
      })}
    </div>
  );
}

function TopicsTab({ topics }) {
  if (!topics?.length) {
    return <EmptyTab text="No topics extracted yet." />;
  }
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
          className={`card p-4 flex items-start gap-3 animate-fade-in transition-opacity
            ${item.resolved ? 'opacity-50' : ''}`}
        >
          <button
            onClick={() => onToggle(item)}
            className={`mt-0.5 w-5 h-5 rounded-full border-2 flex items-center justify-center shrink-0
              transition-all duration-200
              ${item.resolved
                ? 'border-emerald-500 bg-emerald-500/20 text-emerald-400'
                : 'border-white/20 hover:border-brand-400'}`}
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
  return (
    <div className="glass p-10 text-center text-white/30 text-sm">{text}</div>
  );
}

// ── Tabs config ───────────────────────────────────────────────────────────────

const TABS = [
  { key: 'transcript', label: 'Transcript',   icon: MessageSquare },
  { key: 'topics',     label: 'Topics',        icon: Tag           },
  { key: 'actions',    label: 'Action Items',  icon: CheckSquare   },
  { key: 'decisions',  label: 'Decisions',     icon: Gavel         },
];

// ── Main Page ─────────────────────────────────────────────────────────────────

export default function MeetingDetailPage() {
  const { id }     = useParams();
  const navigate   = useNavigate();

  const [meeting,   setMeeting]   = useState(null);
  const [segments,  setSegments]  = useState([]);
  const [context,   setContext]   = useState(null);
  const [wsStatus,  setWsStatus]  = useState(null);
  const [tab,       setTab]       = useState('transcript');
  const [loading,   setLoading]   = useState(true);
  const [error,     setError]     = useState(null);

  // Track processing via WebSocket while not done
  useStatusSocket(
    meeting && meeting.status !== 'done' ? id : null,
    (event) => {
      if (event.status === 'ping') return;
      setWsStatus(event);
      // Reload data when pipeline finishes
      if (event.status === 'done') loadAll();
    },
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
        } catch {
          // Context may not be ready yet — not fatal
        }
      }
    } catch {
      setError('Meeting not found or backend unavailable.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { loadAll(); }, [id]);

  const handleToggleAction = async (item) => {
    // Optimistic update
    setContext((prev) => ({
      ...prev,
      action_items: prev.action_items.map((a) =>
        a.id === item.id ? { ...a, resolved: !a.resolved } : a
      ),
    }));
    try {
      await patchActionItem(item.id, { resolved: !item.resolved });
    } catch {
      // Revert on failure
      setContext((prev) => ({
        ...prev,
        action_items: prev.action_items.map((a) =>
          a.id === item.id ? { ...a, resolved: item.resolved } : a
        ),
      }));
    }
  };

  const isProcessing = meeting && !['done', 'error'].includes(meeting.status);

  // ── Render ──────────────────────────────────────────────────────────────────
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

      {/* Back + header */}
      <button
        onClick={() => navigate('/meetings')}
        className="btn-secondary mb-6 text-xs"
      >
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

      {/* Stats row */}
      {context && (
        <div className="grid grid-cols-3 gap-3 mb-6">
          {[
            { label: 'Topics',       val: context.topics.length,       color: 'text-brand-400' },
            { label: 'Action Items', val: context.action_items.length, color: 'text-amber-400' },
            { label: 'Decisions',    val: context.decisions.length,    color: 'text-purple-400' },
          ].map(({ label, val, color }) => (
            <div key={label} className="card p-4 text-center">
              <p className={`text-2xl font-bold ${color}`}>{val}</p>
              <p className="text-white/30 text-xs mt-0.5">{label}</p>
            </div>
          ))}
        </div>
      )}

      {/* Processing pipeline (while running) */}
      {isProcessing && (
        <div className="mb-6">
          <ProcessingStatus
            status={wsStatus?.status || meeting.status}
            message={wsStatus?.message}
          />
        </div>
      )}

      {/* Tabs */}
      <div className="flex gap-1 mb-5 bg-surface-50 rounded-xl p-1 border border-white/5">
        {TABS.map(({ key, label, icon: Icon }) => (
          <button
            key={key}
            onClick={() => setTab(key)}
            className={`flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg text-xs font-medium transition-all duration-200
              ${tab === key
                ? 'bg-brand-600/20 text-brand-300 shadow'
                : 'text-white/30 hover:text-white/60'}`}
          >
            <Icon size={13} />
            <span className="hidden sm:inline">{label}</span>
            {/* Count pills */}
            {key === 'actions' && context && (
              <span className="ml-1 bg-amber-500/20 text-amber-300 text-[9px] px-1.5 py-0.5 rounded-full">
                {context.action_items.filter((a) => !a.resolved).length}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* Tab panels */}
      <div>
        {tab === 'transcript' && <TranscriptTab segments={segments} />}
        {tab === 'topics'     && <TopicsTab topics={context?.topics} />}
        {tab === 'actions'    && (
          <ActionItemsTab
            items={context?.action_items}
            onToggle={handleToggleAction}
          />
        )}
        {tab === 'decisions'  && <DecisionsTab decisions={context?.decisions} />}
      </div>
    </div>
  );
}
