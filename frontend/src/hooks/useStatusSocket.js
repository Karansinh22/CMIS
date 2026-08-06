import { useEffect, useRef } from 'react';
import { openStatusSocket } from '../api';

/**
 * useStatusSocket — subscribes to the WS status stream for a meeting.
 * Automatically closes the socket when status reaches "done" or "error",
 * or when the component unmounts.
 *
 * @param {string|null} meetingId
 * @param {function} onUpdate  (event) => void
 */
export function useStatusSocket(meetingId, onUpdate) {
  const wsRef = useRef(null);

  useEffect(() => {
    if (!meetingId) return;

    const ws = openStatusSocket(
      meetingId,
      (event) => {
        onUpdate(event);
        if (event.status === 'done' || event.status === 'error') {
          ws.close();
        }
      },
      (err) => console.warn('WS error', err),
    );

    wsRef.current = ws;
    return () => ws.close();
  }, [meetingId]);

  return wsRef;
}
