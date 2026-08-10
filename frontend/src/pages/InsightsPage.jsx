/**
 * InsightsPage.jsx
 *
 * Cross-meeting intelligence dashboard:
 *  • Recurring topics detected by MinHash/LSH
 *  • Action item breakdown and completion overview
 *  • High-urgency flagged items
 *  • Strict Enterprise Monochrome UI
 */
import { useEffect, useState } from 'react';
import {
  TrendingUp, RefreshCw, Loader, RepeatIcon,
  Tag, AlertCircle, BarChart2, ShieldAlert, Cpu
} from 'lucide-react';
import { getRecurringTopics, getOverdueItems } from '../api';
import CrossIntelligence from '../components/CrossIntelligence';

function StatBar({ label, value, max, colorClass }) {
  const pct = max ? Math.round((value / max) * 100) : 0;
  return (
    <div className="space-y-1.5">
      <div className="flex justify-between text-xs text-text-secondary">
        <span>{label}</span>
        <span className="font-semibold text-text-primary">{value}</span>
      </div>
      <div className="progress-track">
        <div
          className={`h-full rounded-full transition-all duration-500 ${colorClass || 'bg-text-primary'}`}
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
}

function RecurringTopicCard({ topic }) {
  return (
    <div className="card card-hover p-4 space-y-2">
      <div className="flex items-start gap-3">
        <div className="w-8 h-8 rounded-lg bg-surface-hover border border-border-default flex items-center justify-center text-text-primary shrink-0 mt-0.5">
          <RepeatIcon size={14} />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <h3 className="font-semibold text-text-primary text-sm truncate">{topic.title}</h3>
            <span className="badge badge-warning text-[10px]">
              Recurring
            </span>
          </div>
          {topic.summary && (
            <p className="text-text-secondary text-xs leading-relaxed mt-1 line-clamp-2">
              {topic.summary}
            </p>
          )}
          {topic.previous_topic_id && (
            <p className="text-text-muted text-[10px] mt-1.5 flex items-center gap-1">
              <Tag size={9} /> Linked to earlier discussion thread
            </p>
          )}
        </div>
      </div>
    </div>
  );
}

function HighUrgencyCard({ item }) {
  return (
    <div className="card p-3 flex items-start gap-2.5 bg-semantic-error/5 border-semantic-error/20">
      <ShieldAlert size={14} className="text-semantic-error shrink-0 mt-0.5" />
      <p className="text-xs text-text-primary leading-relaxed line-clamp-2">{item.description}</p>
    </div>
  );
}

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
      setRecurring(rRes.data || []);
      setOverdue(oRes.data || { open_action_items: [], count: 0 });
    } catch {
      setError('Could not load insights from backend server.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const allItems      = overdue.open_action_items || [];
  const highItems     = allItems.filter((i) => i.urgency === 'high' || i.urgency === 'critical');
  const openCount     = allItems.filter((i) => !i.resolved).length;
  const resolvedCount = allItems.filter((i) => i.resolved).length;
  const totalCount    = allItems.length;

  return (
    <div className="page-wrapper-wide space-y-6">

      {/* ── Header ── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="page-title text-2xl font-extrabold">Cross-Meeting Intelligence &amp; Insights</h1>
          <p className="page-subtitle text-xs">
            Synthesized recurring topics, action item workload, and critical tasks across meetings.
          </p>
        </div>

        <button
          onClick={load}
          disabled={loading}
          className="btn-icon"
          title="Refresh insights"
        >
          <RefreshCw size={15} className={loading ? 'animate-spin' : ''} />
        </button>
      </div>

      {/* ── State Views ── */}
      {loading ? (
        <div className="flex flex-col items-center justify-center py-24 gap-2 text-text-muted">
          <Loader size={20} className="animate-spin text-text-primary" />
          <span className="text-xs">Analyzing cross-meeting patterns...</span>
        </div>
      ) : error ? (
        <div className="card p-4 border-semantic-error/30 bg-semantic-error/5 text-semantic-error text-xs flex items-center gap-2.5">
          <AlertCircle size={16} className="shrink-0" />
          <span>{error}</span>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

          {/* ── Left column: Recurring topics / Cross Intelligence ──────────────── */}
          <div className="lg:col-span-2 space-y-4">
            <CrossIntelligence items={recurring} title="Cross-Meeting Discussion Intelligence" />
          </div>

          {/* ── Right column: Action Item Breakdown & Differentiator ──────── */}
          <div className="space-y-5">

            {/* Action item overview */}
            <div className="card p-5 space-y-4">
              <h2 className="text-xs font-bold text-text-primary uppercase tracking-wider flex items-center gap-2">
                <BarChart2 size={14} /> Action Item Status
              </h2>

              <StatBar
                label="Open Tasks"
                value={openCount}
                max={totalCount || 1}
                colorClass="bg-semantic-warning"
              />
              <StatBar
                label="Resolved Tasks"
                value={resolvedCount}
                max={totalCount || 1}
                colorClass="bg-semantic-success"
              />
              <StatBar
                label="High / Critical Urgency"
                value={highItems.length}
                max={totalCount || 1}
                colorClass="bg-semantic-error"
              />

              <div className="pt-3 border-t border-border-subtle flex justify-between text-xs text-text-secondary">
                <span>Total tracked tasks</span>
                <span className="font-bold text-text-primary">{totalCount}</span>
              </div>
            </div>

            {/* High urgency open items */}
            {highItems.length > 0 && (
              <div className="space-y-2.5">
                <h2 className="text-xs font-bold text-text-primary uppercase tracking-wider flex items-center gap-1.5">
                  <ShieldAlert size={13} className="text-semantic-error" /> High-Urgency Items
                </h2>
                {highItems.slice(0, 5).map((item) => (
                  <HighUrgencyCard key={item.id} item={item} />
                ))}
              </div>
            )}

            {/* Technical note */}
            <div className="card p-4 space-y-1.5 bg-surface-hover border-border-subtle">
              <div className="flex items-center gap-1.5 text-text-primary text-xs font-semibold">
                <Cpu size={13} />
                <span>MinHash LSH Intelligence</span>
              </div>
              <p className="text-text-secondary text-[11px] leading-relaxed">
                CMIS evaluates Jaccard similarity across meeting transcripts using locality-sensitive hashing, automatically linking repeating discussion threads and tracking project evolution over time.
              </p>
            </div>

          </div>
        </div>
      )}
    </div>
  );
}
