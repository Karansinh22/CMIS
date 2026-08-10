/**
 * MeetingsPage.jsx — Searchable, filterable list of meeting intelligence records.
 * Monochrome styling with high-contrast active states, delete functionality, and confirmation modal.
 */
import { useEffect, useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Search, Calendar, ArrowRight, RefreshCw, Loader, Mic,
  Upload, AlertCircle, X, Trash2
} from 'lucide-react';
import { listMeetings, deleteMeeting } from '../api';
import StatusBadge from '../components/StatusBadge';
import DeleteConfirmModal from '../components/DeleteConfirmModal';

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

  // Deletion modal state
  const [deletingMeeting, setDeletingMeeting] = useState(null); // Meeting object to delete
  const [isDeleting, setIsDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState(null);

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

  const handleDeleteConfirm = async () => {
    if (!deletingMeeting) return;
    setIsDeleting(true);
    setDeleteError(null);

    try {
      await deleteMeeting(deletingMeeting.id);
      setMeetings((prev) => prev.filter((m) => m.id !== deletingMeeting.id));
      setDeletingMeeting(null);
    } catch (err) {
      setDeleteError(err.response?.data?.detail || 'Failed to delete meeting. Please try again.');
    } finally {
      setIsDeleting(false);
    }
  };

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
    <div className="page-wrapper-wide space-y-6 py-6">

      {/* ── Page Header ── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="page-title text-2xl sm:text-3xl font-extrabold font-display">Meeting Intelligence Records</h1>
          <p className="page-subtitle text-sm text-text-secondary mt-1">
            Review, search, and manage all transcribed audio sessions and structured reports.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={load}
            disabled={loading}
            className="btn-icon"
            title="Refresh list"
          >
            <RefreshCw size={16} className={loading ? 'animate-spin' : ''} />
          </button>
          <button
            onClick={() => navigate('/upload')}
            className="btn-primary text-sm py-2.5 px-4 font-bold flex items-center gap-2"
          >
            <Upload size={16} />
            <span>Upload Recording</span>
          </button>
        </div>
      </div>

      {/* ── Statistics Summary Strip ── */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <div className="stat-card p-4">
          <span className="stat-label text-xs">Total Recorded</span>
          <span className="stat-value text-2xl font-extrabold">{stats.total}</span>
        </div>
        <div className="stat-card p-4">
          <span className="stat-label text-xs">Completed</span>
          <span className="stat-value text-2xl font-extrabold">{stats.done}</span>
        </div>
        <div className="stat-card p-4">
          <span className="stat-label text-xs">In Progress</span>
          <span className="stat-value text-2xl font-extrabold">{stats.processing}</span>
        </div>
        <div className="stat-card p-4">
          <span className="stat-label text-xs font-semibold">Errors</span>
          <span className="stat-value text-2xl font-extrabold">{stats.error}</span>
        </div>
      </div>

      {/* ── Search & Filter Controls ── */}
      <div className="flex flex-col md:flex-row items-stretch md:items-center gap-3">
        {/* Search Input */}
        <div className="relative flex-1">
          <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-text-muted pointer-events-none" />
          <input
            type="text"
            className="input pl-10 text-sm h-11"
            placeholder="Search meetings by title or keywords..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
          {query && (
            <button
              onClick={() => setQuery('')}
              className="absolute right-3.5 top-1/2 -translate-y-1/2 text-text-muted hover:text-text-primary p-1"
            >
              <X size={14} />
            </button>
          )}
        </div>

        {/* Filter Pills */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 md:pb-0">
          {STATUS_FILTERS.map((f) => (
            <button
              key={f.id}
              onClick={() => setFilter(f.id)}
              className={`px-3.5 py-2 rounded-xl text-xs font-bold whitespace-nowrap transition-colors ${
                filter === f.id
                  ? 'bg-surface-active text-text-primary border border-border-default'
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
        <div className="flex flex-col items-center justify-center py-20 gap-3 text-text-muted">
          <Loader size={24} className="animate-spin text-text-primary" />
          <span className="text-sm font-medium">Loading meeting records...</span>
        </div>
      ) : error ? (
        <div className="card p-5 border-semantic-error/30 bg-semantic-error/5 text-semantic-error text-sm flex items-center gap-3 rounded-xl">
          <AlertCircle size={18} className="shrink-0" />
          <span>{error}</span>
        </div>
      ) : filtered.length === 0 ? (
        <div className="empty-state py-16 text-center space-y-3">
          <div className="w-14 h-14 rounded-2xl bg-surface border border-border-default flex items-center justify-center text-text-muted mx-auto">
            <Mic size={24} />
          </div>
          <p className="text-base font-bold text-text-primary">No meetings found</p>
          <p className="text-xs sm:text-sm text-text-secondary max-w-sm mx-auto">
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
              <Upload size={14} />
              <span>Upload First Recording</span>
            </button>
          )}
        </div>
      ) : (
        /* ── Meetings List ── */
        <div className="space-y-3">
          {filtered.map((m) => (
            <div
              key={m.id}
              className="card card-hover p-4 sm:p-5 flex items-center justify-between group transition-all"
            >
              {/* Left Content (Navigates to detail) */}
              <div
                onClick={() => navigate(`/meetings/${m.id}`)}
                className="flex items-center gap-4 min-w-0 flex-1 pr-4 cursor-pointer"
              >
                <div className="w-11 h-11 rounded-xl bg-surface-hover border border-border-default flex items-center justify-center text-text-primary shrink-0 group-hover:scale-105 transition-transform">
                  <Mic size={20} />
                </div>

                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2.5 flex-wrap">
                    <h3 className="text-base font-bold text-text-primary truncate group-hover:underline font-display">
                      {m.title}
                    </h3>
                    {m.summary_type && m.status === 'done' && (
                      <span className="badge badge-gray text-[10px] uppercase tracking-wider font-mono">
                        {m.summary_type}
                      </span>
                    )}
                  </div>

                  <div className="flex items-center gap-3.5 text-xs text-text-muted mt-1 flex-wrap">
                    <span className="flex items-center gap-1.5">
                      <Calendar size={13} />
                      {fmtRelative(m.date)}
                    </span>
                    {m.duration_seconds && (
                      <span>• {Math.round(m.duration_seconds / 60)} min audio</span>
                    )}
                  </div>
                </div>
              </div>

              {/* Right Controls: Status badge, Delete button, Arrow */}
              <div className="flex items-center gap-3 shrink-0">
                <StatusBadge status={m.status} />

                {/* Delete Button */}
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    setDeletingMeeting(m);
                  }}
                  className="p-2 rounded-lg text-text-muted hover:text-semantic-error hover:bg-semantic-error/10 transition-colors"
                  title={`Delete ${m.title}`}
                  aria-label={`Delete meeting ${m.title}`}
                >
                  <Trash2 size={16} />
                </button>

                <div
                  onClick={() => navigate(`/meetings/${m.id}`)}
                  className="cursor-pointer p-1"
                >
                  <ArrowRight size={16} className="text-text-muted group-hover:text-text-primary group-hover:translate-x-1 transition-all" />
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Delete Confirmation Modal */}
      <DeleteConfirmModal
        isOpen={Boolean(deletingMeeting)}
        title={`Delete "${deletingMeeting?.title}"?`}
        message="This meeting and all its associated transcripts, reports, speakers, and action items will be permanently removed from your CMIS workspace."
        confirmText="Delete Meeting"
        loading={isDeleting}
        error={deleteError}
        onConfirm={handleDeleteConfirm}
        onClose={() => {
          if (!isDeleting) {
            setDeletingMeeting(null);
            setDeleteError(null);
          }
        }}
      />

    </div>
  );
}
