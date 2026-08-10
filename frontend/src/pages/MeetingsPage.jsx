/**
 * MeetingsPage.jsx — Searchable, filterable list of meeting intelligence records.
 * Monochrome styling with high-contrast active states and clean metadata badges.
 */
import { useEffect, useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Search, Calendar, ArrowRight, RefreshCw, Loader, Mic,
  Upload, CheckCircle2, Clock, AlertCircle, X
} from 'lucide-react';
import { listMeetings } from '../api';
import StatusBadge from '../components/StatusBadge';

const STATUS_FILTERS = [
  { id: 'all', label: 'All' },
  { id: 'done', label: 'Completed' },
  { id: 'transcribing', label: 'Transcribing' },
  { id: 'structuring', label: 'Analysing' },
  { id: 'queued', label: 'Queued' },
  { id: 'error', label: 'Error' },
];

function fmtRelative(iso) {
  if (!iso) return 'Unknown date';
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60000);
  const hours = Math.floor(mins / 60);
  const days = Math.floor(hours / 24);
  if (mins < 1) return 'Just now';
  if (mins < 60) return `${mins}m ago`;
  if (hours < 24) return `${hours}h ago`;
  if (days < 7) return `${days}d ago`;
  return new Date(iso).toLocaleDateString('en-IN', {
    day: '2-digit', month: 'short', year: 'numeric'
  });
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
      setMeetings(res.data || []);
    } catch {
      setError('Could not reach the backend API server. Is it running?');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const filtered = useMemo(() => {
    return meetings.filter((m) => {
      const matchesQuery = (m.title || '').toLowerCase().includes(query.toLowerCase());
      const matchesFilter = filter === 'all' || m.status === filter;
      return matchesQuery && matchesFilter;
    });
  }, [meetings, query, filter]);

  const stats = useMemo(() => ({
    total: meetings.length,
    done: meetings.filter(m => m.status === 'done').length,
    processing: meetings.filter(m => ['transcribing', 'structuring', 'queued'].includes(m.status)).length,
    error: meetings.filter(m => m.status === 'error').length,
  }), [meetings]);

  return (
    <div className="page-wrapper-wide space-y-6">

      {/* ── Page Header ── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="page-title text-2xl font-extrabold">Meeting Intelligence Records</h1>
          <p className="page-subtitle text-xs">
            Review, search, and manage all transcribed audio sessions and structured reports.
          </p>
        </div>

        <div className="flex items-center gap-2.5">
          <button
            onClick={load}
            disabled={loading}
            className="btn-icon"
            title="Refresh list"
          >
            <RefreshCw size={15} className={loading ? 'animate-spin' : ''} />
          </button>
          <button
            onClick={() => navigate('/upload')}
            className="btn-primary text-xs py-2 px-3.5"
          >
            <Upload size={14} />
            <span>Upload Recording</span>
          </button>
        </div>
      </div>

      {/* ── Statistics Summary Strip ── */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="stat-card p-3">
          <span className="stat-label text-[10px]">Total Recorded</span>
          <span className="stat-value text-xl">{stats.total}</span>
        </div>
        <div className="stat-card p-3">
          <span className="stat-label text-[10px]">Completed</span>
          <span className="stat-value text-xl">{stats.done}</span>
        </div>
        <div className="stat-card p-3">
          <span className="stat-label text-[10px]">In Progress</span>
          <span className="stat-value text-xl">{stats.processing}</span>
        </div>
        <div className="stat-card p-3">
          <span className="stat-label text-[10px]">Errors</span>
          <span className="stat-value text-xl">{stats.error}</span>
        </div>
      </div>

      {/* ── Search & Filter Controls ── */}
      <div className="flex flex-col md:flex-row items-stretch md:items-center gap-3">
        {/* Search Input */}
        <div className="relative flex-1">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-text-muted pointer-events-none" />
          <input
            type="text"
            className="input pl-9 text-xs h-9"
            placeholder="Search meetings by title or keywords..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
          {query && (
            <button
              onClick={() => setQuery('')}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-text-muted hover:text-text-primary p-0.5"
            >
              <X size={13} />
            </button>
          )}
        </div>

        {/* Filter Pills */}
        <div className="flex items-center gap-1 overflow-x-auto pb-1 md:pb-0">
          {STATUS_FILTERS.map((f) => (
            <button
              key={f.id}
              onClick={() => setFilter(f.id)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium whitespace-nowrap transition-colors ${
                filter === f.id
                  ? 'bg-surface-active text-text-primary border border-border-default font-semibold'
                  : 'text-text-secondary hover:text-text-primary hover:bg-surface-hover border border-transparent'
              }`}
            >
              {f.label}
            </button>
          ))}
        </div>
      </div>

      {/* ── State Views: Loading / Error / Empty / List ── */}
      {loading ? (
        <div className="flex flex-col items-center justify-center py-20 gap-2 text-text-muted">
          <Loader size={20} className="animate-spin text-text-primary" />
          <span className="text-xs">Loading meetings...</span>
        </div>
      ) : error ? (
        <div className="card p-4 border-semantic-error/30 bg-semantic-error/5 text-semantic-error text-xs flex items-center gap-2.5">
          <AlertCircle size={16} className="shrink-0" />
          <span>{error}</span>
        </div>
      ) : filtered.length === 0 ? (
        <div className="empty-state py-16">
          <div className="w-12 h-12 rounded-lg bg-surface border border-border-default flex items-center justify-center text-text-muted mb-1">
            <Mic size={20} />
          </div>
          <p className="text-sm font-semibold text-text-primary">No meetings found</p>
          <p className="text-xs text-text-secondary max-w-sm">
            {query || filter !== 'all'
              ? 'No meeting records match your search or filter criteria.'
              : 'You have not uploaded any meeting audio recordings yet.'}
          </p>
          {query || filter !== 'all' ? (
            <button onClick={() => { setQuery(''); setFilter('all'); }} className="btn-secondary text-xs mt-2">
              Reset Filters
            </button>
          ) : (
            <button onClick={() => navigate('/upload')} className="btn-primary text-xs mt-2">
              <Upload size={13} />
              <span>Upload First Recording</span>
            </button>
          )}
        </div>
      ) : (
        /* ── Meetings List ── */
        <div className="space-y-2.5">
          {filtered.map((m) => (
            <div
              key={m.id}
              onClick={() => navigate(`/meetings/${m.id}`)}
              className="card card-hover p-4 flex items-center justify-between group"
            >
              <div className="flex items-center gap-3.5 min-w-0 flex-1 pr-4">
                <div className="w-9 h-9 rounded-lg bg-surface-hover border border-border-default flex items-center justify-center text-text-primary shrink-0">
                  <Mic size={16} />
                </div>

                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <h3 className="text-sm font-semibold text-text-primary truncate group-hover:underline">
                      {m.title}
                    </h3>
                    {m.summary_type && m.status === 'done' && (
                      <span className="badge badge-gray text-[10px] uppercase tracking-wider">
                        {m.summary_type}
                      </span>
                    )}
                  </div>

                  <div className="flex items-center gap-3 text-xs text-text-muted mt-1 flex-wrap">
                    <span className="flex items-center gap-1">
                      <Calendar size={11} />
                      {fmtRelative(m.date)}
                    </span>
                    {m.duration_seconds && (
                      <span>• {Math.round(m.duration_seconds / 60)} min audio</span>
                    )}
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-4 shrink-0">
                <StatusBadge status={m.status} />
                <ArrowRight size={15} className="text-text-muted group-hover:text-text-primary group-hover:translate-x-0.5 transition-all" />
              </div>
            </div>
          ))}
        </div>
      )}

    </div>
  );
}
