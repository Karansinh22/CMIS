/**
 * StatusBadge.jsx — Colour-coded meeting status badge with icons.
 */
import { CheckCircle2, Clock3, Loader2, AlertCircle, Circle } from 'lucide-react';

const STATUS_CONFIG = {
  done:         { label: 'Complete',      cls: 'status-done',        icon: CheckCircle2, animate: false },
  transcribing: { label: 'Transcribing',  cls: 'status-transcribing', icon: Loader2,      animate: true  },
  structuring:  { label: 'Analysing',     cls: 'status-structuring',  icon: Loader2,      animate: true  },
  queued:       { label: 'Queued',        cls: 'status-queued',       icon: Clock3,       animate: false },
  error:        { label: 'Error',         cls: 'status-error',        icon: AlertCircle,  animate: false },
};

export default function StatusBadge({ status }) {
  const config = STATUS_CONFIG[status] || STATUS_CONFIG.queued;
  const Icon = config.icon;
  return (
    <span className={config.cls}>
      <Icon
        size={10}
        className={config.animate ? 'animate-spin' : ''}
      />
      {config.label}
    </span>
  );
}
