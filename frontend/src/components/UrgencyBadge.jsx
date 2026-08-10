/**
 * UrgencyBadge.jsx — Clean, professional monochrome & semantic urgency badge.
 * Uses restrained semantic dots and clean typography (no emojis).
 */
import { AlertCircle, AlertTriangle, Clock, ShieldAlert } from 'lucide-react';

const URGENCY_CONFIG = {
  critical: {
    label: 'Critical',
    cls: 'bg-semantic-error/10 text-semantic-error border border-semantic-error/25 font-semibold',
    icon: ShieldAlert,
  },
  high: {
    label: 'High',
    cls: 'bg-semantic-error/10 text-semantic-error border border-semantic-error/25 font-medium',
    icon: AlertCircle,
  },
  medium: {
    label: 'Medium',
    cls: 'bg-semantic-warning/10 text-semantic-warning border border-semantic-warning/25 font-medium',
    icon: AlertTriangle,
  },
  low: {
    label: 'Low',
    cls: 'bg-surface-hover text-text-secondary border border-border-default font-medium',
    icon: Clock,
  },
};

export default function UrgencyBadge({ urgency }) {
  const key = (urgency || 'low').toLowerCase();
  const config = URGENCY_CONFIG[key] || URGENCY_CONFIG.low;
  const Icon = config.icon;

  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] uppercase tracking-wider ${config.cls}`}>
      <Icon size={10} className="shrink-0" />
      {config.label}
    </span>
  );
}
