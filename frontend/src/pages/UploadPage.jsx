/**
 * UploadPage.jsx — Drag-and-drop meeting audio upload with Project options
 * (Standalone, Existing Project, or Create New Project) & live processing status.
 */
import { useState, useCallback, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Upload, Music, FileAudio, X, Loader, ArrowRight, FolderKanban, Plus, Building2, Layers
} from 'lucide-react';
import { uploadMeeting, listProjects } from '../api';
import { useStatusSocket } from '../hooks/useStatusSocket';
import ProcessingStatus from '../components/ProcessingStatus';

const ACCEPTED = ['.mp3', '.wav', '.m4a', '.mp4', '.ogg', '.flac', '.webm'];

export default function UploadPage() {
  const navigate = useNavigate();
  const [file, setFile] = useState(null);
  const [title, setTitle] = useState('');
  const [dragging, setDragging] = useState(false);
  const [uploadPct, setUploadPct] = useState(0);
  const [uploading, setUploading] = useState(false);
  const [meetingId, setMeetingId] = useState(null);
  const [wsStatus, setWsStatus] = useState(null);
  const [error, setError] = useState(null);
  const inputRef = useRef(null);

  // Projects state
  const [projects, setProjects] = useState([]);
  const [projectMode, setProjectMode] = useState('standalone'); // 'standalone' | 'existing' | 'new'
  const [selectedProjectId, setSelectedProjectId] = useState('');
  const [newProject, setNewProject] = useState({ name: '', company: '', category: 'Engineering' });

  useEffect(() => {
    listProjects()
      .then(({ data }) => setProjects(data))
      .catch(() => {});
  }, []);

  // Subscribe to WS once we have a meeting ID
  useStatusSocket(meetingId, (event) => {
    if (event.status === 'ping') return;
    setWsStatus(event);
  });

  const selectFile = useCallback(
    (f) => {
      if (!f) return;
      const ext = '.' + f.name.split('.').pop().toLowerCase();
      if (!ACCEPTED.includes(ext)) {
        setError(`Unsupported file type "${ext}". Accepted: ${ACCEPTED.join(', ')}`);
        return;
      }
      setError(null);
      setFile(f);
      if (!title) setTitle(f.name.replace(/\.[^/.]+$/, ''));
    },
    [title]
  );

  const onDrop = useCallback(
    (e) => {
      e.preventDefault();
      setDragging(false);
      const f = e.dataTransfer.files[0];
      selectFile(f);
    },
    [selectFile]
  );

  const onDragOver = (e) => {
    e.preventDefault();
    setDragging(true);
  };
  const onDragLeave = () => setDragging(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!file || !title.trim()) return;
    setError(null);
    setUploading(true);
    setUploadPct(0);

    const projectOpts = {};
    if (projectMode === 'existing' && selectedProjectId) {
      projectOpts.projectId = selectedProjectId;
    } else if (projectMode === 'new' && newProject.name.trim()) {
      projectOpts.newProjectName = newProject.name.trim();
      projectOpts.newProjectCompany = newProject.company.trim();
      projectOpts.newProjectCategory = newProject.category;
    }

    try {
      const res = await uploadMeeting(file, title.trim(), projectOpts, setUploadPct);
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
      {/* Header */}
      <div className="mb-8">
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-brand-600/15 border border-brand-500/20 text-brand-300 text-xs font-semibold mb-3">
          <Music size={12} /> New Meeting Upload
        </div>
        <h1 className="text-3xl font-bold text-white tracking-tight">Upload Recording</h1>
        <p className="text-white/40 mt-1 text-sm">
          Drop in your meeting audio — CMIS will transcribe, structure, and aggregate intelligence.
        </p>
      </div>

      {/* Form */}
      {!meetingId ? (
        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Drop zone */}
          <div
            onClick={() => inputRef.current?.click()}
            onDrop={onDrop}
            onDragOver={onDragOver}
            onDragLeave={onDragLeave}
            className={`relative cursor-pointer rounded-2xl border-2 border-dashed p-8 text-center transition-all duration-300
              ${
                dragging
                  ? 'border-brand-400 bg-brand-600/10 shadow-glow-brand scale-[1.01]'
                  : file
                  ? 'border-emerald-500/40 bg-emerald-500/5'
                  : 'border-white/10 bg-white/[0.02] hover:border-brand-500/40 hover:bg-brand-600/5'
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
              <div className="flex flex-col items-center gap-3">
                <div className="w-12 h-12 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center">
                  <FileAudio size={26} className="text-emerald-400" />
                </div>
                <div>
                  <p className="font-semibold text-white">{file.name}</p>
                  <p className="text-white/40 text-xs mt-0.5">
                    {(file.size / 1024 / 1024).toFixed(1)} MB
                  </p>
                </div>
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    setFile(null);
                    setTitle('');
                  }}
                  className="text-white/30 hover:text-red-400 transition-colors"
                >
                  <X size={16} />
                </button>
              </div>
            ) : (
              <div className="flex flex-col items-center gap-3 text-white/30">
                <div className="w-12 h-12 rounded-2xl bg-white/5 border border-white/10 flex items-center justify-center">
                  <Upload size={22} />
                </div>
                <div>
                  <p className="font-medium text-white/60">Drop audio file here</p>
                  <p className="text-xs mt-1">or click to browse · {ACCEPTED.join(' ')}</p>
                </div>
              </div>
            )}
          </div>

          {/* Title input */}
          <div>
            <label className="block text-xs font-semibold text-white/60 mb-1.5 uppercase tracking-wider">
              Meeting Title *
            </label>
            <input
              className="input"
              placeholder="e.g. Android Architecture Viva, Client Sync"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              required
            />
          </div>

          {/* Project Assignment Options */}
          <div className="glass p-5 rounded-2xl border border-white/10 space-y-4">
            <div className="flex items-center gap-2 text-brand-300 font-semibold text-xs uppercase tracking-wider">
              <FolderKanban size={16} />
              <span>Project Workspace Assignment</span>
            </div>

            {/* Selection modes */}
            <div className="grid grid-cols-3 gap-2">
              <button
                type="button"
                onClick={() => setProjectMode('standalone')}
                className={`py-2 px-3 rounded-xl text-xs font-medium border transition-all text-center ${
                  projectMode === 'standalone'
                    ? 'bg-brand-600/20 text-brand-300 border-brand-500/40'
                    : 'bg-white/[0.02] text-white/50 border-white/5 hover:text-white'
                }`}
              >
                Standalone
              </button>
              <button
                type="button"
                onClick={() => setProjectMode('existing')}
                className={`py-2 px-3 rounded-xl text-xs font-medium border transition-all text-center ${
                  projectMode === 'existing'
                    ? 'bg-brand-600/20 text-brand-300 border-brand-500/40'
                    : 'bg-white/[0.02] text-white/50 border-white/5 hover:text-white'
                }`}
              >
                Existing Project
              </button>
              <button
                type="button"
                onClick={() => setProjectMode('new')}
                className={`py-2 px-3 rounded-xl text-xs font-medium border transition-all text-center ${
                  projectMode === 'new'
                    ? 'bg-brand-600/20 text-brand-300 border-brand-500/40'
                    : 'bg-white/[0.02] text-white/50 border-white/5 hover:text-white'
                }`}
              >
                + New Project
              </button>
            </div>

            {/* Mode 1: Existing Project Select */}
            {projectMode === 'existing' && (
              <div className="pt-2 animate-fade-in">
                {projects.length === 0 ? (
                  <p className="text-xs text-white/40">No existing projects found. Select "+ New Project" to create one.</p>
                ) : (
                  <div>
                    <label className="block text-xs text-white/50 mb-1">Select Project</label>
                    <select
                      value={selectedProjectId}
                      onChange={(e) => setSelectedProjectId(e.target.value)}
                      className="input bg-surface-50 text-white"
                      required
                    >
                      <option value="">-- Choose a Project Workspace --</option>
                      {projects.map((p) => (
                        <option key={p.id} value={p.id}>
                          {p.name} {p.company ? `(${p.company})` : ''}
                        </option>
                      ))}
                    </select>
                  </div>
                )}
              </div>
            )}

            {/* Mode 2: Create New Project */}
            {projectMode === 'new' && (
              <div className="space-y-3 pt-2 animate-fade-in">
                <div>
                  <label className="block text-xs text-white/50 mb-1">New Project Name *</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Q3 Engineering Review"
                    value={newProject.name}
                    onChange={(e) => setNewProject({ ...newProject, name: e.target.value })}
                    className="input text-xs"
                  />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs text-white/50 mb-1">Company / Client</label>
                    <input
                      type="text"
                      placeholder="e.g. Acme Corp"
                      value={newProject.company}
                      onChange={(e) => setNewProject({ ...newProject, company: e.target.value })}
                      className="input text-xs"
                    />
                  </div>
                  <div>
                    <label className="block text-xs text-white/50 mb-1">Category</label>
                    <select
                      value={newProject.category}
                      onChange={(e) => setNewProject({ ...newProject, category: e.target.value })}
                      className="input bg-surface-50 text-white text-xs"
                    >
                      <option value="Engineering">Engineering</option>
                      <option value="Viva / Defense">Viva / Defense</option>
                      <option value="Product">Product</option>
                      <option value="Sales & Clients">Sales & Clients</option>
                      <option value="General">General</option>
                    </select>
                  </div>
                </div>
              </div>
            )}
          </div>

          {error && <div className="glass p-3 border-red-500/20 text-red-400 text-sm">{error}</div>}

          {/* Submit button */}
          <button
            type="submit"
            disabled={!file || !title.trim() || uploading}
            className="btn-primary w-full justify-center py-3 text-base shadow-glow-brand"
          >
            {uploading ? (
              <>
                <Loader size={16} className="animate-spin" />
                Uploading… {uploadPct}%
              </>
            ) : (
              <>
                <Upload size={16} />
                Upload & Process
              </>
            )}
          </button>

          {/* Upload progress bar */}
          {uploading && (
            <div className="h-1 bg-white/5 rounded-full overflow-hidden">
              <div
                className="h-full bg-gradient-brand transition-all duration-300"
                style={{ width: `${uploadPct}%` }}
              />
            </div>
          )}
        </form>
      ) : (
        /* Status tracking panel */
        <div className="space-y-5 animate-fade-in">
          <ProcessingStatus status={wsStatus?.status || 'queued'} message={wsStatus?.message} />

          {(done || hasError) && (
            <div className="flex gap-3">
              {done && (
                <button
                  onClick={() => navigate(`/meetings/${meetingId}`)}
                  className="btn-primary flex-1 justify-center"
                >
                  View Meeting Context <ArrowRight size={16} />
                </button>
              )}
              <button
                onClick={() => {
                  setFile(null);
                  setTitle('');
                  setMeetingId(null);
                  setWsStatus(null);
                  setUploading(false);
                }}
                className="btn-secondary flex-1 justify-center"
              >
                Upload Another
              </button>
            </div>
          )}
        </div>
      )}

      {/* Supported formats hint */}
      <p className="text-white/20 text-xs text-center mt-8">
        Supported formats: WAV · MP3 · M4A · MP4 · OGG · FLAC · WEBM
      </p>
    </div>
  );
}
