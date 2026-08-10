/**
 * PostLoginTransition.jsx
 * Unified CMIS Signal Transition presented upon successful authentication.
 * Integrates the Context Intelligence Network in expansion mode.
 */
import { useEffect, useState } from 'react';
import { Brain, CheckCircle2, Sparkles } from 'lucide-react';
import ContextNetwork from './ContextNetwork';

export default function PostLoginTransition({ user, onComplete }) {
  const [stage, setStage] = useState(0); // 0: Auth success, 1: Signal Expansion, 2: Workspace Ready

  useEffect(() => {
    // Stage 0 -> 1 after 300ms
    const t1 = setTimeout(() => setStage(1), 300);
    // Stage 1 -> 2 after 750ms -> Trigger navigate onComplete at ~950ms
    const t2 = setTimeout(() => setStage(2), 750);
    const t3 = setTimeout(() => {
      if (onComplete) onComplete();
    }, 950);

    return () => {
      clearTimeout(t1);
      clearTimeout(t2);
      clearTimeout(t3);
    };
  }, [onComplete]);

  return (
    <div className="fixed inset-0 z-50 bg-black text-white flex flex-col items-center justify-center p-6 transition-opacity duration-300 overflow-hidden">
      {/* Expanding Context Intelligence Network background visual */}
      <ContextNetwork mode="expand" className="z-0 opacity-40" />

      {/* Radial spotlight */}
      <div className="absolute inset-0 pointer-events-none bg-[radial-gradient(circle_at_center,rgba(255,255,255,0.1)_0%,transparent_65%)]" />

      <div className="relative z-10 flex flex-col items-center text-center max-w-sm space-y-6">
        {/* Animated Branded CMIS Logo Icon */}
        <div className="relative">
          <div className="w-16 h-16 rounded-2xl bg-white text-black flex items-center justify-center font-extrabold shadow-[0_0_50px_rgba(255,255,255,0.3)] animate-pulse">
            <Brain size={32} className="text-black" />
          </div>
          <div className="absolute -bottom-1 -right-1 w-6 h-6 rounded-full bg-white text-black flex items-center justify-center shadow-lg border border-black">
            <CheckCircle2 size={14} className="stroke-[3]" />
          </div>
        </div>

        {/* Transition Status Message */}
        <div className="space-y-2">
          <h2 className="text-2xl font-extrabold tracking-tight font-display text-white">
            {stage === 0 && 'Authentication Verified'}
            {stage === 1 && 'Expanding Context Intelligence'}
            {stage >= 2 && 'Welcome to CMIS'}
          </h2>
          <p className="text-xs text-zinc-400 font-medium tracking-wide">
            {user?.name ? `Signed in as ${user.name}` : 'Initializing workspace workspace...'}
          </p>
        </div>

        {/* Progress bar */}
        <div className="w-48 h-1 bg-zinc-800 rounded-full overflow-hidden relative">
          <div
            className="h-full bg-white transition-all duration-400 ease-out rounded-full"
            style={{ width: stage === 0 ? '30%' : stage === 1 ? '75%' : '100%' }}
          />
        </div>

        <div className="flex items-center gap-1.5 text-[11px] text-zinc-400 font-mono tracking-wider">
          <Sparkles size={12} className="text-white animate-spin-slow" />
          <span>CMIS SIGNAL ACTIVE</span>
        </div>
      </div>
    </div>
  );
}
