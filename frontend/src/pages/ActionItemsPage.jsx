/**
 * ActionItemsPage.jsx
 *
 * Cross-meeting action items tracker:
 *  • Filter by urgency / status (open | resolved | all)
 *  • Inline resolve / reopen toggle
 *  • Live count stats at the top
 */
import { useEffect, useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  CheckSquare, RefreshCw, Loader, AlertTriangle,
  User, ExternalLink, Filter, Trash2,
} from 'lucide-react';
import { getOpenActionItems, patchActionItem, deleteActionItem } from '../api';
import UrgencyBadge from '../components/UrgencyBadge';

// ── Helpers ───────────────────────────────────────────────────────────────────

const URGENCY_ORDER = { high: 0, medium: 1, low: 2 };

function sortByUrgency(items) {
  return [...items].sort(
    (a, b) => URGENCY_ORDER[a.urgency] - URGENCY_ORDER[b.urgency]
  );
}

// ── Main ──────────────────────────────────────────────────────────────────────

export default function ActionItemsPage() {
  const navigate  = useNavigate();
  const [items,   setItems]   = useState([]);
  const [loading, setLoading] = useState(true);
  const [error,   setError]   = useState(null);
  const [filter,  setFilter]  = useState('open');      // open | resolved | all
  const [urgFilt, setUrgFilt] = useState('all');       // all | high | medium | low
  const [toggling, setToggling] = useState(new Set());

  const load = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await getOpenActionItems();
      setItems(res.data);
    } catch {
      setError('Could not load action items. Is the backend running?');
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
    high:     items.filter((i) => !i.resolved && i.urgency === 'high').length,
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

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <div className="max-w-3xl mx-auto py-10 px-4 animate-slide-up">

      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-amber-500/10 border border-amber-500/20 text-amber-300 text-xs font-semibold mb-2">
            <CheckSquare size={12} /> Action Tracker
          </div>
          <h1 className="text-3xl font-bold text-white">Action Items</h1>
          <p className="text-white/40 text-sm mt-1">Cross-meeting task tracker</p>
        </div>
        <button onClick={load} className="btn-icon">
          <RefreshCw size={15} className={loading ? 'animate-spin-slow text-brand-400' : 'text-white/40'} />
        </button>
      </div>

      {/* Stats row */}
      {!loading && !error && (
        <div className="grid grid-cols-4 gap-3 mb-6">
          {[
            { label: 'Total',    val: stats.total,    color: 'text-white' },
            { label: 'Open',     val: stats.open,     color: 'text-amber-400' },
            { label: '⚡ High',   val: stats.high,     color: 'text-red-400' },
            { label: 'Resolved', val: stats.resolved, color: 'text-emerald-400' },
          ].map(({ label, val, color }) => (
            <div key={label} className="card p-3 text-center">
              <p className={`text-xl font-bold ${color}`}>{val}</p>
              <p className="text-white/30 text-[10px] mt-0.5">{label}</p>
            </div>
          ))}
        </div>
      )}

      {/* Filters */}
      <div className="flex flex-wrap gap-2 mb-5">
        <div className="flex items-center gap-1 text-white/30">
          <Filter size={13} />
        </div>
        {/* Status filter */}
        {['open', 'resolved', 'all'].map((f) => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={`px-3 py-1 rounded-lg text-xs font-medium transition-all capitalize
              ${filter === f
                ? 'bg-brand-600/20 text-brand-300 border border-brand-500/20'
                : 'bg-white/5 text-white/40 border border-white/10 hover:text-white/70'}`}
          >
            {f}
          </button>
        ))}
        <div className="w-px bg-white/10 mx-1" />
        {/* Urgency filter */}
        {['all', 'high', 'medium', 'low'].map((u) => (
          <button
            key={u}
            onClick={() => setUrgFilt(u)}
            className={`px-3 py-1 rounded-lg text-xs font-medium transition-all capitalize
              ${urgFilt === u
                ? 'bg-brand-600/20 text-brand-300 border border-brand-500/20'
                : 'bg-white/5 text-white/40 border border-white/10 hover:text-white/70'}`}
          >
            {u === 'all' ? 'All urgency' : u}
          </button>
        ))}
      </div>

      {/* States */}
      {loading && (
        <div className="flex items-center justify-center py-20 text-white/30 gap-2">
          <Loader size={18} className="animate-spin" /> Loading…
        </div>
      )}
      {error && (
        <div className="glass p-5 border-red-500/20 text-red-400 text-sm">{error}</div>
      )}
      {!loading && !error && filtered.length === 0 && (
        <div className="glass p-12 text-center">
          <CheckSquare size={32} className="text-white/10 mx-auto mb-3" />
          <p className="text-white/30 text-sm">
            {filter === 'open'
              ? '🎉 All action items are resolved!'
              : 'No items match the current filters.'}
          </p>
        </div>
      )}

      {/* Items list */}
      {!loading && !error && filtered.length > 0 && (
        <ul className="space-y-2">
          {filtered.map((item) => (
            <li
              key={item.id}
              className={`card p-4 flex items-start gap-3 animate-fade-in transition-opacity duration-300 relative group
                ${item.resolved ? 'opacity-40' : ''}`}
            >
              {/* Toggle button */}
              <button
                onClick={() => handleToggle(item)}
                disabled={toggling.has(item.id)}
                className={`mt-0.5 w-5 h-5 rounded-full border-2 flex items-center justify-center shrink-0
                  transition-all duration-200
                  ${item.resolved
                    ? 'border-emerald-500 bg-emerald-500/20 text-emerald-400'
                    : 'border-white/20 hover:border-brand-400 hover:bg-brand-600/10'}`}
              >
                {toggling.has(item.id)
                  ? <Loader size={10} className="animate-spin text-brand-400" />
                  : item.resolved
                    ? <span className="text-[10px]">✓</span>
                    : null
                }
              </button>

              {/* Content */}
              <div className="flex-1 min-w-0 pr-8">
                <p className={`text-sm leading-relaxed ${item.resolved ? 'line-through text-white/30' : 'text-white/85'}`}>
                  {item.description}
                </p>
                <div className="flex flex-wrap items-center gap-2 mt-2">
                  <UrgencyBadge urgency={item.urgency} />
                  {item.owner && (
                    <span className="text-white/30 text-xs flex items-center gap-1">
                      <User size={10} /> {item.owner}
                    </span>
                  )}
                  {/* Link to meeting */}
                  {item.context_id && (
                    <button
                      onClick={() => navigate('/meetings')}
                      className="text-brand-400/50 hover:text-brand-400 text-xs flex items-center gap-1 transition-colors"
                    >
                      <ExternalLink size={10} /> View meeting
                    </button>
                  )}
                </div>
              </div>

              {/* Delete item */}
              <button
                onClick={() => handleDelete(item.id)}
                className="absolute top-4 right-4 text-white/20 hover:text-red-400 transition-colors p-1 rounded-lg hover:bg-red-500/10"
                title="Delete Action Item"
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
