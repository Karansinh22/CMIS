import { useEffect, useRef } from 'react';
import { openStatusSocket } from '../api';

/**
 * useStatusSocket — subscribes to the WebSocket event stream for a meeting.
 *
 * Events delivered to `onUpdate` (all carry `meeting_id`):
 *   { type: 'status',   status, message, progress }   pipeline stage changes
 *   { type: 'segments', segments: [...], progress }   freshly transcribed lines
 *   { type: 'transcript_ready' }                      speakers re-labelled → re-fetch transcript
 *   { type: 'context_ready' }                         NLP results available
 *   { type: 'ping' }                                  keepalive (ignored)
 *
 * Older events without a `type` are treated as status events.
 * The socket closes automatically on done/error or when the component unmounts.
 *
 * @param {string|null} meetingId
 * @param {function} onUpdate  (event) => void
 */
export function useStatusSocket(meetingId, onUpdate) {
  const wsRef = useRef(null);
  const cbRef = useRef(onUpdate);
  cbRef.current = onUpdate;   // always call the latest callback (no stale closures)

  useEffect(() => {
    if (!meetingId) return undefined;

    let closedByUs = false;
    const ws = openStatusSocket(
      meetingId,
      (event) => {
        if (!event || event.type === 'ping' || event.status === 'ping') return;
        const normalised = event.type ? event : { ...event, type: 'status' };
        cbRef.current?.(normalised);
        if (normalised.type === 'status' && (normalised.status === 'done' || normalised.status === 'error')) {
          closedByUs = true;
          ws.close();
        }
      },
      (err) => { if (!closedByUs) console.warn('WS error', err); },
    );

    wsRef.current = ws;
    return () => { closedByUs = true; ws.close(); };
  }, [meetingId]);

  return wsRef;
}
