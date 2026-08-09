/**
 * ProcessingStatus.jsx — Live animated pipeline status display.
 * Built with Framer Motion for smooth, fast, organic micro-interactions.
 */
import { motion } from 'framer-motion';
import { CheckCircle2, Loader2, Circle, AlertCircle, Zap } from 'lucide-react';

const STEPS = [
  { id: 'queued',       label: 'Queued',        desc: 'Waiting for worker allocation'      },
  { id: 'transcribing', label: 'Transcribing',   desc: 'Converting speech audio to text'    },
  { id: 'structuring',  label: 'Analysing NLP',  desc: 'Extracting topics, decisions & tasks' },
  { id: 'summarising',  label: 'Summarising',    desc: 'Generating TF-IDF intelligence'     },
  { id: 'done',         label: 'Complete',       desc: 'Intelligence pipeline finished'      },
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
        <CheckCircle2 size={16} className="text-emerald-400" />
      </motion.div>
    );
  }
  if (state === 'active') {
    return (
      <div className="relative flex items-center justify-center">
        <motion.span
          className="absolute inset-0 rounded-full bg-brand-500/40"
          animate={{ scale: [1, 1.6, 1], opacity: [0.6, 0, 0.6] }}
          transition={{ duration: 1.5, repeat: Infinity, ease: 'easeInOut' }}
        />
        <Loader2 size={16} className="text-brand-400 animate-spin relative z-10" />
      </div>
    );
  }
  return <Circle size={16} className="text-white/20" />;
}

export default function ProcessingStatus({ status, message }) {
  if (!status || status === 'done') return null;

  const isError = status === 'error';

  if (isError) {
    return (
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        className="glass p-5 border border-red-500/30 bg-red-500/5 rounded-2xl"
      >
        <div className="flex items-center gap-3 mb-2">
          <AlertCircle size={18} className="text-red-400 shrink-0" />
          <span className="text-red-400 font-bold text-sm">Processing Failed</span>
        </div>
        {message && (
          <p className="text-red-400/80 text-xs pl-7 leading-relaxed">{message}</p>
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
      initial={{ opacity: 0, scale: 0.98, y: 12 }}
      animate={{ opacity: 1, scale: 1, y: 0 }}
      transition={{ duration: 0.25, ease: 'easeOut' }}
      className="glass p-6 rounded-3xl border border-brand-500/20 bg-gradient-aurora shadow-card"
    >
      {/* Header */}
      <div className="flex items-center gap-3 mb-6">
        <div className="w-9 h-9 rounded-xl bg-brand-500/20 border border-brand-500/30 flex items-center justify-center text-brand-300">
          <Zap size={18} />
        </div>
        <div>
          <p className="text-base font-bold text-white tracking-tight">Real-time NLP Pipeline</p>
          {message && <p className="text-xs text-white/50 mt-0.5">{message}</p>}
        </div>
        <div className="ml-auto flex items-center gap-1.5 px-3 py-1 rounded-full bg-brand-500/15 border border-brand-500/25">
          <span className="w-2 h-2 rounded-full bg-brand-400 animate-pulse" />
          <span className="text-[11px] font-bold text-brand-300 uppercase tracking-wider">Processing</span>
        </div>
      </div>

      {/* Steps */}
      <div className="space-y-3">
        {STEPS.map((step, idx) => {
          const state = getStepStatus(step.id, status);
          return (
            <motion.div
              key={step.id}
              layout
              className="flex items-start gap-3.5 relative"
            >
              {/* Line */}
              {idx < STEPS.length - 1 && (
                <div className="absolute left-[7px] top-6 bottom-0 w-0.5 bg-white/10" />
              )}

              <div className="shrink-0 mt-0.5 z-10">
                <StepIcon state={state} />
              </div>

              <div className="flex-1 min-w-0 pb-1">
                <div className="flex items-center justify-between">
                  <p className={`text-xs font-bold transition-colors ${
                    state === 'active'   ? 'text-brand-300 text-sm' :
                    state === 'done'     ? 'text-emerald-400' :
                    'text-white/30'
                  }`}>
                    {step.label}
                  </p>
                  {state === 'active' && (
                    <motion.span
                      animate={{ opacity: [0.6, 1, 0.6] }}
                      transition={{ duration: 1.2, repeat: Infinity }}
                      className="text-[10px] font-bold uppercase tracking-wider text-brand-300 bg-brand-500/20 px-2 py-0.5 rounded-full border border-brand-500/30"
                    >
                      Active
                    </motion.span>
                  )}
                  {state === 'done' && (
                    <span className="text-[11px] font-semibold text-emerald-400/80">✓ Completed</span>
                  )}
                </div>
                {state === 'active' && (
                  <motion.p
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: 'auto' }}
                    className="text-xs text-white/60 mt-0.5"
                  >
                    {step.desc}
                  </motion.p>
                )}
              </div>
            </motion.div>
          );
        })}
      </div>

      {/* Animated progress bar */}
      <div className="mt-5 progress-track relative overflow-hidden h-2.5 bg-white/10 rounded-full">
        <motion.div
          className="h-full bg-gradient-brand rounded-full"
          initial={{ width: 0 }}
          animate={{ width: `${progressPercent}%` }}
          transition={{ duration: 0.35, ease: 'easeInOut' }}
        />
      </div>
    </motion.div>
  );
}
