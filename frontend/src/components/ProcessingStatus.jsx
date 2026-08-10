/**
 * ProcessingStatus.jsx — Clean, professional monochrome pipeline status display.
 */
import { motion } from 'framer-motion';
import { CheckCircle2, Loader2, Circle, AlertCircle, Cpu } from 'lucide-react';

const STEPS = [
  { id: 'queued',       label: 'Queued',        desc: 'Waiting for worker allocation' },
  { id: 'transcribing', label: 'Transcribing',   desc: 'Converting speech audio to text' },
  { id: 'structuring',  label: 'Analysing NLP',  desc: 'Extracting topics, decisions & tasks' },
  { id: 'summarising',  label: 'Summarising',    desc: 'Generating structured intelligence' },
  { id: 'done',         label: 'Complete',       desc: 'Intelligence pipeline finished' },
];

const STATUS_ORDER = ['queued', 'transcribing', 'structuring', 'summarising', 'done'];

function getStepStatus(stepId, currentStatus) {
  const stepIdx    = STATUS_ORDER.indexOf(stepId);
  const currentIdx = STATUS_ORDER.indexOf(currentStatus);

  if (currentStatus === 'structuring' && stepId === 'summarising') return 'upcoming';
  if (currentIdx >= STATUS_ORDER.indexOf('done') && stepId !== 'done') return 'done';

  if (stepIdx < currentIdx) return 'done';
  if (stepIdx === currentIdx) return 'active';
  return 'upcoming';
}

function StepIcon({ state }) {
  if (state === 'done') {
    return (
      <motion.div
        initial={{ scale: 0 }}
        animate={{ scale: 1 }}
        transition={{ type: 'spring', stiffness: 400, damping: 25 }}
      >
        <CheckCircle2 size={16} className="text-semantic-success" />
      </motion.div>
    );
  }
  if (state === 'active') {
    return <Loader2 size={16} className="text-text-primary animate-spin" />;
  }
  return <Circle size={16} className="text-text-muted opacity-40" />;
}

export default function ProcessingStatus({ status, message }) {
  if (!status || status === 'done') return null;

  const isError = status === 'error';

  if (isError) {
    return (
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        className="card p-5 border-semantic-error/30 bg-semantic-error/5"
      >
        <div className="flex items-center gap-3 mb-1">
          <AlertCircle size={18} className="text-semantic-error shrink-0" />
          <span className="text-semantic-error font-bold text-sm">Processing Failed</span>
        </div>
        {message && (
          <p className="text-semantic-error/80 text-xs pl-7 leading-relaxed">{message}</p>
        )}
      </motion.div>
    );
  }

  const progressPercent =
    status === 'queued'       ? 15  :
    status === 'transcribing' ? 40  :
    status === 'structuring'  ? 75  :
    status === 'done'         ? 100 : 0;

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.98, y: 8 }}
      animate={{ opacity: 1, scale: 1, y: 0 }}
      transition={{ duration: 0.2, ease: 'easeOut' }}
      className="card p-6 shadow-card"
    >
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
          <span>Active</span>
        </div>
      </div>

      {/* Steps */}
      <div className="space-y-3.5">
        {STEPS.map((step, idx) => {
          const state = getStepStatus(step.id, status);
          return (
            <div key={step.id} className="flex items-start gap-3 relative">
              {/* Vertical connector line */}
              {idx < STEPS.length - 1 && (
                <div className="absolute left-[7px] top-5 bottom-0 w-px bg-border-subtle" />
              )}

              <div className="shrink-0 mt-0.5 z-10 bg-surface">
                <StepIcon state={state} />
              </div>

              <div className="flex-1 min-w-0 pb-1">
                <div className="flex items-center justify-between">
                  <p className={`text-xs font-semibold ${
                    state === 'active' ? 'text-text-primary font-bold' :
                    state === 'done'   ? 'text-text-primary' :
                    'text-text-muted'
                  }`}>
                    {step.label}
                  </p>
                  {state === 'active' && (
                    <span className="text-[10px] font-medium text-text-secondary bg-surface-hover px-2 py-0.5 rounded border border-border-default">
                      In progress
                    </span>
                  )}
                  {state === 'done' && (
                    <span className="text-[11px] font-medium text-text-secondary">Done</span>
                  )}
                </div>
                {state === 'active' && (
                  <p className="text-xs text-text-secondary mt-0.5">
                    {step.desc}
                  </p>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Progress track */}
      <div className="mt-5 progress-track">
        <motion.div
          className="progress-fill"
          initial={{ width: 0 }}
          animate={{ width: `${progressPercent}%` }}
          transition={{ duration: 0.3, ease: 'easeInOut' }}
        />
      </div>
    </motion.div>
  );
}
