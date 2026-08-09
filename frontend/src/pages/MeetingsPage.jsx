/**
 * MeetingsPage.jsx — Beautiful searchable list of meetings with status,
 * date, summary type badge, filter tabs, and animated cards.
 */
import { useEffect, useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Search, Calendar, ArrowRight, RefreshCw, Loader, Mic2,
  CheckCircle2, Clock3, AlertCircle, Hourglass, Upload, SlidersHorizontal,
} from 'lucide-react';
import { listMeetings } from '../api';
import StatusBadge from '../components/StatusBadge';

const STATUS_FILTERS = ['all', 'done', 'transcribing', 'structuring', 'queued', 'error'];

function fmtDate(iso) {
  return new Date(iso).toLocaleString('en-IN', {
    day: '2-digit', month: 'short', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  });
}

function fmtRelative(iso) {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60000);
  const hours = Math.floor(mins / 60);
  const days = Math.floor(hours / 24);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  if (hours < 24) return `${hours}h ago`;
  if (days < 7) return `${days}d ago`;
  return fmtDate(iso);
}

function StatusIcon({ status }) {
  const map = {
    done:         <CheckCircle2 size={13} className="text-emerald-400" />,
    transcribing: <Clock3 size={13} className="text-blue-400 animate-pulse" />,
    structuring:  <Hourglass size={13} className="text-purple-400 animate-spin-slow" />,
    queued:       <Clock3 size={13} className="text-slate-400" />,
    error:        <AlertCircle size={13} className="text-red-400" />,
  };
  return map[status] || <Mic2 size={13} className="text-white/30" />;
}

function MeetingCard({ meeting, onClick }) {
  const summaryLabel = {
    brief: 'Brief', balanced: 'Balanced', comprehensive: 'Comprehensive',
  }[meeting.summary_type] || 'Balanced';

  const statusGradient = {
    done:         'from-emerald-500/10 to-transparent',
    transcribing: 'from-blue-500/10 to-transparent',
    structuring:  'from-purple-500/10 to-transparent',
    error:        'from-red-500/10 to-transparent',
    queued:       'from-slate-500/5 to-transparent',
  }[meeting.status] || 'from-white/5 to-transparent';

  return (
    <button
      onClick={onClick}
      className="card card-hover w-full text-left flex items-center gap-4 p-4 group gradient-border"
    >
      {/* Icon blob */}
      <div className={`w-11 h-11 rounded-xl bg-gradient-to-br ${statusGradient}
                       border border-white/[0.07] flex items-center justify-center shrink-0
                       group-hover:scale-105 transition-transform duration-200`}>
        <StatusIcon status={meeting.status} />
      </div>

      {/* Content */}
      <div className="flex-1 min-w-0">
        <p className="font-semibold text-white/90 text-sm truncate group-hover:text-white transition-colors">
          {meeting.title}
        </p>
        <div className="flex items-center gap-2 mt-1 flex-wrap">
          <span className="text-white/30 text-[11px] flex items-center gap-1">
            <Calendar size={10} />
            {fmtRelative(meeting.date)}
          </span>
          <StatusBadge status={meeting.status} />
          {meeting.summary_type && meeting.status === 'done' && (
            <span className="badge-gray text-[10px]">{summaryLabel}</span>
          )}
        </div>
      </div>

      <ArrowRight
        size={14}
        className="text-white/20 shrink-0 group-hover:text-brand-400 group-hover:translate-x-1
                   transition-all duration-200"
      />
    </button>
  );
}

function StatPill({ label, value, color }) {
  return (
    <div className={`glass px-3 py-2 flex items-center gap-2 rounded-xl border ${color}`}>
      <span className="text-lg font-bold text-white">{value}</span>
      <span className="text-[11px] text-white/40">{label}</span>
    </div>
  );
}

export default function MeetingsPage() {
  const navigate = useNavigate();
  const [meetings, setMeetings] = useState([]);
  const [loading,  setLoading]  = useState(true);
  const [error,    setError]    = useState(null);
  const [query,    setQuery]    = useState('');
  const [filter,   setFilter]   = useState('all');

  const load = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await listMeetings();
      setMeetings(res.data);
    } catch {
      setError('Could not reach the backend. Is it running on port 8000?');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const filtered = useMemo(() => {
    return meetings.filter((m) => {
      const matchesQuery = m.title.toLowerCase().includes(query.toLowerCase());
      const matchesFilter = filter === 'all' || m.status === filter;
      return matchesQuery && matchesFilter;
    });
  }, [meetings, query, filter]);

  const stats = useMemo(() => ({
    done: meetings.filter(m => m.status === 'done').length,
    processing: meetings.filter(m => ['transcribing', 'structuring', 'queued'].includes(m.status)).length,
    error: meetings.filter(m => m.status === 'error').length,
  }), [meetings]);

  return (
    <div className="page-wrapper">
      {/* ── Header ── */}
      <div className="flex items-start justify-between mb-7">
        <div>
          <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full
                          bg-brand-600/10 border border-brand-500/20 text-brand-300
                          text-[11px] font-semibold mb-2">
            <Mic2 size={10} />
            Meeting Library
          </div>
          <h1 className="page-title">Meetings</h1>
          <p className="page-subtitle">
            {meetings.length} recording{meetings.length !== 1 ? 's' : ''} in context store
          </p>
        </div>
        <button
          onClick={load}
          className="btn-icon"
          title="Refresh"
          disabled={loading}
        >
          <RefreshCw size={14} className={loading ? 'animate-spin text-brand-400' : 'text-white/40'} />
        </button>
      </div>

      {/* ── Stats ── */}
      {meetings.length > 0 && (
        <div className="flex gap-2 mb-5 flex-wrap">
          <StatPill label="Completed" value={stats.done} color="border-emerald-500/20" />
          <StatPill label="Processing" value={stats.processing} color="border-blue-500/20" />
          {stats.error > 0 && (
            <StatPill label="Errors" value={stats.error} color="border-red-500/20" />
          )}
          <StatPill label="Total" value={meetings.length} color="border-white/10" />
        </div>
      )}

      {/* ── Search + Filter ── */}
      <div className="flex gap-2 mb-4">
        <div className="relative flex-1">
          <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-white/25 pointer-events-none" />
          <input
            className="input pl-8 text-sm h-9"
            placeholder="Search meetings by title…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
          {query && (
            <button
              onClick={() => setQuery('')}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-white/25 hover:text-white/60"
            >
              ×
            </button>
          )}
        </div>
        <div className="flex gap-1">
          {STATUS_FILTERS.map((f) => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`px-2.5 py-1.5 rounded-lg text-[11px] font-semibold transition-all capitalize
                          ${filter === f
                            ? 'bg-brand-600/20 text-brand-300 border border-brand-500/25'
                            : 'text-white/35 hover:text-white/60 hover:bg-white/[0.04]'}`}
            >
              {f}
            </button>
          ))}
        </div>
      </div>

      {/* ── States ── */}
      {loading && (
        <div className="flex flex-col items-center justify-center py-20 gap-3 text-white/25">
          <Loader size={20} className="animate-spin text-brand-400" />
          <span className="text-sm">Loading meetings…</span>
        </div>
      )}

      {error && !loading && (
        <div className="glass p-4 border border-red-500/20 bg-red-500/5 text-red-400 text-sm rounded-2xl flex gap-3 items-start">
          <AlertCircle size={16} className="shrink-0 mt-0.5" />
          {error}
        </div>
      )}

      {!loading && !error && filtered.length === 0 && (
        <div className="empty-state animate-fade-in">
          <div className="w-16 h-16 rounded-2xl bg-white/[0.03] border border-white/[0.06]
                          flex items-center justify-center">
            <Mic2 size={24} className="text-white/15" />
          </div>
          <p className="text-white/35 text-sm">
            {query || filter !== 'all'
              ? 'No meetings match your filters.'
              : 'No meetings yet — upload your first recording.'}
          </p>
          {!query && filter === 'all' && (
            <button onClick={() => navigate('/')} className="btn-primary mt-2">
              <Upload size={14} />
              Upload Recording
            </button>
          )}
          {(query || filter !== 'all') && (
            <button onClick={() => { setQuery(''); setFilter('all'); }} className="btn-secondary mt-2">
              Clear Filters
            </button>
          )}
        </div>
      )}

      {!loading && !error && filtered.length > 0 && (
        <div className="space-y-2.5">
          {filtered.map((m, idx) => (
            <div
              key={m.id}
              style={{ animationDelay: `${idx * 40}ms` }}
              className="animate-fade-in"
            >
              <MeetingCard
                meeting={m}
                onClick={() => navigate(`/meetings/${m.id}`)}
              />
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
