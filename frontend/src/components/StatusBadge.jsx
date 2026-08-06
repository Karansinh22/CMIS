/**
 * StatusBadge.jsx — Renders the meeting processing status as a styled badge.
 */
export default function StatusBadge({ status }) {
  const map = {
    queued:       { label: 'Queued',       cls: 'status-queued' },
    transcribing: { label: 'Transcribing', cls: 'status-transcribing' },
    structuring:  { label: 'Structuring',  cls: 'status-structuring' },
    done:         { label: 'Done',         cls: 'status-done' },
    error:        { label: 'Error',        cls: 'status-error' },
  };
  const { label, cls } = map[status] || { label: status, cls: 'status-queued' };
  return <span className={cls}>{label}</span>;
}
