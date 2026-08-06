/**
 * ProcessingStatus.jsx — Animated progress pipeline for a processing meeting.
 * Shows the 4 stages: queued → transcribing → structuring → done.
 */
import { CheckCircle, Circle, Loader } from 'lucide-react';

const STAGES = ['queued', 'transcribing', 'structuring', 'done'];

function stageIndex(status) {
  const idx = STAGES.indexOf(status);
  return idx === -1 ? 0 : idx;
}

export default function ProcessingStatus({ status, message }) {
  const current = stageIndex(status);
  const isError = status === 'error';

  return (
    <div className="glass p-6 animate-fade-in">
      <p className="section-title mb-4">Processing Pipeline</p>

      <div className="flex items-center justify-between">
        {STAGES.map((stage, i) => {
          const done    = i < current || status === 'done';
          const active  = i === current && status !== 'done';
          const pending = i > current && status !== 'done';

          return (
            <div key={stage} className="flex-1 flex flex-col items-center gap-2">
              {/* Icon */}
              <div className={`relative w-8 h-8 rounded-full flex items-center justify-center
                ${done   ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30' : ''}
                ${active ? 'bg-brand-600/20 text-brand-400 border border-brand-500/30 animate-pulse-slow' : ''}
                ${pending || isError ? 'bg-white/5 text-white/20 border border-white/10' : ''}
              `}>
                {done   && <CheckCircle size={16} />}
                {active && <Loader size={16} className="animate-spin" />}
                {pending && <Circle size={16} />}
                {isError && i === current && <span className="text-red-400 text-xs">✕</span>}
              </div>

              {/* Label */}
              <span className={`text-[10px] font-medium capitalize
                ${done   ? 'text-emerald-400' : ''}
                ${active ? 'text-brand-300' : ''}
                ${pending ? 'text-white/20' : ''}
              `}>
                {stage}
              </span>

              {/* Connector line */}
              {i < STAGES.length - 1 && (
                <div className="absolute" style={{ display: 'none' }} />
              )}
            </div>
          );
        })}
      </div>

      {/* Connector bar */}
      <div className="relative mt-[-36px] mb-6 mx-4 h-0.5 bg-white/5">
        <div
          className="h-full bg-gradient-brand transition-all duration-700 rounded-full"
          style={{ width: `${Math.min((current / (STAGES.length - 1)) * 100, 100)}%` }}
        />
      </div>

      {/* Message */}
      {message && (
        <p className={`text-sm mt-2 text-center ${isError ? 'text-red-400' : 'text-white/50'}`}>
          {message}
        </p>
      )}
    </div>
  );
}
