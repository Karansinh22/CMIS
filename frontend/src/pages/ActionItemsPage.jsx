/**
 * ActionItemsPage.jsx
 *
 * Cross-meeting action items tracker:
 *  • Filter by urgency / status (open | resolved | all)
 *  • Inline resolve / reopen toggle
 *  • Live count stats at the top
 *  • Strict Enterprise Monochrome UI
 */
import { useEffect, useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  CheckSquare, RefreshCw, Loader,
  User, ExternalLink, Filter, Trash2, Check, AlertCircle
} from 'lucide-react';
import { getOpenActionItems, patchActionItem, deleteActionItem } from '../api';
import UrgencyBadge from '../components/UrgencyBadge';

const URGENCY_ORDER = { critical: 0, high: 1, medium: 2, low: 3 };

function sortByUrgency(items) {
  return [...items].sort(
    (a, b) => (URGENCY_ORDER[a.urgency] ?? 3) - (URGENCY_ORDER[b.urgency] ?? 3)
  );
}

export default function ActionItemsPage() {
  const navigate  = useNavigate();
  const [items,   setItems]   = useState([]);
  const [loading, setLoading] = useState(true);
  const [error,   setError]   = useState(null);
  const [filter,  setFilter]  = useState('open');      // open | resolved | all
  const [urgFilt, setUrgFilt] = useState('all');       // all | critical | high | medium | low
  const [toggling, setToggling] = useState(new Set());

  const load = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await getOpenActionItems();
      setItems(res.data || []);
    } catch {
      setError('Could not load action items from backend.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const filtered = useMemo(() => {
    let list = items;
    if (filter === 'open')     list = list.filter((i) => !i.resolved);
    if (filter === 'resolved') list = list.filter((i) =>  i.resolved);
    if (urgFilt !== 'all')     list = list.filter((i) => i.urgency === urgFilt);
    return sortByUrgency(list);
  }, [items, filter, urgFilt]);

  const stats = useMemo(() => ({
    total:    items.length,
    open:     items.filter((i) => !i.resolved).length,
    high:     items.filter((i) => !i.resolved && (i.urgency === 'high' || i.urgency === 'critical')).length,
    resolved: items.filter((i) =>  i.resolved).length,
  }), [items]);

  const handleToggle = async (item) => {
    setToggling((s) => new Set(s).add(item.id));
    // Optimistic update
    setItems((prev) =>
      prev.map((a) => a.id === item.id ? { ...a, resolved: !a.resolved } : a)
    );
    try {
      await patchActionItem(item.id, { resolved: !item.resolved });
    } catch {
      // Revert
      setItems((prev) =>
        prev.map((a) => a.id === item.id ? { ...a, resolved: item.resolved } : a)
      );
    } finally {
      setToggling((s) => { const n = new Set(s); n.delete(item.id); return n; });
    }
  };

  const handleDelete = async (itemId) => {
    try {
      await deleteActionItem(itemId);
      setItems((prev) => prev.filter((a) => a.id !== itemId));
    } catch {
      /* ignore */
    }
  };

  return (
    <div className="page-wrapper space-y-6">

      {/* ── Header ── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="page-title text-2xl font-extrabold">Action Item Tracker</h1>
          <p className="page-subtitle text-xs">
            Cross-meeting commitments, task assignments, and completion tracking.
          </p>
        </div>

        <button
          onClick={load}
          disabled={loading}
          className="btn-icon"
          title="Refresh action items"
        >
          <RefreshCw size={15} className={loading ? 'animate-spin' : ''} />
        </button>
      </div>

      {/* ── Stats Strip ── */}
      {!loading && !error && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <div className="stat-card p-3">
            <span className="stat-label text-[10px]">Total Extracted</span>
            <span className="stat-value text-xl">{stats.total}</span>
          </div>
          <div className="stat-card p-3">
            <span className="stat-label text-[10px]">Open Tasks</span>
            <span className="stat-value text-xl text-semantic-warning">{stats.open}</span>
          </div>
          <div className="stat-card p-3">
            <span className="stat-label text-[10px]">High / Critical</span>
            <span className="stat-value text-xl text-semantic-error">{stats.high}</span>
          </div>
          <div className="stat-card p-3">
            <span className="stat-label text-[10px]">Resolved</span>
            <span className="stat-value text-xl text-semantic-success">{stats.resolved}</span>
          </div>
        </div>
      )}

      {/* ── Filter Controls ── */}
      <div className="flex flex-wrap items-center gap-2">
        <div className="flex items-center gap-1 text-text-muted text-xs mr-1">
          <Filter size={13} />
          <span>Status:</span>
        </div>

        {['open', 'resolved', 'all'].map((f) => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={`px-3 py-1 rounded-md text-xs font-medium capitalize transition-colors ${
              filter === f
                ? 'bg-surface-active text-text-primary border border-border-default font-semibold'
                : 'text-text-secondary hover:text-text-primary hover:bg-surface-hover border border-transparent'
            }`}
          >
            {f}
          </button>
        ))}

        <div className="w-px h-4 bg-border-subtle mx-1 hidden sm:block" />

        <div className="flex items-center gap-1 text-text-muted text-xs mr-1">
          <span>Urgency:</span>
        </div>

        {['all', 'critical', 'high', 'medium', 'low'].map((u) => (
          <button
            key={u}
            onClick={() => setUrgFilt(u)}
            className={`px-2.5 py-1 rounded-md text-xs font-medium capitalize transition-colors ${
              urgFilt === u
                ? 'bg-surface-active text-text-primary border border-border-default font-semibold'
                : 'text-text-secondary hover:text-text-primary hover:bg-surface-hover border border-transparent'
            }`}
          >
            {u === 'all' ? 'All Urgency' : u}
          </button>
        ))}
      </div>

      {/* ── State Views ── */}
      {loading ? (
        <div className="flex flex-col items-center justify-center py-20 gap-2 text-text-muted">
          <Loader size={20} className="animate-spin text-text-primary" />
          <span className="text-xs">Loading action items...</span>
        </div>
      ) : error ? (
        <div className="card p-4 border-semantic-error/30 bg-semantic-error/5 text-semantic-error text-xs flex items-center gap-2.5">
          <AlertCircle size={16} className="shrink-0" />
          <span>{error}</span>
        </div>
      ) : filtered.length === 0 ? (
        <div className="empty-state py-16">
          <div className="w-12 h-12 rounded-lg bg-surface border border-border-default flex items-center justify-center text-text-muted mb-1">
            <CheckSquare size={20} />
          </div>
          <p className="text-sm font-semibold text-text-primary">
            {filter === 'open' ? 'All action items are completed' : 'No items match your filter criteria'}
          </p>
          <p className="text-xs text-text-secondary max-w-sm">
            {filter === 'open'
              ? 'Great job! There are currently no pending tasks requiring action.'
              : 'Try clearing the active status or urgency filter.'}
          </p>
        </div>
      ) : (
        /* ── Items List ── */
        <ul className="space-y-2.5">
          {filtered.map((item) => (
            <li
              key={item.id}
              className={`card p-4 flex items-start gap-3 relative group transition-opacity duration-200 ${
                item.resolved ? 'opacity-50' : ''
              }`}
            >
              {/* Checkbox Toggle Button */}
              <button
                onClick={() => handleToggle(item)}
                disabled={toggling.has(item.id)}
                className={`mt-0.5 w-5 h-5 rounded border flex items-center justify-center shrink-0 transition-colors ${
                  item.resolved
                    ? 'border-semantic-success bg-semantic-success text-canvas'
                    : 'border-border-strong hover:border-text-primary bg-surface'
                }`}
                title={item.resolved ? 'Mark pending' : 'Mark completed'}
              >
                {toggling.has(item.id) ? (
                  <Loader size={10} className="animate-spin text-text-primary" />
                ) : item.resolved ? (
                  <Check size={12} strokeWidth={3} className="text-white" />
                ) : null}
              </button>

              {/* Content */}
              <div className="flex-1 min-w-0 pr-8">
                <p className={`text-xs sm:text-sm leading-relaxed ${
                  item.resolved ? 'line-through text-text-muted' : 'text-text-primary'
                }`}>
                  {item.description}
                </p>

                <div className="flex flex-wrap items-center gap-2.5 mt-2">
                  <UrgencyBadge urgency={item.urgency} />
                  {item.owner && (
                    <span className="text-text-secondary text-xs flex items-center gap-1 bg-surface-hover px-2 py-0.5 rounded border border-border-default">
                      <User size={10} />
                      <strong className="text-text-primary">{item.owner}</strong>
                    </span>
                  )}
                  {item.meeting_id && (
                    <button
                      onClick={() => navigate(`/meetings/${item.meeting_id}`)}
                      className="text-text-muted hover:text-text-primary text-xs flex items-center gap-1 transition-colors"
                    >
                      <ExternalLink size={10} />
                      <span>View meeting</span>
                    </button>
                  )}
                </div>
              </div>

              {/* Delete item */}
              <button
                onClick={() => handleDelete(item.id)}
                className="absolute top-3.5 right-3.5 text-text-muted hover:text-semantic-error transition-colors p-1 rounded"
                title="Delete action item"
              >
                <Trash2 size={14} />
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
