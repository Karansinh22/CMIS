/**
 * UploadPage.jsx — Premium drag-and-drop meeting upload with animated
 * drop zone, audio waveform preview, project assignment, and live pipeline status.
 */
import { useState, useCallback, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Upload, FileAudio, X, Loader2, ArrowRight, FolderKanban,
  FileText, Sparkles, Mic2, CheckCircle2, Layers,
  Building2, Tag, ChevronRight,
} from 'lucide-react';
import { uploadMeeting, listProjects } from '../api';
import { useStatusSocket } from '../hooks/useStatusSocket';
import ProcessingStatus from '../components/ProcessingStatus';

const ACCEPTED = ['.mp3', '.wav', '.m4a', '.mp4', '.ogg', '.flac', '.webm'];

const SUMMARY_OPTIONS = [
  {
    id: 'brief',
    label: 'Brief',
    sublabel: 'Executive Highlights',
    desc: 'Bullet-point key facts, top decision, primary action item. Perfect for executives.',
    icon: '⚡',
  },
  {
    id: 'balanced',
    label: 'Balanced',
    sublabel: 'Structured Overview',
    desc: 'Three-section narrative with context, outcomes, and next steps. Default choice.',
    icon: '📋',
    recommended: true,
  },
  {
    id: 'comprehensive',
    label: 'In-Depth',
    sublabel: 'Full Intelligence Report',
    desc: 'Complete multi-section analysis with keyword maps, topic breakdown, and evidence.',
    icon: '🔬',
  },
];

const PROJECT_CATEGORIES = ['Engineering', 'Strategy & Operations', 'Product', 'Sales & Clients', 'Research', 'General'];

function AudioWaveform() {
  const bars = Array.from({ length: 24 }, (_, i) => i);
  return (
    <div className="flex items-end justify-center gap-0.5 h-8">
      {bars.map((i) => (
        <div
          key={i}
          className="w-0.5 bg-brand-400/60 rounded-full animate-pulse-slow"
          style={{
            height: `${20 + Math.sin(i * 0.8) * 50 + Math.random() * 20}%`,
            animationDelay: `${i * 80}ms`,
          }}
        />
      ))}
    </div>
  );
}

function SummaryPicker({ value, onChange }) {
  return (
    <div>
      <label className="label">
        <Sparkles size={11} className="inline mr-1 text-brand-400" />
        Summary Depth
      </label>
      <div className="grid grid-cols-3 gap-2">
        {SUMMARY_OPTIONS.map((opt) => (
          <button
            key={opt.id}
            type="button"
            onClick={() => onChange(opt.id)}
            className={`relative p-3 rounded-xl text-left border transition-all duration-200 group
              ${value === opt.id
                ? 'bg-brand-600/15 border-brand-500/40 shadow-glow-sm'
                : 'bg-white/[0.02] border-white/[0.06] hover:border-white/15 hover:bg-white/[0.04]'}`}
          >
            {opt.recommended && (
              <span className="absolute -top-1.5 right-2 badge badge-brand text-[9px] py-0 px-1.5">
                Default
              </span>
            )}
            <span className="text-base mb-1 block">{opt.icon}</span>
            <p className={`text-xs font-bold leading-tight ${value === opt.id ? 'text-brand-300' : 'text-white/75'}`}>
              {opt.label}
            </p>
            <p className="text-[10px] text-white/35 mt-0.5 leading-tight">{opt.sublabel}</p>
            {value === opt.id && (
              <p className="text-[10px] text-white/50 mt-1.5 leading-tight">{opt.desc}</p>
            )}
          </button>
        ))}
      </div>
    </div>
  );
}

export default function UploadPage() {
  const navigate = useNavigate();
  const [file, setFile] = useState(null);
  const [title, setTitle] = useState('');
  const [summaryType, setSummaryType] = useState('balanced');
  const [dragging, setDragging] = useState(false);
  const [uploadPct, setUploadPct] = useState(0);
  const [uploading, setUploading] = useState(false);
  const [meetingId, setMeetingId] = useState(null);
  const [wsStatus, setWsStatus] = useState(null);
  const [error, setError] = useState(null);
  const inputRef = useRef(null);

  const [projects, setProjects] = useState([]);
  const [projectMode, setProjectMode] = useState('standalone');
  const [selectedProjectId, setSelectedProjectId] = useState('');
  const [newProject, setNewProject] = useState({ name: '', company: '', category: 'Engineering' });

  useEffect(() => {
    listProjects().then(({ data }) => setProjects(data)).catch(() => {});
  }, []);

  useStatusSocket(meetingId, (event) => {
    if (event.status === 'ping') return;
    setWsStatus(event);
  });

  const selectFile = useCallback((f) => {
    if (!f) return;
    const ext = '.' + f.name.split('.').pop().toLowerCase();
    if (!ACCEPTED.includes(ext)) {
      setError(`Unsupported format "${ext}". Accepted: ${ACCEPTED.join(', ')}`);
      return;
    }
    setError(null);
    setFile(f);
    if (!title) setTitle(f.name.replace(/\.[^/.]+$/, '').replace(/[-_]/g, ' '));
  }, [title]);

  const onDrop = useCallback((e) => {
    e.preventDefault();
    setDragging(false);
    selectFile(e.dataTransfer.files[0]);
  }, [selectFile]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!file || !title.trim()) return;
    setError(null);
    setUploading(true);
    setUploadPct(0);

    const opts = { summaryType };
    if (projectMode === 'existing' && selectedProjectId) {
      opts.projectId = selectedProjectId;
    } else if (projectMode === 'new' && newProject.name.trim()) {
      opts.newProjectName     = newProject.name.trim();
      opts.newProjectCompany  = newProject.company.trim();
      opts.newProjectCategory = newProject.category;
    }

    try {
      const res = await uploadMeeting(file, title.trim(), opts, setUploadPct);
      setMeetingId(res.data.id);
      setWsStatus({ status: 'queued', message: 'Queued for processing…' });
    } catch (err) {
      setError(err.response?.data?.detail || 'Upload failed. Is the backend running?');
      setUploading(false);
    }
  };

  const done = wsStatus?.status === 'done';
  const hasError = wsStatus?.status === 'error';

  return (
    <div className="max-w-2xl mx-auto py-10 px-4 animate-slide-up">

      {/* ── Header ── */}
      <div className="mb-8">
        <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full
                        bg-brand-600/10 border border-brand-500/20 text-brand-300
                        text-[11px] font-semibold mb-3">
          <Mic2 size={10} />
          New Analysis
        </div>
        <h1 className="text-2xl font-bold text-white tracking-tight">Upload Recording</h1>
        <p className="text-white/40 mt-1 text-sm">
          Drop in your meeting audio — CMIS will transcribe, structure, and extract intelligence.
        </p>
      </div>

      {/* ── Post-upload: Processing view ── */}
      {meetingId ? (
        <div className="space-y-5 animate-scale-in">
          <ProcessingStatus status={wsStatus?.status || 'queued'} message={wsStatus?.message} />

          {/* File info strip */}
          <div className="glass p-3 flex items-center gap-3 rounded-xl">
            <FileAudio size={14} className="text-brand-400 shrink-0" />
            <div className="flex-1 min-w-0">
              <p className="text-xs text-white/70 truncate font-medium">{file?.name}</p>
              <p className="text-[10px] text-white/30">{title}</p>
            </div>
            <span className="badge-brand text-[10px]">{summaryType}</span>
          </div>

          {(done || hasError) && (
            <div className="flex gap-3 pt-2">
              {done && (
                <button
                  onClick={() => navigate(`/meetings/${meetingId}`)}
                  className="btn-primary flex-1 justify-center py-3"
                >
                  <CheckCircle2 size={15} />
                  View Intelligence Report
                  <ArrowRight size={14} />
                </button>
              )}
              <button
                onClick={() => {
                  setFile(null); setTitle(''); setMeetingId(null);
                  setWsStatus(null); setUploading(false);
                }}
                className="btn-secondary flex-1 justify-center"
              >
                Upload Another
              </button>
            </div>
          )}
        </div>

      ) : (
        /* ── Upload form ── */
        <form onSubmit={handleSubmit} className="space-y-5">

          {/* Drop zone */}
          <div
            onClick={() => inputRef.current?.click()}
            onDrop={onDrop}
            onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
            onDragLeave={() => setDragging(false)}
            className={`relative cursor-pointer rounded-2xl border-2 border-dashed p-8 text-center
                        transition-all duration-300 group
              ${dragging
                ? 'border-brand-400 bg-brand-600/10 shadow-glow-brand scale-[1.01]'
                : file
                ? 'border-emerald-500/40 bg-emerald-500/[0.04]'
                : 'border-white/[0.08] bg-white/[0.01] hover:border-brand-500/40 hover:bg-brand-600/[0.04]'
              }`}
          >
            <input
              ref={inputRef}
              type="file"
              accept={ACCEPTED.join(',')}
              className="hidden"
              onChange={(e) => selectFile(e.target.files[0])}
            />

            {file ? (
              <div className="flex flex-col items-center gap-3 animate-scale-in">
                <div className="w-14 h-14 rounded-2xl bg-emerald-500/10 border border-emerald-500/25
                                flex items-center justify-center">
                  <FileAudio size={28} className="text-emerald-400" />
                </div>
                <AudioWaveform />
                <div>
                  <p className="font-semibold text-white text-sm">{file.name}</p>
                  <p className="text-white/40 text-xs mt-0.5">
                    {(file.size / 1024 / 1024).toFixed(2)} MB · Ready to analyse
                  </p>
                </div>
                <button
                  type="button"
                  onClick={(e) => { e.stopPropagation(); setFile(null); setTitle(''); }}
                  className="flex items-center gap-1 text-white/25 hover:text-red-400
                             text-xs transition-colors"
                >
                  <X size={12} /> Remove file
                </button>
              </div>
            ) : (
              <div className="flex flex-col items-center gap-3 text-white/30 py-4">
                <div className={`w-14 h-14 rounded-2xl bg-white/[0.04] border border-white/[0.08]
                                 flex items-center justify-center transition-all duration-300
                                 group-hover:bg-brand-600/10 group-hover:border-brand-500/30`}>
                  <Upload size={24} className="group-hover:text-brand-400 transition-colors" />
                </div>
                <div>
                  <p className="font-semibold text-white/60 text-sm">
                    {dragging ? 'Drop it!' : 'Drop audio file here'}
                  </p>
                  <p className="text-xs mt-1 text-white/25">
                    or <span className="text-brand-400 underline underline-offset-2">click to browse</span>
                    &nbsp;· MP3, WAV, M4A, MP4, OGG, FLAC
                  </p>
                </div>
              </div>
            )}
          </div>

          {/* Meeting title */}
          <div>
            <label className="label">Meeting Title *</label>
            <input
              className="input"
              placeholder="e.g. Q3 Architecture Review, Sprint Planning"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              required
            />
          </div>

          {/* Summary depth picker */}
          <SummaryPicker value={summaryType} onChange={setSummaryType} />

          {/* Project assignment */}
          <div className="glass p-4 rounded-2xl border border-white/[0.07] space-y-3">
            <label className="label">
              <FolderKanban size={11} className="inline mr-1 text-brand-400" />
              Project Workspace
            </label>

            {/* Mode pills */}
            <div className="flex gap-1.5 flex-wrap">
              {[
                { id: 'standalone', label: 'Standalone',        icon: <Layers size={11} /> },
                { id: 'existing',   label: 'Add to Project',    icon: <FolderKanban size={11} /> },
                { id: 'new',        label: 'Create & Add',      icon: <Building2 size={11} /> },
              ].map(({ id, label, icon }) => (
                <button
                  key={id}
                  type="button"
                  onClick={() => setProjectMode(id)}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[11px] font-semibold
                              border transition-all ${projectMode === id
                    ? 'bg-brand-600/20 text-brand-300 border-brand-500/35'
                    : 'text-white/40 border-white/[0.06] hover:text-white/70 hover:border-white/15'}`}
                >
                  {icon} {label}
                </button>
              ))}
            </div>

            {/* Existing project select */}
            {projectMode === 'existing' && (
              <div className="animate-fade-in pt-1">
                {projects.length === 0 ? (
                  <p className="text-[11px] text-white/35">
                    No projects yet. Use "Create &amp; Add" to start one.
                  </p>
                ) : (
                  <select
                    value={selectedProjectId}
                    onChange={(e) => setSelectedProjectId(e.target.value)}
                    className="input text-sm bg-surface-100"
                    required
                  >
                    <option value="">— Choose a project —</option>
                    {projects.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.name}{p.company ? ` · ${p.company}` : ''}
                      </option>
                    ))}
                  </select>
                )}
              </div>
            )}

            {/* New project form */}
            {projectMode === 'new' && (
              <div className="space-y-2.5 animate-fade-in pt-1">
                <input
                  type="text"
                  required
                  placeholder="Project name *"
                  value={newProject.name}
                  onChange={(e) => setNewProject({ ...newProject, name: e.target.value })}
                  className="input text-sm"
                />
                <div className="grid grid-cols-2 gap-2">
                  <input
                    type="text"
                    placeholder="Company / Client"
                    value={newProject.company}
                    onChange={(e) => setNewProject({ ...newProject, company: e.target.value })}
                    className="input text-sm"
                  />
                  <select
                    value={newProject.category}
                    onChange={(e) => setNewProject({ ...newProject, category: e.target.value })}
                    className="input text-sm bg-surface-100"
                  >
                    {PROJECT_CATEGORIES.map((c) => (
                      <option key={c} value={c}>{c}</option>
                    ))}
                  </select>
                </div>
              </div>
            )}
          </div>

          {/* Error */}
          {error && (
            <div className="glass p-3.5 border border-red-500/25 bg-red-500/5 text-red-400 text-xs rounded-xl">
              {error}
            </div>
          )}

          {/* Upload progress */}
          {uploading && uploadPct > 0 && uploadPct < 100 && (
            <div>
              <div className="flex justify-between text-[10px] text-white/30 mb-1">
                <span>Uploading file…</span>
                <span>{uploadPct}%</span>
              </div>
              <div className="progress-track">
                <div className="progress-fill" style={{ width: `${uploadPct}%` }} />
              </div>
            </div>
          )}

          {/* Submit */}
          <button
            type="submit"
            disabled={!file || !title.trim() || uploading}
            className="btn-primary w-full justify-center py-3.5 text-sm font-bold shadow-glow-brand"
          >
            {uploading ? (
              <>
                <Loader2 size={15} className="animate-spin" />
                Uploading… {uploadPct}%
              </>
            ) : (
              <>
                <Sparkles size={15} />
                Analyse Meeting
                <ChevronRight size={14} className="ml-auto opacity-60" />
              </>
            )}
          </button>
        </form>
      )}

      <p className="text-white/15 text-[10px] text-center mt-8">
        Supported: WAV · MP3 · M4A · MP4 · OGG · FLAC · WEBM
      </p>
    </div>
  );
}
