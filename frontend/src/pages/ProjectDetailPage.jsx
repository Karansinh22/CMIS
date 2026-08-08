import { useEffect, useState, useRef } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import {
  FolderKanban, Building2, Upload, Layers, Clock, Sparkles, RefreshCw,
  CheckCircle2, AlertCircle, ArrowLeft, Play, FileText, CheckSquare, MessageSquare, ChevronRight
} from 'lucide-react';
import { getProject, uploadProjectMeeting, synthesizeProject } from '../api';

export default function ProjectDetailPage() {
  const { id: projectId } = useParams();
  const navigate = useNavigate();

  const [project, setProject] = useState(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('summary'); // 'summary' | 'meetings'

  // Upload state
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [uploadStatus, setUploadStatus] = useState('');
  const [dragActive, setDragActive] = useState(false);
  const fileInputRef = useRef(null);

  // Resynthesize loading
  const [resynthesizing, setResynthesizing] = useState(false);

  const fetchProjectData = async () => {
    try {
      const { data } = await getProject(projectId);
      setProject(data);
    } catch (err) {
      console.error('Failed to load project details', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchProjectData();
    // Poll for status updates if any meeting is queued/transcribing/structuring
    const interval = setInterval(() => {
      if (project?.meetings?.some((m) => ['queued', 'transcribing', 'structuring'].includes(m.status))) {
        fetchProjectData();
      }
    }, 4000);
    return () => clearInterval(interval);
  }, [projectId]);

  const handleFileUpload = async (files) => {
    if (!files || files.length === 0) return;
    const file = files[0];

    setUploading(true);
    setUploadProgress(0);
    setUploadStatus(`Uploading ${file.name}...`);

    try {
      const title = file.name.replace(/\.[^/.]+$/, '');
      await uploadProjectMeeting(projectId, file, title, (progress) => {
        setUploadProgress(progress);
        if (progress === 100) {
          setUploadStatus('Upload complete! Ingestion & transcription running in background...');
        }
      });

      // Refresh project meeting list
      await fetchProjectData();
      setTimeout(() => setUploading(false), 3000);
    } catch (err) {
      setUploadStatus('Upload failed. Please try again.');
      setTimeout(() => setUploading(false), 4000);
    }
  };

  const handleResynthesize = async () => {
    setResynthesizing(true);
    try {
      await synthesizeProject(projectId);
      await fetchProjectData();
    } catch (err) {
      alert('Failed to re-synthesize project.');
    } finally {
      setResynthesizing(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="w-8 h-8 border-2 border-brand-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!project) {
    return (
      <div className="max-w-4xl mx-auto px-6 py-12 text-center text-white/60">
        <p>Project not found.</p>
        <Link to="/projects" className="btn-primary mt-4 inline-flex">Back to Projects</Link>
      </div>
    );
  }

  const { summary } = project;

  return (
    <div className="max-w-7xl mx-auto px-6 py-8 space-y-8">
      {/* Back button */}
      <div>
        <Link to="/projects" className="inline-flex items-center gap-2 text-xs font-medium text-white/50 hover:text-white transition-colors">
          <ArrowLeft size={14} /> Back to Projects
        </Link>
      </div>

      {/* Project Header Card */}
      <div className="glass p-8 rounded-2xl border border-white/10 relative overflow-hidden space-y-6">
        <div className="absolute top-0 right-0 p-8 pointer-events-none opacity-10">
          <FolderKanban size={180} className="text-brand-400" />
        </div>

        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="space-y-3 max-w-2xl">
            <div className="flex flex-wrap items-center gap-2">
              {project.company && (
                <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium bg-brand-500/10 text-brand-300 border border-brand-500/20">
                  <Building2 size={12} />
                  {project.company}
                </span>
              )}
              {project.category && (
                <span className="px-3 py-1 rounded-full text-xs font-medium bg-white/5 text-white/70 border border-white/10">
                  {project.category}
                </span>
              )}
            </div>

            <h1 className="text-3xl font-extrabold text-white tracking-tight">{project.name}</h1>
            {project.description && (
              <p className="text-white/60 text-sm leading-relaxed">{project.description}</p>
            )}
          </div>

          <button
            onClick={handleResynthesize}
            disabled={resynthesizing}
            className="glass-hover px-4 py-2.5 rounded-xl text-xs font-medium text-white/80 hover:text-white flex items-center gap-2 border border-white/10 shrink-0 self-start md:self-auto"
          >
            <RefreshCw size={14} className={resynthesizing ? 'animate-spin text-brand-400' : ''} />
            {resynthesizing ? 'Synthesizing...' : 'Re-synthesize Context'}
          </button>
        </div>

        {/* Stats Strip */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 pt-4 border-t border-white/10">
          <div className="p-3 rounded-xl bg-white/[0.02] border border-white/5">
            <p className="text-[11px] font-medium text-white/40 uppercase tracking-wider">Meetings Uploaded</p>
            <p className="text-xl font-bold text-white mt-0.5">{summary.meeting_count}</p>
          </div>
          <div className="p-3 rounded-xl bg-white/[0.02] border border-white/5">
            <p className="text-[11px] font-medium text-white/40 uppercase tracking-wider">Total Audio Context</p>
            <p className="text-xl font-bold text-white mt-0.5">{summary.total_duration_minutes} mins</p>
          </div>
          <div className="p-3 rounded-xl bg-white/[0.02] border border-white/5">
            <p className="text-[11px] font-medium text-white/40 uppercase tracking-wider">Action Items</p>
            <p className="text-xl font-bold text-brand-300 mt-0.5">{summary.consolidated_action_items.length}</p>
          </div>
          <div className="p-3 rounded-xl bg-white/[0.02] border border-white/5">
            <p className="text-[11px] font-medium text-white/40 uppercase tracking-wider">Recurring Themes</p>
            <p className="text-xl font-bold text-purple-300 mt-0.5">{summary.recurring_themes.length}</p>
          </div>
        </div>
      </div>

      {/* Background Upload Dropzone */}
      <div
        onDragOver={(e) => { e.preventDefault(); setDragActive(true); }}
        onDragLeave={() => setDragActive(false)}
        onDrop={(e) => { e.preventDefault(); setDragActive(false); handleFileUpload(e.dataTransfer.files); }}
        className={`glass p-6 rounded-2xl border transition-all duration-200 text-center relative ${
          dragActive ? 'border-brand-500 bg-brand-500/10' : 'border-white/10 hover:border-white/20'
        }`}
      >
        <input
          type="file"
          ref={fileInputRef}
          accept="audio/*"
          className="hidden"
          onChange={(e) => handleFileUpload(e.target.files)}
        />

        {uploading ? (
          <div className="space-y-3 py-2">
            <div className="flex items-center justify-between text-xs text-white/70 max-w-md mx-auto">
              <span>{uploadStatus}</span>
              <span>{uploadProgress}%</span>
            </div>
            <div className="w-full max-w-md mx-auto bg-white/10 h-2 rounded-full overflow-hidden">
              <div
                className="bg-brand-500 h-full transition-all duration-300 rounded-full"
                style={{ width: `${uploadProgress}%` }}
              />
            </div>
            <p className="text-[11px] text-white/40">
              💡 You can navigate to other pages freely. Processing continues in the background!
            </p>
          </div>
        ) : (
          <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
            <div className="flex items-center gap-3 text-left">
              <div className="w-10 h-10 rounded-xl bg-brand-500/10 text-brand-400 flex items-center justify-center shrink-0">
                <Upload size={20} />
              </div>
              <div>
                <h4 className="text-sm font-semibold text-white">Add Meeting Audio to this Project</h4>
                <p className="text-xs text-white/40">
                  Drop audio recordings (MP3, WAV, M4A). Transcribes in background and expands cumulative context.
                </p>
              </div>
            </div>

            <button
              onClick={() => fileInputRef.current?.click()}
              className="btn-primary text-xs py-2.5 px-4 shrink-0 gap-2"
            >
              <Upload size={14} /> Upload Meeting Audio
            </button>
          </div>
        )}
      </div>

      {/* Tabs */}
      <div className="flex border-b border-white/10">
        <button
          onClick={() => setActiveTab('summary')}
          className={`px-5 py-3 text-sm font-semibold border-b-2 transition-colors flex items-center gap-2 ${
            activeTab === 'summary'
              ? 'border-brand-500 text-brand-300'
              : 'border-transparent text-white/40 hover:text-white'
          }`}
        >
          <Sparkles size={16} />
          Cumulative Project Intelligence
        </button>
        <button
          onClick={() => setActiveTab('meetings')}
          className={`px-5 py-3 text-sm font-semibold border-b-2 transition-colors flex items-center gap-2 ${
            activeTab === 'meetings'
              ? 'border-brand-500 text-brand-300'
              : 'border-transparent text-white/40 hover:text-white'
          }`}
        >
          <Layers size={16} />
          Meeting History ({project.meetings.length})
        </button>
      </div>

      {/* Tab Content */}
      {activeTab === 'summary' ? (
        <div className="space-y-8">
          {/* Executive Summary */}
          <div className="glass p-6 rounded-2xl border border-white/10 space-y-3">
            <div className="flex items-center gap-2 text-brand-400 font-semibold text-sm">
              <Sparkles size={18} />
              <h3>Cumulative Executive Summary</h3>
            </div>
            <p className="text-white/80 text-sm leading-relaxed whitespace-pre-line">
              {summary.overall_summary}
            </p>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            {/* Key Highlights */}
            <div className="glass p-6 rounded-2xl border border-white/10 space-y-4">
              <h3 className="text-sm font-bold text-white flex items-center gap-2">
                <CheckCircle2 size={16} className="text-emerald-400" />
                Project Highlights & Milestones
              </h3>
              {summary.key_highlights.length === 0 ? (
                <p className="text-xs text-white/40">No highlights recorded yet.</p>
              ) : (
                <ul className="space-y-2.5 text-xs text-white/70">
                  {summary.key_highlights.map((h, i) => (
                    <li key={i} className="flex items-start gap-2.5 p-2.5 rounded-xl bg-white/[0.02] border border-white/5">
                      <span className="w-1.5 h-1.5 rounded-full bg-brand-400 mt-1.5 shrink-0" />
                      {h}
                    </li>
                  ))}
                </ul>
              )}
            </div>

            {/* Recurring Themes */}
            <div className="glass p-6 rounded-2xl border border-white/10 space-y-4">
              <h3 className="text-sm font-bold text-white flex items-center gap-2">
                <MessageSquare size={16} className="text-purple-400" />
                Recurring Themes Across Meetings
              </h3>
              {summary.recurring_themes.length === 0 ? (
                <p className="text-xs text-white/40">No recurring themes detected across meetings yet.</p>
              ) : (
                <div className="space-y-3">
                  {summary.recurring_themes.map((t, i) => (
                    <div key={i} className="p-3 rounded-xl bg-white/[0.02] border border-white/5 space-y-1.5">
                      <div className="flex items-center justify-between text-xs">
                        <span className="font-semibold text-white">{t.theme}</span>
                        <span className="px-2 py-0.5 rounded-full text-[10px] bg-purple-500/10 text-purple-300 border border-purple-500/20">
                          {t.frequency} {t.frequency === 1 ? 'meeting' : 'meetings'}
                        </span>
                      </div>
                      <p className="text-[11px] text-white/40">
                        Appeared in: {t.meetings.join(', ')}
                      </p>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Consolidated Action Items */}
          <div className="glass p-6 rounded-2xl border border-white/10 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-bold text-white flex items-center gap-2">
                <CheckSquare size={16} className="text-brand-400" />
                Consolidated Action Items Across Project
              </h3>
              <span className="text-xs text-white/40">
                {summary.consolidated_action_items.filter((a) => a.resolved).length} of {summary.consolidated_action_items.length} completed
              </span>
            </div>

            {summary.consolidated_action_items.length === 0 ? (
              <p className="text-xs text-white/40">No action items extracted from project meetings yet.</p>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {summary.consolidated_action_items.map((item, idx) => (
                  <div key={idx} className="p-3 rounded-xl bg-white/[0.02] border border-white/5 flex items-start gap-3">
                    <input
                      type="checkbox"
                      checked={item.resolved}
                      readOnly
                      className="mt-0.5 rounded bg-white/5 border-white/10 text-brand-500"
                    />
                    <div className="space-y-1 min-w-0 flex-1">
                      <p className={`text-xs ${item.resolved ? 'line-through text-white/30' : 'text-white/80'}`}>
                        {item.description}
                      </p>
                      <div className="flex items-center gap-2 text-[10px] text-white/40">
                        <span>Assignee: <strong className="text-white/60">{item.owner}</strong></span>
                        <span>•</span>
                        <span>{item.meeting_title} ({item.meeting_date})</span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      ) : (
        /* Meetings History Tab */
        <div className="space-y-4">
          {project.meetings.length === 0 ? (
            <div className="glass p-8 text-center rounded-2xl border border-white/10">
              <p className="text-white/40 text-sm">No meeting recordings added to this project yet.</p>
            </div>
          ) : (
            <div className="glass rounded-2xl border border-white/10 overflow-hidden divide-y divide-white/5">
              {project.meetings.map((m) => (
                <div
                  key={m.id}
                  onClick={() => navigate(`/meetings/${m.id}`)}
                  className="p-4 flex items-center justify-between hover:bg-white/[0.02] transition-colors cursor-pointer group"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-white/5 flex items-center justify-center text-brand-400 group-hover:bg-brand-500/10 transition-colors">
                      <Play size={18} />
                    </div>
                    <div>
                      <h4 className="text-sm font-semibold text-white group-hover:text-brand-300 transition-colors">
                        {m.title}
                      </h4>
                      <p className="text-xs text-white/40">
                        {m.date ? new Date(m.date).toLocaleDateString() : 'Unknown date'} • {round(m.duration_seconds / 60, 1)} mins
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-4">
                    {/* Status Badge */}
                    <span className={`px-2.5 py-1 rounded-full text-xs font-medium capitalize ${
                      m.status === 'done'
                        ? 'bg-emerald-500/10 text-emerald-300 border border-emerald-500/20'
                        : m.status === 'error'
                        ? 'bg-red-500/10 text-red-300 border border-red-500/20'
                        : 'bg-amber-500/10 text-amber-300 border border-amber-500/20 animate-pulse'
                    }`}>
                      {m.status}
                    </span>

                    <ChevronRight size={16} className="text-white/20 group-hover:text-white group-hover:translate-x-1 transition-all" />
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function round(val, decimals = 1) {
  return Number(Math.round(val + 'e' + decimals) + 'e-' + decimals) || 0;
}
