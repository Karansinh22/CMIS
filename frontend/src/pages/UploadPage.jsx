/**
 * UploadPage.jsx — Drag-and-drop meeting audio upload with live progress and
 * WebSocket status tracking after upload.
 */
import { useState, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Upload, Music, FileAudio, X, Loader, CheckCircle, ArrowRight,
} from 'lucide-react';
import { uploadMeeting } from '../api';
import { useStatusSocket } from '../hooks/useStatusSocket';
import ProcessingStatus from '../components/ProcessingStatus';

const ACCEPTED = ['.mp3', '.wav', '.m4a', '.mp4', '.ogg', '.flac', '.webm'];

export default function UploadPage() {
  const navigate = useNavigate();
  const [file,       setFile]       = useState(null);
  const [title,      setTitle]      = useState('');
  const [dragging,   setDragging]   = useState(false);
  const [uploadPct,  setUploadPct]  = useState(0);
  const [uploading,  setUploading]  = useState(false);
  const [meetingId,  setMeetingId]  = useState(null);
  const [wsStatus,   setWsStatus]   = useState(null);
  const [error,      setError]      = useState(null);
  const inputRef = useRef(null);

  // Subscribe to WS once we have a meeting ID
  useStatusSocket(meetingId, (event) => {
    if (event.status === 'ping') return;
    setWsStatus(event);
  });

  const selectFile = useCallback((f) => {
    if (!f) return;
    const ext = '.' + f.name.split('.').pop().toLowerCase();
    if (!ACCEPTED.includes(ext)) {
      setError(`Unsupported file type "${ext}". Accepted: ${ACCEPTED.join(', ')}`);
      return;
    }
    setError(null);
    setFile(f);
    if (!title) setTitle(f.name.replace(/\.[^/.]+$/, ''));
  }, [title]);

  const onDrop = useCallback((e) => {
    e.preventDefault();
    setDragging(false);
    const f = e.dataTransfer.files[0];
    selectFile(f);
  }, [selectFile]);

  const onDragOver = (e) => { e.preventDefault(); setDragging(true); };
  const onDragLeave = () => setDragging(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!file || !title.trim()) return;
    setError(null);
    setUploading(true);
    setUploadPct(0);

    try {
      const res = await uploadMeeting(file, title.trim(), setUploadPct);
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
          <Music size={12} /> New Meeting
        </div>
        <h1 className="text-3xl font-bold text-white">Upload Recording</h1>
        <p className="text-white/40 mt-1 text-sm">
          Drop in your meeting audio — CMIS will transcribe, structure, and extract intelligence from it.
        </p>
      </div>

      {/* Form */}
      {!meetingId ? (
        <form onSubmit={handleSubmit} className="space-y-5">
          {/* Drop zone */}
          <div
            onClick={() => inputRef.current?.click()}
            onDrop={onDrop}
            onDragOver={onDragOver}
            onDragLeave={onDragLeave}
            className={`relative cursor-pointer rounded-2xl border-2 border-dashed p-10 text-center transition-all duration-300
              ${dragging
                ? 'border-brand-400 bg-brand-600/10 shadow-glow-brand scale-[1.01]'
                : file
                  ? 'border-emerald-500/40 bg-emerald-500/5'
                  : 'border-white/10 bg-white/[0.02] hover:border-brand-500/40 hover:bg-brand-600/5'}`}
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
                <div className="w-14 h-14 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center">
                  <FileAudio size={28} className="text-emerald-400" />
                </div>
                <div>
                  <p className="font-semibold text-white">{file.name}</p>
                  <p className="text-white/40 text-xs mt-0.5">
                    {(file.size / 1024 / 1024).toFixed(1)} MB
                  </p>
                </div>
                <button
                  type="button"
                  onClick={(e) => { e.stopPropagation(); setFile(null); setTitle(''); }}
                  className="text-white/30 hover:text-red-400 transition-colors"
                >
                  <X size={16} />
                </button>
              </div>
            ) : (
              <div className="flex flex-col items-center gap-3 text-white/30">
                <div className="w-14 h-14 rounded-2xl bg-white/5 border border-white/10 flex items-center justify-center">
                  <Upload size={24} />
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
            <label className="block text-sm text-white/50 mb-1.5">Meeting title</label>
            <input
              className="input"
              placeholder="e.g. Sprint Planning — Week 22"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              required
            />
          </div>

          {error && (
            <div className="glass p-3 border-red-500/20 text-red-400 text-sm">
              {error}
            </div>
          )}

          {/* Upload button */}
          <button
            type="submit"
            disabled={!file || !title.trim() || uploading}
            className="btn-primary w-full justify-center py-3 text-base"
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
          <ProcessingStatus
            status={wsStatus?.status || 'queued'}
            message={wsStatus?.message}
          />

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
                onClick={() => { setFile(null); setTitle(''); setMeetingId(null); setWsStatus(null); setUploading(false); }}
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
