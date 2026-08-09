/**
 * HomePage.jsx — Executive Landing Page & Intelligence Dashboard.
 * Fluid micro-interactions via Framer Motion for interactive buttons and cards.
 */
import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import {
  Brain, Upload, FolderKanban, CheckSquare, Sparkles, TrendingUp,
  ArrowRight, ShieldCheck, Cpu, Layers, Mic, Calendar, ChevronRight,
  Gavel, Plus, Zap, CheckCircle2,
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
    <motion.div
      initial={{ opacity: 0, y: 15 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.25, ease: 'easeOut' }}
      className="page-wrapper-wide space-y-10 py-8"
    >

      {/* ── Hero Banner ── */}
      <motion.div
        whileHover={{ scale: 1.002 }}
        transition={{ duration: 0.2 }}
        className="relative rounded-3xl border border-brand-500/20 bg-gradient-aurora p-8 md:p-10 overflow-hidden shadow-card"
      >
        {/* Glow accents */}
        <div className="glow-orb w-96 h-96 bg-brand-500/20 -top-20 -right-20 pointer-events-none" />
        <div className="glow-orb w-64 h-64 bg-accent-cyan/15 bottom-0 left-10 pointer-events-none" />

        <div className="relative z-10 max-w-3xl space-y-5">
          <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-brand-500/15 border border-brand-500/30 text-brand-300 text-xs font-bold tracking-wide">
            <Sparkles size={14} className="text-brand-400" />
            Extractive NLP &amp; Context Intelligence Engine
          </div>

          <h1 className="text-4xl md:text-5xl font-extrabold text-white tracking-tight leading-tight font-display">
            Transform Meeting Noise into <span className="gradient-text">Actionable Intelligence</span>
          </h1>

          <p className="text-white/70 text-base md:text-lg leading-relaxed">
            CMIS automatically transcribes meeting audio, extracts high-value TF-IDF summaries,
            classifies action items with urgency scoring, and groups discussions into connected projects.
          </p>

          <div className="flex items-center gap-3 pt-3 flex-wrap">
            <motion.button
              whileHover={{ scale: 1.03 }}
              whileTap={{ scale: 0.96 }}
              onClick={() => navigate('/upload')}
              className="btn-primary py-3.5 px-6 text-sm shadow-glow-brand font-bold"
            >
              <Upload size={18} />
              Upload Recording
            </motion.button>
            <motion.button
              whileHover={{ scale: 1.03 }}
              whileTap={{ scale: 0.96 }}
              onClick={() => navigate('/projects')}
              className="btn-secondary py-3.5 px-6 text-sm font-bold"
            >
              <FolderKanban size={18} />
              View Projects ({projects.length})
            </motion.button>
            <motion.button
              whileHover={{ scale: 1.03 }}
              whileTap={{ scale: 0.96 }}
              onClick={() => navigate('/actions')}
              className="btn-ghost py-3.5 px-5 text-sm text-white/80 hover:text-white font-semibold"
            >
              <CheckSquare size={18} className="text-emerald-400" />
              Action Items ({pendingActions.length})
            </motion.button>
          </div>
        </div>
      </motion.div>

      {/* ── Key Analytics Bar ── */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { label: 'Total Meetings', val: meetings.length, sub: `${doneMeetings.length} processed`, icon: Mic, color: 'text-brand-400' },
          { label: 'Project Contexts', val: projects.length, sub: 'Cross-meeting grouping', icon: FolderKanban, color: 'text-cyan-400' },
          { label: 'Pending Actions', val: pendingActions.length, sub: 'Requires follow-up', icon: CheckSquare, color: 'text-amber-400' },
          { label: 'Engine Status', val: 'Operational', sub: 'Extractive TF-IDF Engine', icon: Cpu, color: 'text-emerald-400', isStatus: true },
        ].map((item, idx) => (
          <motion.div
            key={item.label}
            whileHover={{ y: -4, scale: 1.01 }}
            transition={{ duration: 0.2 }}
            className="stat-card"
          >
            <div className="flex items-center justify-between text-white/50 mb-1">
              <span className="stat-label">{item.label}</span>
              <item.icon size={18} className={item.color} />
            </div>
            {item.isStatus ? (
              <p className="stat-value text-emerald-400 text-xl flex items-center gap-2 pt-1 font-bold">
                <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-pulse" />
                Operational
              </p>
            ) : (
              <p className="stat-value">{item.val}</p>
            )}
            <p className="text-xs text-white/50 mt-1 font-medium">{item.sub}</p>
          </motion.div>
        ))}
      </div>

      {/* ── Grid: Recent Meetings & Active Projects ── */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">

        {/* Recent Meetings */}
        <div className="glass p-6 rounded-3xl border border-white/10 space-y-4 shadow-card">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-bold text-white flex items-center gap-2 font-display">
              <Mic size={20} className="text-brand-400" />
              Recent Meetings
            </h2>
            <button
              onClick={() => navigate('/meetings')}
              className="text-xs text-brand-300 hover:underline flex items-center gap-1 font-bold"
            >
              View All <ArrowRight size={14} />
            </button>
          </div>

          {meetings.length === 0 ? (
            <div className="empty-state py-8 text-white/40">
              <p className="text-sm">No meetings recorded yet.</p>
              <button onClick={() => navigate('/upload')} className="btn-primary mt-2 text-xs">
                Upload First Meeting
              </button>
            </div>
          ) : (
            <div className="space-y-3">
              {meetings.slice(0, 4).map((m) => (
                <motion.div
                  key={m.id}
                  whileHover={{ x: 3, scale: 1.005 }}
                  whileTap={{ scale: 0.98 }}
                  transition={{ duration: 0.15 }}
                  onClick={() => navigate(`/meetings/${m.id}`)}
                  className="card card-hover p-4 flex items-center justify-between cursor-pointer group"
                >
                  <div className="min-w-0 flex-1">
                    <p className="font-bold text-white text-base truncate group-hover:text-brand-300 transition-colors">
                      {m.title}
                    </p>
                    <p className="text-white/40 text-xs mt-1 flex items-center gap-2">
                      <Calendar size={12} />
                      {new Date(m.date).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}
                      <span className="text-white/20">·</span>
                      <span className="capitalize">{m.summary_type || 'balanced'}</span>
                    </p>
                  </div>
                  <div className="flex items-center gap-3 shrink-0">
                    <StatusBadge status={m.status} />
                    <ChevronRight size={16} className="text-white/30 group-hover:text-brand-300 group-hover:translate-x-0.5 transition-all" />
                  </div>
                </motion.div>
              ))}
            </div>
          )}
        </div>

        {/* Active Projects */}
        <div className="glass p-6 rounded-3xl border border-white/10 space-y-4 shadow-card">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-bold text-white flex items-center gap-2 font-display">
              <FolderKanban size={20} className="text-cyan-400" />
              Project Workspaces
            </h2>
            <button
              onClick={() => navigate('/projects')}
              className="text-xs text-brand-300 hover:underline flex items-center gap-1 font-bold"
            >
              Manage Projects <ArrowRight size={14} />
            </button>
          </div>

          {projects.length === 0 ? (
            <div className="empty-state py-8 text-white/40">
              <p className="text-sm">No projects created yet.</p>
              <button onClick={() => navigate('/projects')} className="btn-secondary mt-2 text-xs">
                Create Project Workspace
              </button>
            </div>
          ) : (
            <div className="space-y-3">
              {projects.slice(0, 4).map((p) => (
                <motion.div
                  key={p.id}
                  whileHover={{ x: 3, scale: 1.005 }}
                  whileTap={{ scale: 0.98 }}
                  transition={{ duration: 0.15 }}
                  onClick={() => navigate(`/projects/${p.id}`)}
                  className="card card-hover p-4 flex items-center justify-between cursor-pointer group"
                >
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <p className="font-bold text-white text-base truncate group-hover:text-cyan-300 transition-colors">
                        {p.name}
                      </p>
                      {p.category && (
                        <span className="badge badge-cyan text-[11px] py-0.5 px-2 font-bold">{p.category}</span>
                      )}
                    </div>
                    <p className="text-white/40 text-xs mt-1">
                      {p.company ? `${p.company} · ` : ''}
                      {p.meetings?.length || 0} meeting{(p.meetings?.length !== 1) ? 's' : ''}
                    </p>
                  </div>
                  <ChevronRight size={16} className="text-white/30 group-hover:text-cyan-300 group-hover:translate-x-0.5 transition-all shrink-0" />
                </motion.div>
              ))}
            </div>
          )}
        </div>

      </div>

      {/* ── Feature Highlights ── */}
      <div className="space-y-5 pt-4">
        <div className="text-center max-w-xl mx-auto space-y-1">
          <h2 className="text-2xl font-bold text-white tracking-tight font-display">Engine Architecture &amp; Capabilities</h2>
          <p className="text-white/50 text-sm">Built with core Extractive NLP principles for high reliability and zero hallucinations.</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
          <motion.div whileHover={{ y: -4 }} transition={{ duration: 0.2 }} className="glass p-6 rounded-3xl border border-white/10 space-y-3 shadow-card">
            <div className="w-11 h-11 rounded-2xl bg-brand-500/15 border border-brand-500/30 flex items-center justify-center text-brand-300">
              <Cpu size={22} />
            </div>
            <h3 className="font-bold text-white text-base font-display">Extractive TF-IDF Engine</h3>
            <p className="text-white/60 text-xs leading-relaxed">
              Calculates informational density across sentences to select key discourse without sentence hallucination.
            </p>
          </motion.div>

          <motion.div whileHover={{ y: -4 }} transition={{ duration: 0.2 }} className="glass p-6 rounded-3xl border border-white/10 space-y-3 shadow-card">
            <div className="w-11 h-11 rounded-2xl bg-purple-500/15 border border-purple-500/30 flex items-center justify-center text-purple-300">
              <Zap size={22} />
            </div>
            <h3 className="font-bold text-white text-base font-display">Weighted Signal Classifier</h3>
            <p className="text-white/60 text-xs leading-relaxed">
              Detects deontic verbs, urgency cues, and commitment markers to classify discourse into Action Items &amp; Decisions.
            </p>
          </motion.div>

          <motion.div whileHover={{ y: -4 }} transition={{ duration: 0.2 }} className="glass p-6 rounded-3xl border border-white/10 space-y-3 shadow-card">
            <div className="w-11 h-11 rounded-2xl bg-emerald-500/15 border border-emerald-500/30 flex items-center justify-center text-emerald-300">
              <Layers size={22} />
            </div>
            <h3 className="font-bold text-white text-base font-display">Topic &amp; Project Clustering</h3>
            <p className="text-white/60 text-xs leading-relaxed">
              Agglomerative TF-IDF vector clustering groups related meetings over time into cumulative project context windows.
            </p>
          </motion.div>
        </div>
      </div>

    </motion.div>
  );
}
