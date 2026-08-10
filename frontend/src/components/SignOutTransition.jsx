/**
 * SignOutTransition.jsx — Unified CMIS Sign-Out Contraction Transition.
 * Smoothly concludes the user session before returning to the public hero page.
 * Uses ContextNetwork in contraction mode for visual continuity.
 */
import { useEffect, useState } from 'react';
import { Brain, LogOut, Shield } from 'lucide-react';
import ContextNetwork from './ContextNetwork';

export default function SignOutTransition({ onComplete }) {
  const [stage, setStage] = useState(0); // 0: Sign out initiated, 1: Session cleared, 2: Complete

  useEffect(() => {
    const t1 = setTimeout(() => setStage(1), 300);
    const t2 = setTimeout(() => setStage(2), 700);
    const t3 = setTimeout(() => {
      if (onComplete) onComplete();
    }, 900);

    return () => {
      clearTimeout(t1);
      clearTimeout(t2);
      clearTimeout(t3);
    };
  }, [onComplete]);

  return (
    <div className="fixed inset-0 z-50 bg-black text-white flex flex-col items-center justify-center p-6 transition-opacity duration-300 overflow-hidden">
      {/* Contracting Context Network background visual */}
      <ContextNetwork mode="contract" className="z-0 opacity-40" />

      {/* Radial spotlight */}
      <div className="absolute inset-0 pointer-events-none bg-[radial-gradient(circle_at_center,rgba(255,255,255,0.08)_0%,transparent_65%)]" />

      <div className="relative z-10 flex flex-col items-center text-center max-w-sm space-y-6">
        {/* Animated Branded Icon */}
        <div className="relative">
          <div className="w-16 h-16 rounded-2xl bg-white text-black flex items-center justify-center font-extrabold shadow-[0_0_50px_rgba(255,255,255,0.25)] animate-pulse">
            <Brain size={32} className="text-black" />
          </div>
          <div className="absolute -bottom-1 -right-1 w-6 h-6 rounded-full bg-zinc-800 text-white flex items-center justify-center border border-zinc-700">
            <LogOut size={12} />
          </div>
        </div>

        {/* Transition Status Message */}
        <div className="space-y-2">
          <h2 className="text-2xl font-extrabold tracking-tight font-display text-white">
            {stage === 0 && 'Signing Out...'}
            {stage === 1 && 'Session Safely Concluded'}
            {stage >= 2 && 'Returning to CMIS'}
          </h2>
          <p className="text-xs text-zinc-400 font-medium tracking-wide">
            Clearing local credentials and resetting workspace state...
          </p>
        </div>

        {/* Progress bar */}
        <div className="w-48 h-1 bg-zinc-800 rounded-full overflow-hidden relative">
          <div
            className="h-full bg-white transition-all duration-300 ease-out rounded-full"
            style={{ width: stage === 0 ? '40%' : stage === 1 ? '85%' : '100%' }}
          />
        </div>

        <div className="flex items-center gap-1.5 text-[11px] text-zinc-400 font-mono tracking-wider">
          <Shield size={12} className="text-zinc-300" />
          <span>SECURE DISCONNECT</span>
        </div>
      </div>
    </div>
  );
}
