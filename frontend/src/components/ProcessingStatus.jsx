/**
 * ProcessingStatus.jsx — Clean, professional monochrome pipeline status display.
 * `progress` (0–1) is the fraction of the *current* stage that is complete.
 */
import { motion } from 'framer-motion';
import { CheckCircle2, Loader2, Circle, AlertCircle, Cpu } from 'lucide-react';

const STEPS = [
  { id: 'queued',       label: 'Queued',        desc: 'Waiting for worker allocation' },
  { id: 'transcribing', label: 'Transcribing',   desc: 'Speech-to-text — lines appear live below' },
  { id: 'structuring',  label: 'Analysing NLP',  desc: 'Understanding decisions, tasks & topics' },
  { id: 'summarising',  label: 'Summarising',    desc: 'Generating structured intelligence' },
  { id: 'done',         label: 'Complete',       desc: 'Intelligence pipeline finished' },
];

const STATUS_ORDER = ['queued', 'transcribing', 'structuring', 'summarising', 'done'];

// The backend reports "structuring" for both analysis and summary generation;
// the last part of that stage is the summary.
function effectiveStatus(status, progress) {
  if (status === 'structuring' && progress != null && progress >= 0.85) return 'summarising';
  return status;
}

function getStepStatus(stepId, currentStatus) {
  const stepIdx    = STATUS_ORDER.indexOf(stepId);
  const currentIdx = STATUS_ORDER.indexOf(currentStatus);
  if (currentIdx >= STATUS_ORDER.indexOf('done') && stepId !== 'done') return 'done';
  if (stepIdx < currentIdx) return 'done';
  if (stepIdx === currentIdx) return 'active';
  return 'upcoming';
}

function overallPercent(status, progress) {
  const p = progress == null ? 0 : Math.max(0, Math.min(1, progress));
  switch (status) {
    case 'queued':       return 5;
    case 'transcribing': return 10 + p * 50;      // 10 → 60
    case 'structuring':  return 60 + p * 35;      // 60 → 95
    case 'summarising':  return 95;
    case 'done':         return 100;
    default:             return 0;
  }
}

function StepIcon({ state }) {
  if (state === 'done') {
    return (
      <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ type: 'spring', stiffness: 400, damping: 25 }}>
        <CheckCircle2 size={16} className="text-semantic-success" />
      </motion.div>
    );
  }
  if (state === 'active') return <Loader2 size={16} className="text-text-primary animate-spin" />;
  return <Circle size={16} className="text-text-muted opacity-40" />;
}

export default function ProcessingStatus({ status, message, progress = null }) {
  if (!status || status === 'done') return null;

  if (status === 'error') {
    return (
      <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="card p-5 border-semantic-error/30 bg-semantic-error/5">
        <div className="flex items-center gap-3 mb-1">
          <AlertCircle size={18} className="text-semantic-error shrink-0" />
          <span className="text-semantic-error font-bold text-sm">Processing Failed</span>
        </div>
        {message && <p className="text-semantic-error/80 text-xs pl-7 leading-relaxed">{message}</p>}
      </motion.div>
    );
  }

  const shown = effectiveStatus(status, progress);
  const percent = overallPercent(status, progress);
  const stagePct = progress != null ? Math.round(progress * 100) : null;

  return (
    <motion.div initial={{ opacity: 0, scale: 0.98, y: 8 }} animate={{ opacity: 1, scale: 1, y: 0 }} transition={{ duration: 0.2, ease: 'easeOut' }} className="card p-6 shadow-card">
      {/* Header */}
      <div className="flex items-center justify-between mb-6 pb-4 border-b border-border-subtle">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-surface-hover border border-border-default flex items-center justify-center text-text-primary">
            <Cpu size={16} />
          </div>
          <div>
            <p className="text-sm font-bold text-text-primary tracking-tight">Intelligence Pipeline Processing</p>
            {message && <p className="text-xs text-text-secondary mt-0.5">{message}</p>}
          </div>
        </div>
        <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-surface-hover border border-border-strong text-[11px] font-semibold text-text-primary">
          <span className="w-1.5 h-1.5 rounded-full bg-text-primary animate-pulse" />
          <span>{stagePct != null && status === 'transcribing' ? `${stagePct}%` : 'Active'}</span>
        </div>
      </div>

      {/* Steps */}
      <div className="space-y-3.5">
        {STEPS.map((step, idx) => {
          const state = getStepStatus(step.id, shown);
          return (
            <div key={step.id} className="flex items-start gap-3 relative">
              {idx < STEPS.length - 1 && <div className="absolute left-[7px] top-5 bottom-0 w-px bg-border-subtle" />}
              <div className="shrink-0 mt-0.5 z-10 bg-surface"><StepIcon state={state} /></div>
              <div className="flex-1 min-w-0 pb-1">
                <div className="flex items-center justify-between">
                  <p className={`text-xs font-semibold ${state === 'active' ? 'text-text-primary font-bold' : state === 'done' ? 'text-text-primary' : 'text-text-muted'}`}>
                    {step.label}
                  </p>
                  {state === 'active' && (
                    <span className="text-[10px] font-medium text-text-secondary bg-surface-hover px-2 py-0.5 rounded border border-border-default">
                      {stagePct != null && step.id === 'transcribing' ? `${stagePct}% of audio` : 'In progress'}
                    </span>
                  )}
                  {state === 'done' && <span className="text-[11px] font-medium text-text-secondary">Done</span>}
                </div>
                {state === 'active' && <p className="text-xs text-text-secondary mt-0.5">{step.desc}</p>}
              </div>
            </div>
          );
        })}
      </div>

      {/* Progress track */}
      <div className="mt-5 progress-track">
        <motion.div className="progress-fill" initial={{ width: 0 }} animate={{ width: `${percent}%` }} transition={{ duration: 0.3, ease: 'easeInOut' }} />
      </div>
    </motion.div>
  );
}
