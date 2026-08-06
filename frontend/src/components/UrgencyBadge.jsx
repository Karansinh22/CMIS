/**
 * UrgencyBadge.jsx — Renders urgency (low / medium / high) as a colour-coded badge.
 */
export default function UrgencyBadge({ urgency }) {
  const map = {
    high:   { label: '⚡ High',   cls: 'badge-red'    },
    medium: { label: '⚠ Medium', cls: 'badge-yellow'  },
    low:    { label: '· Low',    cls: 'badge-gray'    },
  };
  const { label, cls } = map[urgency] || map.low;
  return <span className={cls}>{label}</span>;
}
