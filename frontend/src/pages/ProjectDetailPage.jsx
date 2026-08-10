/**
 * ProjectDetailPage.jsx — Cumulative Project Workspace Intelligence.
 * Strict monochrome enterprise styling.
 */
import { useEffect, useState, useRef } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import {
  FolderKanban, Building2, Upload, Layers, Clock, Sparkles, RefreshCw,
  CheckCircle2, AlertCircle, ArrowLeft, Play, FileText, CheckSquare, MessageSquare, ChevronRight,
  Check
} from 'lucide-react';
import { getProject, uploadProjectMeeting, synthesizeProject } from '../api';
import StatusBadge from '../components/StatusBadge';

function round(val, decimals = 1) {
  return Number(Math.round(val + 'e' + decimals) + 'e-' + decimals) || 0;
}

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
      setTimeout(() => setUploading(false), 2500);
    } catch {
      setUploadStatus('Upload failed. Please check file format.');
      setTimeout(() => setUploading(false), 3500);
    }
  };

  const handleResynthesize = async () => {
    setResynthesizing(true);
    try {
      await synthesizeProject(projectId);
      await fetchProjectData();
    } catch {
      alert('Failed to re-synthesize project.');
    } finally {
      setResynthesizing(false);
    }
  };

  if (loading) {
    return (
      <div className="page-wrapper py-24 flex flex-col items-center justify-center gap-2 text-text-muted">
        <div className="w-6 h-6 border-2 border-text-primary border-t-transparent rounded-full animate-spin" />
        <span className="text-xs">Loading project intelligence...</span>
      </div>
    );
  }

  if (!project) {
    return (
      <div className="page-wrapper py-16 text-center">
        <p className="text-sm text-text-secondary">Project workspace not found.</p>
        <Link to="/projects" className="btn-secondary text-xs mt-3 inline-flex">Back to Projects</Link>
      </div>
    );
  }

  const summary = project.summary || {
    meeting_count: project.meetings?.length || 0,
    total_duration_minutes: 0,
    overall_summary: '',
    key_highlights: [],
    recurring_themes: [],
    consolidated_action_items: [],
  };

  return (
    <div className="page-wrapper-wide space-y-6">
      {/* Back button */}
      <div>
        <Link to="/projects" className="btn-ghost text-xs pl-0">
          <ArrowLeft size={13} /> Back to Projects
        </Link>
      </div>

      {/* Project Header Card */}
      <div className="card p-6 space-y-5">
        <div className="flex flex-col md:flex-row md:items-start justify-between gap-4">
          <div className="space-y-2 max-w-2xl">
            <div className="flex flex-wrap items-center gap-2">
              {project.company && (
                <span className="badge badge-gray text-[10px]">
                  <Building2 size={10} />
                  {project.company}
                </span>
              )}
              {project.category && (
                <span className="badge badge-strong text-[10px]">
                  {project.category}
                </span>
              )}
            </div>

            <h1 className="text-2xl font-extrabold text-text-primary tracking-tight">{project.name}</h1>
            {project.description && (
              <p className="text-text-secondary text-xs leading-relaxed">{project.description}</p>
            )}
          </div>

          <button
            onClick={handleResynthesize}
            disabled={resynthesizing}
            className="btn-secondary text-xs py-2 px-3.5 shrink-0 self-start md:self-auto"
          >
            <RefreshCw size={13} className={resynthesizing ? 'animate-spin' : ''} />
            <span>{resynthesizing ? 'Synthesizing...' : 'Re-synthesize Context'}</span>
          </button>
        </div>

        {/* Stats Strip */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-4 border-t border-border-subtle">
          <div className="stat-card p-3">
            <span className="stat-label text-[10px]">Meetings</span>
            <span className="stat-value text-xl">{summary.meeting_count}</span>
          </div>
          <div className="stat-card p-3">
            <span className="stat-label text-[10px]">Audio Context</span>
            <span className="stat-value text-xl">{summary.total_duration_minutes}m</span>
          </div>
          <div className="stat-card p-3">
            <span className="stat-label text-[10px]">Action Items</span>
            <span className="stat-value text-xl">{summary.consolidated_action_items.length}</span>
          </div>
          <div className="stat-card p-3">
            <span className="stat-label text-[10px]">Recurring Themes</span>
            <span className="stat-value text-xl">{summary.recurring_themes.length}</span>
          </div>
        </div>
      </div>

      {/* Audio Upload Dropzone */}
      <div
        onDragOver={(e) => { e.preventDefault(); setDragActive(true); }}
        onDragLeave={() => setDragActive(false)}
        onDrop={(e) => { e.preventDefault(); setDragActive(false); handleFileUpload(e.dataTransfer.files); }}
        className={`card p-5 text-center transition-all ${
          dragActive ? 'border-text-primary bg-surface-hover' : ''
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
          <div className="space-y-2 py-1 max-w-md mx-auto">
            <div className="flex items-center justify-between text-xs text-text-secondary">
              <span>{uploadStatus}</span>
              <span className="font-mono">{uploadProgress}%</span>
            </div>
            <div className="progress-track">
              <div
                className="progress-fill"
                style={{ width: `${uploadProgress}%` }}
              />
            </div>
            <p className="text-[11px] text-text-muted">
              Processing in background. You can navigate freely.
            </p>
          </div>
        ) : (
          <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
            <div className="flex items-center gap-3 text-left">
              <div className="w-8 h-8 rounded-lg bg-surface-hover border border-border-default flex items-center justify-center text-text-primary shrink-0">
                <Upload size={16} />
              </div>
              <div>
                <h4 className="text-xs font-bold text-text-primary">Ingest Audio to Workspace</h4>
                <p className="text-[11px] text-text-secondary">
                  Drop MP3, WAV, M4A recordings to expand cumulative intelligence.
                </p>
              </div>
            </div>

            <button
              onClick={() => fileInputRef.current?.click()}
              className="btn-primary text-xs py-2 px-3.5 shrink-0"
            >
              <Upload size={13} />
              <span>Upload Audio</span>
            </button>
          </div>
        )}
      </div>

      {/* Tabs */}
      <div className="tab-bar">
        <button
          onClick={() => setActiveTab('summary')}
          className={activeTab === 'summary' ? 'tab-btn-active' : 'tab-btn-inactive'}
        >
          <Sparkles size={13} />
          <span>Cumulative Intelligence</span>
        </button>
        <button
          onClick={() => setActiveTab('meetings')}
          className={activeTab === 'meetings' ? 'tab-btn-active' : 'tab-btn-inactive'}
        >
          <Layers size={13} />
          <span>Meeting History ({project.meetings?.length || 0})</span>
        </button>
      </div>

      {/* Tab Content */}
      {activeTab === 'summary' ? (
        <div className="space-y-6">
          {/* Executive Summary */}
          <div className="card p-6 space-y-3">
            <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-text-primary">
              <Sparkles size={14} />
              <h3>Cumulative Executive Summary</h3>
            </div>
            <p className="text-text-secondary text-xs sm:text-sm leading-relaxed whitespace-pre-line">
              {summary.overall_summary || 'Upload meeting audio to start generating cumulative context.'}
            </p>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Key Highlights */}
            <div className="card p-5 space-y-3">
              <h3 className="text-xs font-bold uppercase tracking-wider text-text-primary flex items-center gap-2">
                <CheckCircle2 size={14} className="text-semantic-success" />
                Project Highlights &amp; Milestones
              </h3>
              {summary.key_highlights.length === 0 ? (
                <p className="text-xs text-text-muted">No highlights synthesized yet.</p>
              ) : (
                <ul className="space-y-2 text-xs text-text-secondary">
                  {summary.key_highlights.map((h, i) => (
                    <li key={i} className="flex items-start gap-2 p-2 rounded bg-surface-hover border border-border-subtle">
                      <span className="w-1.5 h-1.5 rounded-full bg-text-primary mt-1.5 shrink-0" />
                      <span>{h}</span>
                    </li>
                  ))}
                </ul>
              )}
            </div>

            {/* Recurring Themes */}
            <div className="card p-5 space-y-3">
              <h3 className="text-xs font-bold uppercase tracking-wider text-text-primary flex items-center gap-2">
                <MessageSquare size={14} className="text-text-primary" />
                Recurring Themes Across Meetings
              </h3>
              {summary.recurring_themes.length === 0 ? (
                <p className="text-xs text-text-muted">No cross-meeting themes detected yet.</p>
              ) : (
                <div className="space-y-2.5">
                  {summary.recurring_themes.map((t, i) => (
                    <div key={i} className="p-3 rounded-lg bg-surface-hover border border-border-subtle space-y-1">
                      <div className="flex items-center justify-between text-xs">
                        <span className="font-semibold text-text-primary">{t.theme}</span>
                        <span className="badge badge-gray text-[10px]">
                          {t.frequency} {t.frequency === 1 ? 'meeting' : 'meetings'}
                        </span>
                      </div>
                      <p className="text-[11px] text-text-muted">
                        Appeared in: {t.meetings.join(', ')}
                      </p>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Consolidated Action Items */}
          <div className="card p-5 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-xs font-bold uppercase tracking-wider text-text-primary flex items-center gap-2">
                <CheckSquare size={14} />
                Consolidated Action Items Across Workspace
              </h3>
              <span className="text-xs text-text-muted">
                {summary.consolidated_action_items.filter((a) => a.resolved).length} of {summary.consolidated_action_items.length} completed
              </span>
            </div>

            {summary.consolidated_action_items.length === 0 ? (
              <p className="text-xs text-text-muted">No action items extracted from project recordings yet.</p>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {summary.consolidated_action_items.map((item, idx) => (
                  <div key={idx} className="p-3 rounded-lg bg-surface-hover border border-border-subtle flex items-start gap-3">
                    <div className={`mt-0.5 w-4 h-4 rounded border flex items-center justify-center shrink-0 ${
                      item.resolved ? 'bg-semantic-success border-semantic-success text-white' : 'border-border-strong bg-surface'
                    }`}>
                      {item.resolved && <Check size={10} strokeWidth={3} />}
                    </div>
                    <div className="space-y-1 min-w-0 flex-1">
                      <p className={`text-xs ${item.resolved ? 'line-through text-text-muted' : 'text-text-primary'}`}>
                        {item.description}
                      </p>
                      <div className="flex items-center gap-2 text-[10px] text-text-muted flex-wrap">
                        {item.owner && <span>Assignee: <strong className="text-text-primary">{item.owner}</strong></span>}
                        {item.meeting_title && <span>• {item.meeting_title}</span>}
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
        <div className="space-y-3">
          {(!project.meetings || project.meetings.length === 0) ? (
            <div className="empty-state py-12">
              <p className="text-xs text-text-muted">No meeting recordings added to this workspace yet.</p>
            </div>
          ) : (
            <div className="divide-y divide-border-subtle border border-border-subtle rounded-lg overflow-hidden">
              {project.meetings.map((m) => (
                <div
                  key={m.id}
                  onClick={() => navigate(`/meetings/${m.id}`)}
                  className="p-3.5 flex items-center justify-between hover:bg-surface-hover transition-colors cursor-pointer group"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-lg bg-surface border border-border-default flex items-center justify-center text-text-primary group-hover:border-border-strong transition-colors">
                      <Play size={14} />
                    </div>
                    <div>
                      <h4 className="text-xs sm:text-sm font-semibold text-text-primary group-hover:underline">
                        {m.title}
                      </h4>
                      <p className="text-[11px] text-text-muted">
                        {m.date ? new Date(m.date).toLocaleDateString() : 'Recent'} • {round(m.duration_seconds / 60, 1)} mins
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-3">
                    <StatusBadge status={m.status} />
                    <ChevronRight size={15} className="text-text-muted group-hover:text-text-primary transition-colors" />
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
