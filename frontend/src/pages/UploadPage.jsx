/**
 * UploadPage.jsx — Audio upload and meeting intelligence ingestion.
 * Strict enterprise monochrome UI with drop zone, summary selector, and project grouping.
 */
import { useState, useCallback, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Upload, FileAudio, X, Loader2, ArrowRight, FolderKanban,
  FileText, Sparkles, Mic, CheckCircle2, Layers,
  Building2, ChevronRight, Check
} from 'lucide-react';
import { uploadMeeting, listProjects } from '../api';
import { useStatusSocket } from '../hooks/useStatusSocket';
import ProcessingStatus from '../components/ProcessingStatus';
import LiveTranscript from '../components/LiveTranscript';

const ACCEPTED = ['.mp3', '.wav', '.m4a', '.mp4', '.ogg', '.flac', '.webm'];

const SUMMARY_OPTIONS = [
  {
    id: 'brief',
    label: 'Brief',
    sublabel: 'Executive Highlights',
    desc: 'Bullet-point key takeaways, main decisions, and priority action items.',
  },
  {
    id: 'balanced',
    label: 'Balanced',
    sublabel: 'Structured Overview',
    desc: 'Three-part narrative with context, decisions made, and next steps. Default mode.',
    recommended: true,
  },
  {
    id: 'comprehensive',
    label: 'In-Depth',
    sublabel: 'Comprehensive Intelligence',
    desc: 'Full multi-section report with detailed discussion points and topic breakdowns.',
  },
];

const PROJECT_CATEGORIES = ['Engineering', 'Strategy & Operations', 'Product', 'Sales & Clients', 'Research', 'General'];

function SummaryPicker({ value, onChange }) {
  return (
    <div className="space-y-1.5">
      <label className="label flex items-center gap-1.5">
        <Sparkles size={12} />
        <span>Summary Depth</span>
      </label>
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
        {SUMMARY_OPTIONS.map((opt) => {
          const isSelected = value === opt.id;
          return (
            <button
              key={opt.id}
              type="button"
              onClick={() => onChange(opt.id)}
              className={`relative p-3.5 rounded-lg text-left border transition-all ${
                isSelected
                  ? 'bg-surface-active border-text-primary shadow-sm'
                  : 'bg-surface border-border-default hover:border-border-strong hover:bg-surface-hover'
              }`}
            >
              {opt.recommended && (
                <span className="absolute top-2 right-2 badge badge-gray text-[9px] px-1.5 py-0.2">
                  Recommended
                </span>
              )}
              <div className="flex items-center gap-1.5">
                <span className={`text-xs font-bold ${isSelected ? 'text-text-primary' : 'text-text-secondary'}`}>
                  {opt.label}
                </span>
              </div>
              <p className="text-[11px] text-text-muted mt-0.5">{opt.sublabel}</p>
              <p className="text-[11px] text-text-secondary mt-1.5 leading-relaxed">{opt.desc}</p>
            </button>
          );
        })}
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
  const [liveSegments, setLiveSegments] = useState([]);
  const [error, setError] = useState(null);
  const inputRef = useRef(null);

  const [projects, setProjects] = useState([]);
  const [projectMode, setProjectMode] = useState('standalone');
  const [selectedProjectId, setSelectedProjectId] = useState('');
  const [newProject, setNewProject] = useState({ name: '', company: '', category: 'Engineering' });

  useEffect(() => {
    listProjects().then(({ data }) => setProjects(data || [])).catch(() => {});
  }, []);

  useStatusSocket(meetingId, (event) => {
    if (event.type === 'segments') {
      // Transcript lines arrive while Whisper is still running — show them immediately.
      setLiveSegments((prev) => {
        const seen = new Set(prev.map((s) => s.id));
        const fresh = (event.segments || []).filter((s) => !seen.has(s.id));
        return fresh.length ? [...prev, ...fresh] : prev;
      });
      if (event.progress != null) setWsStatus((prev) => ({ ...(prev || {}), progress: event.progress }));
      return;
    }
    if (event.type === 'status') setWsStatus(event);
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
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      selectFile(e.dataTransfer.files[0]);
    }
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
      setLiveSegments([]);
      setWsStatus({ status: 'queued', message: 'Queued for pipeline execution...', progress: 0 });
    } catch (err) {
      setError(err.response?.data?.detail || 'Upload failed. Is the backend server running?');
      setUploading(false);
    }
  };

  const done = wsStatus?.status === 'done';
  const hasError = wsStatus?.status === 'error';
  const transcribing = wsStatus?.status === 'transcribing' || wsStatus?.status === 'queued';

  return (
    <div className="page-wrapper max-w-2xl space-y-6">

      {/* ── Page Header ── */}
      <div>
        <h1 className="page-title text-2xl font-extrabold">Ingest Meeting Recording</h1>
        <p className="page-subtitle text-xs">
          Upload recorded audio to initiate transcription, speaker diarization, topic detection, and action item extraction.
        </p>
      </div>

      {/* ── Post-Upload Pipeline Status View ── */}
      {meetingId ? (
        <div className="space-y-4">
          <ProcessingStatus status={wsStatus?.status || 'queued'} message={wsStatus?.message} progress={wsStatus?.progress} />

          {/* Transcript streams in while the audio is still being processed */}
          {!hasError && (liveSegments.length > 0 || transcribing) && (
            <LiveTranscript segments={liveSegments} live={!done} progress={wsStatus?.progress} />
          )}

          {/* File summary bar */}
          <div className="card p-3 flex items-center gap-3">
            <FileAudio size={16} className="text-text-primary shrink-0" />
            <div className="flex-1 min-w-0">
              <p className="text-xs font-semibold text-text-primary truncate">{file?.name}</p>
              <p className="text-[11px] text-text-secondary truncate">{title}</p>
            </div>
            <span className="badge badge-gray text-[10px] uppercase font-semibold">{summaryType}</span>
          </div>

          <div className="flex flex-col sm:flex-row gap-2.5 pt-2">
            {done ? (
                <button
                  onClick={() => navigate(`/meetings/${meetingId}`)}
                  className="btn-primary flex-1 justify-center py-2.5 text-xs"
                >
                  <CheckCircle2 size={14} />
                  <span>Open Intelligence Report</span>
                  <ArrowRight size={13} />
                </button>
              ) : !hasError && (
                <button
                  onClick={() => navigate(`/meetings/${meetingId}`)}
                  className="btn-secondary flex-1 justify-center py-2.5 text-xs"
                  title="The meeting page keeps updating while processing continues"
                >
                  <span>Open meeting page (keeps updating)</span>
                  <ArrowRight size={13} />
                </button>
              )}
              <button
                onClick={() => {
                  setFile(null); setTitle(''); setMeetingId(null);
                  setWsStatus(null); setUploading(false); setLiveSegments([]);
                }}
                className="btn-secondary flex-1 justify-center text-xs py-2.5"
                title={done || hasError ? undefined : 'Processing continues on the server'}
              >
                Upload Another Recording
              </button>
          </div>
        </div>
      ) : (
        /* ── Upload Form ── */
        <form onSubmit={handleSubmit} className="space-y-5">

          {/* Drag & Drop Zone */}
          <div
            onClick={() => inputRef.current?.click()}
            onDrop={onDrop}
            onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
            onDragLeave={() => setDragging(false)}
            className={`card border-2 border-dashed p-8 text-center cursor-pointer transition-all ${
              dragging
                ? 'border-text-primary bg-surface-active'
                : file
                ? 'border-text-primary bg-surface-hover'
                : 'border-border-strong hover:border-text-primary hover:bg-surface-hover'
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
              <div className="flex flex-col items-center gap-2.5">
                <div className="w-12 h-12 rounded-lg bg-surface border border-border-default flex items-center justify-center text-text-primary">
                  <FileAudio size={22} />
                </div>
                <div>
                  <p className="font-bold text-text-primary text-sm">{file.name}</p>
                  <p className="text-text-muted text-xs mt-0.5">
                    {(file.size / 1024 / 1024).toFixed(2)} MB • Ready for analysis
                  </p>
                </div>
                <button
                  type="button"
                  onClick={(e) => { e.stopPropagation(); setFile(null); setTitle(''); }}
                  className="btn-ghost text-xs text-semantic-error hover:bg-semantic-error/10 py-1 px-2.5 mt-1"
                >
                  <X size={12} />
                  <span>Remove file</span>
                </button>
              </div>
            ) : (
              <div className="flex flex-col items-center gap-2.5 py-4">
                <div className="w-12 h-12 rounded-lg bg-surface border border-border-default flex items-center justify-center text-text-muted">
                  <Upload size={20} />
                </div>
                <div>
                  <p className="font-semibold text-text-primary text-xs sm:text-sm">
                    {dragging ? 'Drop audio recording here' : 'Drop audio recording or click to browse'}
                  </p>
                  <p className="text-[11px] text-text-muted mt-1">
                    Supports MP3, WAV, M4A, MP4, OGG, FLAC, WEBM
                  </p>
                </div>
              </div>
            )}
          </div>

          {/* Meeting Title Input */}
          <div>
            <label className="label">Meeting Title *</label>
            <input
              type="text"
              className="input text-xs"
              placeholder="e.g. Q3 Architecture Review, Client Strategy Alignment"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              required
            />
          </div>

          {/* Summary Depth Selection */}
          <SummaryPicker value={summaryType} onChange={setSummaryType} />

          {/* Project Workspace Assignment */}
          <div className="card p-4 space-y-3">
            <label className="label flex items-center gap-1.5">
              <FolderKanban size={12} />
              <span>Project Workspace Assignment</span>
            </label>

            <div className="flex items-center gap-2 flex-wrap">
              {[
                { id: 'standalone', label: 'Standalone' },
                { id: 'existing',   label: 'Assign to Existing Project' },
                { id: 'new',        label: 'Create New Workspace' },
              ].map(({ id, label }) => (
                <button
                  key={id}
                  type="button"
                  onClick={() => setProjectMode(id)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                    projectMode === id
                      ? 'bg-surface-active text-text-primary border border-border-default font-semibold'
                      : 'text-text-secondary hover:text-text-primary hover:bg-surface-hover border border-transparent'
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>

            {/* Existing Project Select */}
            {projectMode === 'existing' && (
              <div className="pt-2">
                {projects.length === 0 ? (
                  <p className="text-xs text-text-muted">
                    No projects found. Select "Create New Workspace" to create one.
                  </p>
                ) : (
                  <select
                    value={selectedProjectId}
                    onChange={(e) => setSelectedProjectId(e.target.value)}
                    className="input text-xs"
                    required
                  >
                    <option value="">— Select a workspace —</option>
                    {projects.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.name}{p.company ? ` (${p.company})` : ''}
                      </option>
                    ))}
                  </select>
                )}
              </div>
            )}

            {/* New Project Form */}
            {projectMode === 'new' && (
              <div className="space-y-2.5 pt-2">
                <input
                  type="text"
                  required
                  placeholder="Project Workspace Name *"
                  value={newProject.name}
                  onChange={(e) => setNewProject({ ...newProject, name: e.target.value })}
                  className="input text-xs"
                />
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  <input
                    type="text"
                    placeholder="Company / Client (Optional)"
                    value={newProject.company}
                    onChange={(e) => setNewProject({ ...newProject, company: e.target.value })}
                    className="input text-xs"
                  />
                  <select
                    value={newProject.category}
                    onChange={(e) => setNewProject({ ...newProject, category: e.target.value })}
                    className="input text-xs"
                  >
                    {PROJECT_CATEGORIES.map((c) => (
                      <option key={c} value={c}>{c}</option>
                    ))}
                  </select>
                </div>
              </div>
            )}
          </div>

          {/* Error Message */}
          {error && (
            <div className="card p-3 border-semantic-error/30 bg-semantic-error/5 text-semantic-error text-xs">
              {error}
            </div>
          )}

          {/* Upload Progress */}
          {uploading && uploadPct > 0 && uploadPct < 100 && (
            <div className="space-y-1.5">
              <div className="flex justify-between text-xs text-text-secondary">
                <span>Uploading file...</span>
                <span className="font-mono">{uploadPct}%</span>
              </div>
              <div className="progress-track">
                <div className="progress-fill" style={{ width: `${uploadPct}%` }} />
              </div>
            </div>
          )}

          {/* Submit Button */}
          <button
            type="submit"
            disabled={!file || !title.trim() || uploading}
            className="btn-primary w-full justify-center py-2.5 text-xs font-semibold"
          >
            {uploading ? (
              <>
                <Loader2 size={14} className="animate-spin" />
                <span>Uploading... {uploadPct}%</span>
              </>
            ) : (
              <>
                <Sparkles size={14} />
                <span>Begin Analysis</span>
                <ChevronRight size={14} />
              </>
            )}
          </button>
        </form>
      )}
    </div>
  );
}
