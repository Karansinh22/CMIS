/**
 * UrgencyBadge.jsx — Renders urgency level as a colour-coded badge.
 * Supports: critical | high | medium | low
 */
export default function UrgencyBadge({ urgency }) {
  const map = {
    critical: { label: '🔥 Critical', cls: 'badge-red animate-pulse'  },
    high:     { label: '⚡ High',     cls: 'badge-red'                 },
    medium:   { label: '⚠ Medium',   cls: 'badge-yellow'              },
    low:      { label: '· Low',      cls: 'badge-gray'                },
  };
  const key = (urgency || 'low').toLowerCase();
  const { label, cls } = map[key] || map.low;
  return <span className={cls}>{label}</span>;
}
