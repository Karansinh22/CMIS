/**
 * HomePage.jsx — Executive Intelligence Dashboard.
 * Strict professional monochrome design with high-contrast hierarchy.
 */
import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Upload, FolderKanban, CheckSquare,
  ArrowRight, Cpu, Layers, Mic, Calendar, ChevronRight,
  Zap, ListOrdered
} from 'lucide-react';
import { listMeetings, listProjects, getOpenActionItems } from '../api';
import StatusBadge from '../components/StatusBadge';

export default function HomePage() {
  const navigate = useNavigate();
  const [meetings, setMeetings]     = useState([]);
  const [projects, setProjects]     = useState([]);
  const [actionItems, setActionItems] = useState([]);
  const [loading, setLoading]       = useState(true);

  useEffect(() => {
    Promise.all([
      listMeetings().catch(() => ({ data: [] })),
      listProjects().catch(() => ({ data: [] })),
      getOpenActionItems().catch(() => ({ data: [] })),
    ]).then(([mRes, pRes, aRes]) => {
      setMeetings(mRes.data || []);
      setProjects(pRes.data || []);
      setActionItems(aRes.data || []);
      setLoading(false);
    });
  }, []);

  const doneMeetings = meetings.filter((m) => m.status === 'done');
  const pendingActions = actionItems.filter((a) => !a.resolved);

  return (
    <div className="page-wrapper-wide space-y-8">

      {/* ── Executive Header Banner ── */}
      <div className="card p-6 sm:p-8 space-y-4">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="space-y-2 max-w-2xl">
            <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded bg-surface-hover border border-border-default text-text-primary text-[11px] font-semibold">
              <Cpu size={12} className="text-text-primary" />
              <span>Contextual Meeting Intelligence</span>
            </div>
            <h1 className="page-title text-3xl font-extrabold">
              Executive Meeting Intelligence &amp; Action Hub
            </h1>
            <p className="text-sm text-text-secondary leading-relaxed">
              CMIS automatically transcribes spoken audio, generates executive summaries, tracks assigned action items, and organizes multi-session workspaces.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2.5 shrink-0">
            <button
              onClick={() => navigate('/upload')}
              className="btn-primary text-xs py-2.5 px-4"
            >
              <Upload size={14} />
              <span>Upload Recording</span>
            </button>
            <button
              onClick={() => navigate('/meetings')}
              className="btn-secondary text-xs py-2.5 px-4"
            >
              <ListOrdered size={14} />
              <span>View Meetings</span>
            </button>
          </div>
        </div>
      </div>

      {/* ── Key Analytics Strip ── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          {
            label: 'Total Meetings',
            val: meetings.length,
            sub: `${doneMeetings.length} processed`,
            icon: Mic,
          },
          {
            label: 'Project Workspaces',
            val: projects.length,
            sub: 'Grouped context',
            icon: FolderKanban,
          },
          {
            label: 'Open Action Items',
            val: pendingActions.length,
            sub: `${actionItems.filter((a) => a.resolved).length} completed`,
            icon: CheckSquare,
          },
          {
            label: 'Processing Engine',
            val: 'Operational',
            sub: 'Whisper + NLP Pipeline',
            icon: Cpu,
            isStatus: true,
          },
        ].map((item) => (
          <div key={item.label} className="stat-card">
            <div className="flex items-center justify-between text-text-secondary mb-1">
              <span className="stat-label">{item.label}</span>
              <item.icon size={16} className="text-text-muted" />
            </div>
            {item.isStatus ? (
              <div className="stat-value text-lg flex items-center gap-2 pt-0.5 text-text-primary">
                <span className="w-2 h-2 rounded-full bg-semantic-success" />
                Operational
              </div>
            ) : (
              <p className="stat-value">{item.val}</p>
            )}
            <p className="text-xs text-text-muted mt-1">{item.sub}</p>
          </div>
        ))}
      </div>

      {/* ── Grid: Recent Meetings & Active Projects ── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

        {/* Recent Meetings */}
        <div className="card p-6 space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-base font-bold text-text-primary flex items-center gap-2">
                <Mic size={18} className="text-text-primary" />
                Recent Meeting Recordings
              </h2>
              <p className="text-xs text-text-muted mt-0.5">Latest ingested sessions &amp; intelligence reports</p>
            </div>
            <button
              onClick={() => navigate('/meetings')}
              className="text-xs font-semibold text-text-secondary hover:text-text-primary flex items-center gap-1 transition-colors"
            >
              View All <ArrowRight size={13} />
            </button>
          </div>

          {loading ? (
            <div className="py-12 flex justify-center">
              <div className="w-5 h-5 border-2 border-text-primary border-t-transparent rounded-full animate-spin" />
            </div>
          ) : meetings.length === 0 ? (
            <div className="empty-state py-8">
              <p className="text-xs text-text-secondary">No meetings recorded yet.</p>
              <button onClick={() => navigate('/upload')} className="btn-primary mt-2 text-xs">
                Upload Recording
              </button>
            </div>
          ) : (
            <div className="divide-y divide-border-subtle border border-border-subtle rounded-lg overflow-hidden">
              {meetings.slice(0, 4).map((m) => (
                <div
                  key={m.id}
                  onClick={() => navigate(`/meetings/${m.id}`)}
                  className="p-3.5 flex items-center justify-between hover:bg-surface-hover transition-colors cursor-pointer group"
                >
                  <div className="min-w-0 flex-1 pr-4">
                    <p className="font-semibold text-text-primary text-sm truncate group-hover:underline">
                      {m.title}
                    </p>
                    <p className="text-text-muted text-xs mt-0.5 flex items-center gap-2">
                      <Calendar size={11} />
                      {m.date ? new Date(m.date).toLocaleDateString() : 'Recent'}
                      <span>•</span>
                      <span className="capitalize">{m.summary_type || 'balanced'}</span>
                    </p>
                  </div>
                  <div className="flex items-center gap-3 shrink-0">
                    <StatusBadge status={m.status} />
                    <ChevronRight size={15} className="text-text-muted group-hover:text-text-primary transition-colors" />
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Active Projects */}
        <div className="card p-6 space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-base font-bold text-text-primary flex items-center gap-2">
                <FolderKanban size={18} className="text-text-primary" />
                Project Workspaces
              </h2>
              <p className="text-xs text-text-muted mt-0.5">Cumulative multi-session knowledge hubs</p>
            </div>
            <button
              onClick={() => navigate('/projects')}
              className="text-xs font-semibold text-text-secondary hover:text-text-primary flex items-center gap-1 transition-colors"
            >
              All Projects <ArrowRight size={13} />
            </button>
          </div>

          {loading ? (
            <div className="py-12 flex justify-center">
              <div className="w-5 h-5 border-2 border-text-primary border-t-transparent rounded-full animate-spin" />
            </div>
          ) : projects.length === 0 ? (
            <div className="empty-state py-8">
              <p className="text-xs text-text-secondary">No project workspaces created yet.</p>
              <button onClick={() => navigate('/projects')} className="btn-secondary mt-2 text-xs">
                Create Workspace
              </button>
            </div>
          ) : (
            <div className="divide-y divide-border-subtle border border-border-subtle rounded-lg overflow-hidden">
              {projects.slice(0, 4).map((p) => (
                <div
                  key={p.id}
                  onClick={() => navigate(`/projects/${p.id}`)}
                  className="p-3.5 flex items-center justify-between hover:bg-surface-hover transition-colors cursor-pointer group"
                >
                  <div className="min-w-0 flex-1 pr-4">
                    <div className="flex items-center gap-2">
                      <p className="font-semibold text-text-primary text-sm truncate group-hover:underline">
                        {p.name}
                      </p>
                      {p.category && (
                        <span className="badge badge-gray text-[10px] font-semibold">{p.category}</span>
                      )}
                    </div>
                    <p className="text-text-muted text-xs mt-0.5">
                      {p.company ? `${p.company} • ` : ''}
                      {p.meetings?.length || p.meeting_count || 0} meeting{((p.meetings?.length || p.meeting_count) !== 1) ? 's' : ''}
                    </p>
                  </div>
                  <ChevronRight size={15} className="text-text-muted group-hover:text-text-primary transition-colors shrink-0" />
                </div>
              ))}
            </div>
          )}
        </div>

      </div>

      {/* ── System Capabilities Strip ── */}
      <div className="card p-6 space-y-4">
        <div>
          <h2 className="text-sm font-bold text-text-primary uppercase tracking-wider">
            Platform Capabilities &amp; Architecture
          </h2>
          <p className="text-xs text-text-secondary mt-0.5">End-to-end meeting speech-to-intelligence automation</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-2">
          <div className="p-4 rounded-lg bg-surface-hover border border-border-subtle space-y-2">
            <div className="w-8 h-8 rounded bg-surface border border-border-default flex items-center justify-center text-text-primary">
              <Cpu size={16} />
            </div>
            <h3 className="font-semibold text-text-primary text-sm">Automated Transcription</h3>
            <p className="text-text-secondary text-xs leading-relaxed">
              Whisper speech recognition converts raw audio recordings into timestamped, multi-speaker transcripts.
            </p>
          </div>

          <div className="p-4 rounded-lg bg-surface-hover border border-border-subtle space-y-2">
            <div className="w-8 h-8 rounded bg-surface border border-border-default flex items-center justify-center text-text-primary">
              <Zap size={16} />
            </div>
            <h3 className="font-semibold text-text-primary text-sm">Action &amp; Decision Extraction</h3>
            <p className="text-text-secondary text-xs leading-relaxed">
              NLP structuring models automatically detect key decisions, commitments, urgency, and assignees.
            </p>
          </div>

          <div className="p-4 rounded-lg bg-surface-hover border border-border-subtle space-y-2">
            <div className="w-8 h-8 rounded bg-surface border border-border-default flex items-center justify-center text-text-primary">
              <Layers size={16} />
            </div>
            <h3 className="font-semibold text-text-primary text-sm">Cross-Meeting MinHash LSH</h3>
            <p className="text-text-secondary text-xs leading-relaxed">
              MinHash Locality-Sensitive Hashing identifies recurring discussion threads and patterns across meetings.
            </p>
          </div>
        </div>
      </div>

    </div>
  );
}
