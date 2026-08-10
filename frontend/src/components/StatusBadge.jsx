/**
 * StatusBadge.jsx — High-clarity monochrome/semantic status badge with icons.
 */
import { CheckCircle2, Clock, Loader2, AlertCircle } from 'lucide-react';

const STATUS_CONFIG = {
  done: {
    label: 'Complete',
    cls: 'badge badge-success',
    icon: CheckCircle2,
    animate: false,
  },
  transcribing: {
    label: 'Transcribing',
    cls: 'badge badge-strong',
    icon: Loader2,
    animate: true,
  },
  structuring: {
    label: 'Structuring',
    cls: 'badge badge-strong',
    icon: Loader2,
    animate: true,
  },
  queued: {
    label: 'Queued',
    cls: 'badge badge-gray',
    icon: Clock,
    animate: false,
  },
  error: {
    label: 'Error',
    cls: 'badge badge-error',
    icon: AlertCircle,
    animate: false,
  },
};

export default function StatusBadge({ status }) {
  const config = STATUS_CONFIG[status] || STATUS_CONFIG.queued;
  const Icon = config.icon;
  return (
    <span className={config.cls}>
      <Icon
        size={11}
        className={config.animate ? 'animate-spin' : ''}
      />
      <span>{config.label}</span>
    </span>
  );
}
