/**
 * LiveTranscript.jsx — Transcript lines appearing as Whisper produces them.
 *
 * Used on the Upload page (right after upload) and on the Meeting page while
 * the pipeline is still running.  Auto-scrolls to the newest line unless the
 * user has scrolled up to read something.
 */
import { useEffect, useRef, useState } from 'react';
import { Radio, MessageSquare } from 'lucide-react';

function fmtTime(secs) {
  const m = Math.floor((secs || 0) / 60);
  const s = Math.floor((secs || 0) % 60);
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

export default function LiveTranscript({ segments = [], live = false, progress = null, maxHeight = '22rem' }) {
  const boxRef = useRef(null);
  const [stickToBottom, setStickToBottom] = useState(true);

  useEffect(() => {
    const el = boxRef.current;
    if (el && stickToBottom) el.scrollTop = el.scrollHeight;
  }, [segments.length, stickToBottom]);

  const onScroll = () => {
    const el = boxRef.current;
    if (!el) return;
    const nearBottom = el.scrollHeight - el.scrollTop - el.clientHeight < 40;
    setStickToBottom(nearBottom);
  };

  const pct = progress != null ? Math.round(progress * 100) : null;

  return (
    <div className="card overflow-hidden">
      <div className="flex items-center justify-between px-4 py-2.5 border-b border-border-subtle">
        <div className="flex items-center gap-2 text-xs font-semibold text-text-primary">
          <MessageSquare size={13} />
          <span>{live ? 'Live transcript' : 'Transcript'}</span>
          <span className="text-text-muted font-normal">· {segments.length} line{segments.length === 1 ? '' : 's'}</span>
        </div>
        {live && (
          <span className="flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wider text-text-secondary">
            <Radio size={11} className="animate-pulse" />
            {pct != null ? `${pct}% of audio` : 'streaming'}
          </span>
        )}
      </div>

      <div ref={boxRef} onScroll={onScroll} className="overflow-y-auto px-4 py-3 space-y-2" style={{ maxHeight }}>
        {segments.length === 0 ? (
          <p className="text-xs text-text-muted py-6 text-center">
            {live ? 'Waiting for the first spoken line…' : 'No transcript yet.'}
          </p>
        ) : (
          segments.map((seg) => {
            const name = seg.speaker?.name || seg.speaker?.label || 'SPEAKER_00';
            return (
              <div key={seg.id} className="flex gap-3 items-start animate-fade-in">
                <span className="text-text-muted text-[11px] font-mono pt-0.5 w-11 shrink-0">{fmtTime(seg.start_time)}</span>
                <span className="badge badge-strong shrink-0 text-[9px] uppercase font-semibold tracking-wider">{name}</span>
                <p className="text-text-primary text-xs leading-relaxed">{seg.text}</p>
              </div>
            );
          })
        )}
        {live && segments.length > 0 && (
          <div className="flex gap-3 items-center pl-14 text-text-muted text-[11px]">
            <span className="w-1.5 h-1.5 rounded-full bg-text-primary animate-pulse" /> transcribing…
          </div>
        )}
      </div>
    </div>
  );
}
