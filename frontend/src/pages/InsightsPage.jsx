/**
 * InsightsPage.jsx
 *
 * Cross-meeting intelligence dashboard:
 *  • Recurring topics detected by MinHash/LSH
 *  • Open vs resolved action item split (simple bar chart via CSS)
 *  • Overdue / high-urgency items at a glance
 */
import { useEffect, useState } from 'react';
import {
  TrendingUp, RefreshCw, Loader, RepeatIcon,
  Tag, AlertTriangle, BarChart2, Zap,
} from 'lucide-react';
import { getRecurringTopics, getOverdueItems } from '../api';

// ── Mini bar chart ────────────────────────────────────────────────────────────

function StatBar({ label, value, max, color }) {
  const pct = max ? Math.round((value / max) * 100) : 0;
  return (
    <div className="space-y-1">
      <div className="flex justify-between text-xs text-white/40">
        <span>{label}</span>
        <span className="font-semibold text-white">{value}</span>
      </div>
      <div className="h-2 rounded-full bg-white/5 overflow-hidden">
        <div
          className={`h-full rounded-full transition-all duration-700 ${color}`}
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
}

// ── Recurring topic card ──────────────────────────────────────────────────────

function RecurringTopicCard({ topic }) {
  return (
    <div className="card card-hover p-4 animate-fade-in">
      <div className="flex items-start gap-3">
        <div className="w-9 h-9 rounded-xl bg-yellow-500/10 border border-yellow-500/20 flex items-center justify-center shrink-0">
          <RepeatIcon size={15} className="text-yellow-400" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <h3 className="font-semibold text-white text-sm truncate">{topic.title}</h3>
            <span className="badge badge-yellow text-[10px]">Recurring</span>
          </div>
          {topic.summary && (
            <p className="text-white/40 text-xs leading-relaxed mt-1 line-clamp-2">
              {topic.summary}
            </p>
          )}
          {topic.previous_topic_id && (
            <p className="text-brand-400/50 text-[10px] mt-1.5 flex items-center gap-1">
              <Tag size={9} /> Linked to earlier occurrence
            </p>
          )}
        </div>
      </div>
    </div>
  );
}

// ── High-urgency item card ────────────────────────────────────────────────────

function HighUrgencyCard({ item }) {
  return (
    <div className="card p-3 flex items-start gap-2 border-red-500/10 animate-fade-in">
      <Zap size={13} className="text-red-400 shrink-0 mt-0.5" />
      <p className="text-sm text-white/70 leading-relaxed line-clamp-2">{item.description}</p>
    </div>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────

export default function InsightsPage() {
  const [recurring, setRecurring] = useState([]);
  const [overdue,   setOverdue]   = useState({ open_action_items: [], count: 0 });
  const [loading,   setLoading]   = useState(true);
  const [error,     setError]     = useState(null);

  const load = async () => {
    setLoading(true);
    setError(null);
    try {
      const [rRes, oRes] = await Promise.all([
        getRecurringTopics(),
        getOverdueItems(),
      ]);
      setRecurring(rRes.data);
      setOverdue(oRes.data);
    } catch {
      setError('Could not load insights. Is the backend running?');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const allItems   = overdue.open_action_items || [];
  const highItems  = allItems.filter((i) => i.urgency === 'high');
  const openCount  = allItems.filter((i) => !i.resolved).length;
  const resolvedCount = allItems.filter((i) => i.resolved).length;
  const totalCount = allItems.length;

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <div className="max-w-4xl mx-auto py-10 px-4 animate-slide-up">

      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-purple-500/10 border border-purple-500/20 text-purple-300 text-xs font-semibold mb-2">
            <TrendingUp size={12} /> Cross-Meeting Intelligence
          </div>
          <h1 className="text-3xl font-bold text-white">Insights</h1>
          <p className="text-white/40 text-sm mt-1">
            Patterns and recurring topics detected across all your meetings.
          </p>
        </div>
        <button onClick={load} className="btn-icon">
          <RefreshCw size={15} className={loading ? 'animate-spin-slow text-brand-400' : 'text-white/40'} />
        </button>
      </div>

      {loading && (
        <div className="flex items-center justify-center py-24 text-white/30 gap-2">
          <Loader size={20} className="animate-spin" /> Loading insights…
        </div>
      )}

      {error && (
        <div className="glass p-6 border-red-500/20 text-red-400 text-sm text-center">
          <AlertTriangle size={20} className="mx-auto mb-2" />
          {error}
        </div>
      )}

      {!loading && !error && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

          {/* ── Left column: Recurring topics ─────────────────────────────── */}
          <div className="lg:col-span-2 space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-white font-semibold flex items-center gap-2">
                <RepeatIcon size={16} className="text-yellow-400" />
                Recurring Topics
                <span className="badge badge-yellow ml-1">{recurring.length}</span>
              </h2>
            </div>

            {recurring.length === 0 ? (
              <div className="glass p-10 text-center">
                <RepeatIcon size={28} className="text-white/10 mx-auto mb-3" />
                <p className="text-white/30 text-sm">No recurring topics yet.</p>
                <p className="text-white/20 text-xs mt-1">
                  Upload a second related meeting to start seeing cross-meeting patterns.
                </p>
              </div>
            ) : (
              <div className="space-y-2">
                {recurring.map((t) => (
                  <RecurringTopicCard key={t.id} topic={t} />
                ))}
              </div>
            )}
          </div>

          {/* ── Right column: Stats + high-urgency ───────────────────────── */}
          <div className="space-y-5">

            {/* Action item breakdown */}
            <div className="card p-5 space-y-4">
              <h2 className="text-white font-semibold flex items-center gap-2 text-sm">
                <BarChart2 size={15} className="text-brand-400" /> Action Item Overview
              </h2>
              <StatBar
                label="Open"
                value={openCount}
                max={totalCount}
                color="bg-amber-500"
              />
              <StatBar
                label="Resolved"
                value={resolvedCount}
                max={totalCount}
                color="bg-emerald-500"
              />
              <StatBar
                label="⚡ High urgency"
                value={highItems.length}
                max={totalCount}
                color="bg-red-500"
              />

              <div className="divider pt-1" />
              <div className="flex justify-between text-xs text-white/30">
                <span>Total action items</span>
                <span className="font-bold text-white">{totalCount}</span>
              </div>
            </div>

            {/* High urgency open items */}
            {highItems.length > 0 && (
              <div className="space-y-2">
                <h2 className="text-white/60 text-xs font-semibold flex items-center gap-1.5">
                  <Zap size={12} className="text-red-400" /> High-Urgency Items
                </h2>
                {highItems.slice(0, 5).map((item) => (
                  <HighUrgencyCard key={item.id} item={item} />
                ))}
                {highItems.length > 5 && (
                  <p className="text-white/25 text-xs text-center">
                    +{highItems.length - 5} more — see Action Items
                  </p>
                )}
              </div>
            )}

            {/* Differentiator note */}
            <div className="glass p-4 border-brand-500/10">
              <p className="text-white/30 text-[11px] leading-relaxed">
                <span className="text-brand-400 font-semibold">Why CMIS is different:</span>{' '}
                Recurring topic detection uses MinHash/LSH to flag discussion threads
                that have appeared across multiple meetings — something no other
                tool tracks automatically.
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
