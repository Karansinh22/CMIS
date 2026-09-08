/**
 * LivePage.jsx — Record a meeting live from the microphone.
 *
 * Flow:
 *   1. POST /meetings/live            → meeting id
 *   2. open WS /ws/live/{id}          → send {"type":"start"} then 16 kHz int16 PCM frames
 *   3. /ws/status/{id}                → transcript lines + stage updates (same as uploads)
 *   4. {"type":"stop"}                → server saves audio, labels speakers, runs extraction
 *
 * Audio capture uses an AudioWorklet (falls back to ScriptProcessor) that
 * downsamples the microphone to 16 kHz mono and posts Int16 frames.
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Mic, Square, Loader2, ArrowRight, CheckCircle2, AlertCircle, Sparkles, FolderKanban, Radio,
} from 'lucide-react';
import { createLiveMeeting, listProjects, wsBaseUrl } from '../api';
import { useStatusSocket } from '../hooks/useStatusSocket';
import ProcessingStatus from '../components/ProcessingStatus';
import LiveTranscript from '../components/LiveTranscript';

const TARGET_RATE = 16000;

// Runs inside the audio thread: downsample + convert to Int16, post ~250 ms frames.
const WORKLET_SOURCE = `
class PcmDownsampler extends AudioWorkletProcessor {
  constructor(options) {
    super();
    this.ratio = sampleRate / options.processorOptions.targetRate;   // e.g. 48000/16000 = 3
    this.frameSamples = Math.round(options.processorOptions.targetRate / 4);   // 250 ms
    this.carry = new Float32Array(0);   // input samples not yet consumed
    this.out = [];
    this.level = 0;
  }
  process(inputs) {
    const input = inputs[0];
    if (!input || !input[0]) return true;
    const ch = input[0];

    // running RMS for the level meter
    let sum = 0;
    for (let i = 0; i < ch.length; i++) sum += ch[i] * ch[i];
    this.level = 0.85 * this.level + 0.15 * Math.sqrt(sum / ch.length);

    // join the carry-over with the new block, then average every ratio samples
    const buf = new Float32Array(this.carry.length + ch.length);
    buf.set(this.carry, 0);
    buf.set(ch, this.carry.length);
    let pos = 0;
    while (pos + this.ratio <= buf.length) {
      const end = pos + this.ratio;
      let acc = 0, n = 0;
      for (let j = Math.floor(pos); j < end; j++) { acc += buf[j]; n++; }
      this.out.push(n ? acc / n : 0);
      pos = end;
    }
    this.carry = buf.slice(Math.floor(pos));

    if (this.out.length >= this.frameSamples) {
      const pcm = new Int16Array(this.out.length);
      for (let i = 0; i < pcm.length; i++) {
        const s = Math.max(-1, Math.min(1, this.out[i]));
        pcm[i] = s < 0 ? s * 0x8000 : s * 0x7FFF;
      }
      this.port.postMessage({ pcm: pcm.buffer, level: this.level }, [pcm.buffer]);
      this.out = [];
    }
    return true;
  }
}
registerProcessor('pcm-downsampler', PcmDownsampler);
`;

function fmtClock(secs) {
  const m = Math.floor(secs / 60);
  const s = Math.floor(secs % 60);
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

export default function LivePage() {
  const navigate = useNavigate();

  const [title, setTitle] = useState('');
  const [summaryType, setSummaryType] = useState('balanced');
  const [projects, setProjects] = useState([]);
  const [projectId, setProjectId] = useState('');

  const [phase, setPhase] = useState('idle');        // idle | starting | recording | stopping | processing | done | error
  const [error, setError] = useState(null);
  const [meetingId, setMeetingId] = useState(null);
  const [seconds, setSeconds] = useState(0);
  const [ackSeconds, setAckSeconds] = useState(0);
  const [level, setLevel] = useState(0);
  const [wsStatus, setWsStatus] = useState(null);
  const [segments, setSegments] = useState([]);

  const audioRef = useRef({ ctx: null, stream: null, node: null, ws: null, timer: null, started: 0 });

  useEffect(() => {
    listProjects().then(({ data }) => setProjects(data || [])).catch(() => {});
    return () => teardownAudio();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useStatusSocket(meetingId, (event) => {
    if (event.type === 'segments') {
      setSegments((prev) => {
        const seen = new Set(prev.map((s) => s.id));
        const fresh = (event.segments || []).filter((s) => !seen.has(s.id));
        return fresh.length ? [...prev, ...fresh] : prev;
      });
      return;
    }
    if (event.type === 'status') {
      setWsStatus(event);
      if (event.status === 'done') setPhase('done');
      if (event.status === 'error') { setPhase('error'); setError(event.message || 'Processing failed.'); }
    }
  });

  const teardownAudio = () => {
    const a = audioRef.current;
    if (a.timer) clearInterval(a.timer);
    if (a.node) { try { a.node.disconnect(); } catch { /* ignore */ } }
    if (a.stream) a.stream.getTracks().forEach((t) => t.stop());
    if (a.ctx) { a.ctx.close().catch(() => {}); }
    audioRef.current = { ...a, ctx: null, stream: null, node: null, timer: null };
  };

  const openAudioSocket = (id) => new Promise((resolve, reject) => {
    const ws = new WebSocket(`${wsBaseUrl}/ws/live/${id}`);
    ws.binaryType = 'arraybuffer';
    let ready = false;
    ws.onopen = () => ws.send(JSON.stringify({ type: 'start', sample_rate: TARGET_RATE }));
    ws.onmessage = (e) => {
      let msg;
      try { msg = JSON.parse(e.data); } catch { return; }
      if (msg.type === 'ready') { ready = true; resolve(ws); }
      else if (msg.type === 'ack') setAckSeconds(msg.seconds || 0);
      else if (msg.type === 'error') { setError(msg.message); if (!ready) reject(new Error(msg.message)); }
    };
    ws.onerror = () => { if (!ready) reject(new Error('Could not open the audio stream. Is the backend running?')); };
    ws.onclose = () => { if (!ready) reject(new Error('Audio stream closed before it was ready.')); };
  });

  const startRecording = useCallback(async (e) => {
    e?.preventDefault?.();
    if (!title.trim()) { setError('Give the meeting a title first.'); return; }
    if (!navigator.mediaDevices?.getUserMedia) {
      setError('This browser cannot access the microphone. Use Chrome/Edge/Firefox over http://localhost or https.');
      return;
    }
    setError(null);
    setPhase('starting');
    setSegments([]);
    setSeconds(0);
    setAckSeconds(0);

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: { channelCount: 1, echoCancellation: true, noiseSuppression: true, autoGainControl: true },
      });
      const { data: meeting } = await createLiveMeeting({
        title: title.trim(), summary_type: summaryType, project_id: projectId || null,
      });
      setMeetingId(meeting.id);
      const ws = await openAudioSocket(meeting.id);

      const ctx = new (window.AudioContext || window.webkitAudioContext)();
      const source = ctx.createMediaStreamSource(stream);
      let node;
      const send = (buf, lvl) => {
        if (ws.readyState === WebSocket.OPEN) ws.send(buf);
        if (lvl != null) setLevel(lvl);
      };

      if (ctx.audioWorklet) {
        const url = URL.createObjectURL(new Blob([WORKLET_SOURCE], { type: 'application/javascript' }));
        await ctx.audioWorklet.addModule(url);
        node = new AudioWorkletNode(ctx, 'pcm-downsampler', { processorOptions: { targetRate: TARGET_RATE } });
        node.port.onmessage = (ev) => send(ev.data.pcm, ev.data.level);
        source.connect(node);
        // Worklet nodes need a destination to keep running in some browsers; keep it silent.
        const silent = ctx.createGain(); silent.gain.value = 0;
        node.connect(silent).connect(ctx.destination);
      } else {
        // Fallback for browsers without AudioWorklet
        const ratio = ctx.sampleRate / TARGET_RATE;
        node = ctx.createScriptProcessor(4096, 1, 1);
        node.onaudioprocess = (ev) => {
          const ch = ev.inputBuffer.getChannelData(0);
          const outLen = Math.floor(ch.length / ratio);
          const out = new Int16Array(outLen);
          let sum = 0;
          for (let i = 0; i < outLen; i++) {
            const s = Math.max(-1, Math.min(1, ch[Math.floor(i * ratio)]));
            out[i] = s < 0 ? s * 0x8000 : s * 0x7FFF;
            sum += s * s;
          }
          send(out.buffer, Math.sqrt(sum / Math.max(1, outLen)));
        };
        source.connect(node);
        node.connect(ctx.destination);
      }

      const started = Date.now();
      const timer = setInterval(() => setSeconds((Date.now() - started) / 1000), 500);
      audioRef.current = { ctx, stream, node, ws, timer, started };
      setPhase('recording');
    } catch (err) {
      teardownAudio();
      setPhase('idle');
      setError(err?.response?.data?.detail || err?.message || 'Could not start recording.');
    }
  }, [title, summaryType, projectId]);

  const stopRecording = useCallback(() => {
    const a = audioRef.current;
    setPhase('stopping');
    teardownAudio();
    if (a.ws && a.ws.readyState === WebSocket.OPEN) {
      a.ws.send(JSON.stringify({ type: 'stop' }));
      a.ws.onmessage = (e) => {
        try {
          const msg = JSON.parse(e.data);
          if (msg.type === 'stopped') { setPhase('processing'); a.ws.close(); }
        } catch { /* ignore */ }
      };
      // If the server doesn't answer, still move on — the status socket tells the rest.
      setTimeout(() => setPhase((p) => (p === 'stopping' ? 'processing' : p)), 3000);
    } else {
      setPhase('processing');
    }
  }, []);

  const reset = () => {
    teardownAudio();
    setPhase('idle'); setMeetingId(null); setSegments([]); setWsStatus(null);
    setError(null); setSeconds(0); setAckSeconds(0); setTitle('');
  };

  const recording = phase === 'recording';
  const busy = phase === 'starting' || phase === 'stopping';
  const afterStop = phase === 'processing' || phase === 'done' || phase === 'error';
  const levelPct = Math.min(100, Math.round(level * 400));

  return (
    <div className="page-wrapper max-w-2xl space-y-6">
      <div>
        <h1 className="page-title text-2xl font-extrabold">Record Live Meeting</h1>
        <p className="page-subtitle text-xs">
          Stream the microphone straight into CMIS. The transcript appears while you talk; decisions, action items and the summary are extracted the moment you stop.
        </p>
      </div>

      {error && (
        <div className="card p-3 border-semantic-error/30 bg-semantic-error/5 flex items-start gap-2 text-xs text-semantic-error">
          <AlertCircle size={14} className="shrink-0 mt-0.5" /> <span>{error}</span>
        </div>
      )}

      {phase === 'idle' || phase === 'starting' ? (
        <form onSubmit={startRecording} className="space-y-5">
          <div className="space-y-1.5">
            <label className="label">Meeting title</label>
            <input
              className="input text-sm"
              placeholder="e.g. Sprint planning — 9 Sep"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              disabled={busy}
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <label className="label flex items-center gap-1.5"><Sparkles size={12} /> Summary depth</label>
              <select className="input text-xs" value={summaryType} onChange={(e) => setSummaryType(e.target.value)} disabled={busy}>
                <option value="brief">Brief</option>
                <option value="balanced">Balanced</option>
                <option value="comprehensive">Comprehensive</option>
              </select>
            </div>
            <div className="space-y-1.5">
              <label className="label flex items-center gap-1.5"><FolderKanban size={12} /> Project (optional)</label>
              <select className="input text-xs" value={projectId} onChange={(e) => setProjectId(e.target.value)} disabled={busy}>
                <option value="">Standalone meeting</option>
                {projects.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
              </select>
            </div>
          </div>

          <button type="submit" disabled={busy || !title.trim()} className="btn-primary w-full justify-center py-3 text-sm">
            {busy ? <Loader2 size={16} className="animate-spin" /> : <Mic size={16} />}
            <span>{busy ? 'Requesting microphone…' : 'Start recording'}</span>
          </button>
          <p className="text-[11px] text-text-muted text-center">
            Works in Chrome, Edge and Firefox on http://localhost or https. Audio is sent as 16 kHz mono PCM to your own backend only.
          </p>
        </form>
      ) : (
        <div className="space-y-4">
          {/* Recorder bar */}
          <div className="card p-4 flex items-center gap-4">
            <div className={`w-10 h-10 rounded-full flex items-center justify-center border ${recording ? 'bg-semantic-error/10 border-semantic-error/40 text-semantic-error' : 'bg-surface-hover border-border-default text-text-secondary'}`}>
              {recording ? <Radio size={18} className="animate-pulse" /> : afterStop ? <CheckCircle2 size={18} /> : <Loader2 size={18} className="animate-spin" />}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-bold text-text-primary truncate">{title}</p>
              <p className="text-xs text-text-secondary">
                {recording && `Recording · ${fmtClock(seconds)} · ${ackSeconds.toFixed(0)}s received by server`}
                {phase === 'stopping' && 'Stopping…'}
                {phase === 'processing' && 'Finishing transcript, labelling speakers and extracting decisions…'}
                {phase === 'done' && 'Done — your meeting intelligence is ready.'}
                {phase === 'error' && 'Processing failed.'}
              </p>
              {recording && (
                <div className="mt-2 progress-track">
                  <div className="progress-fill" style={{ width: `${levelPct}%`, transition: 'width 120ms linear' }} />
                </div>
              )}
            </div>
            {recording && (
              <button onClick={stopRecording} className="btn-primary text-xs py-2 px-4">
                <Square size={13} /> Stop
              </button>
            )}
          </div>

          {afterStop && phase !== 'done' && (
            <ProcessingStatus status={wsStatus?.status || 'transcribing'} message={wsStatus?.message} progress={wsStatus?.progress} />
          )}

          <LiveTranscript segments={segments} live={recording || phase === 'processing' || phase === 'stopping'} maxHeight="50vh" />

          <div className="flex flex-col sm:flex-row gap-2.5 pt-1">
            {meetingId && (
              <button onClick={() => navigate(`/meetings/${meetingId}`)} className={`${phase === 'done' ? 'btn-primary' : 'btn-secondary'} flex-1 justify-center py-2.5 text-xs`}>
                <span>{phase === 'done' ? 'Open Intelligence Report' : 'Open meeting page (keeps updating)'}</span>
                <ArrowRight size={13} />
              </button>
            )}
            {(phase === 'done' || phase === 'error') && (
              <button onClick={reset} className="btn-secondary flex-1 justify-center text-xs py-2.5">Record another meeting</button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
