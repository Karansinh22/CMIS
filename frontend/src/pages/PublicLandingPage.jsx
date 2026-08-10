/**
 * PublicLandingPage.jsx — Public Welcome & Feature Showcase.
 * Premium Motion System featuring Context Intelligence Network visualization,
 * cinematic intro timeline reveal, and high-impact technical branding.
 * Strict enterprise monochrome aesthetic (Black, White, Gray).
 */
import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import {
  Brain, Zap, Mic, Sparkles, FolderKanban, CheckSquare,
  ShieldCheck, ArrowRight, Sun, Moon, FileText, CheckCircle2,
} from 'lucide-react';
import { useTheme } from '../context/ThemeContext';
import ContextNetwork from '../components/ContextNetwork';

export default function PublicLandingPage() {
  const navigate = useNavigate();
  const { theme, toggleTheme } = useTheme();
  const [animStage, setAnimStage] = useState(0); // 0: Start, 1: Logo, 2: Headline, 3: Subtitle/CTA, 4: Full

  useEffect(() => {
    // Check if reduced motion is preferred
    const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (prefersReducedMotion) {
      setAnimStage(4);
      return;
    }

    // Precise entrance sequence timeline (total ~1.1s)
    const t1 = setTimeout(() => setAnimStage(1), 100);
    const t2 = setTimeout(() => setAnimStage(2), 350);
    const t3 = setTimeout(() => setAnimStage(3), 650);
    const t4 = setTimeout(() => setAnimStage(4), 950);

    return () => {
      clearTimeout(t1);
      clearTimeout(t2);
      clearTimeout(t3);
      clearTimeout(t4);
    };
  }, []);

  const headlineWords = "Convert Spoken Meetings into Structured Action Plans".split(" ");

  return (
    <div className="min-h-screen bg-canvas text-text-primary transition-colors duration-200 overflow-hidden relative">

      {/* ── Abstract Context Intelligence Network Centerpiece Background ── */}
      <ContextNetwork mode="hero" className="z-0 opacity-80" />

      {/* ── Top Header Navigation ── */}
      <header className="sticky top-0 z-50 backdrop-blur-md bg-canvas/85 border-b border-border-layout transition-colors duration-200">
        <div className="max-w-7xl mx-auto px-6 py-4 flex items-center justify-between">
          
          {/* Logo Branding */}
          <div
            onClick={() => navigate('/')}
            className={`flex items-center gap-3.5 cursor-pointer group select-none transition-all duration-500 ${
              animStage >= 1 ? 'opacity-100 translate-y-0' : 'opacity-0 -translate-y-2'
            }`}
          >
            <div className="w-10 h-10 rounded-xl bg-text-primary text-canvas flex items-center justify-center font-extrabold shadow-subtle group-hover:scale-105 transition-transform duration-200">
              <Brain size={22} className="text-canvas" />
            </div>
            <div>
              <span className="font-extrabold text-xl tracking-tight text-text-primary font-display block leading-none">
                CMIS
              </span>
              <span className="block text-[10px] text-text-muted font-mono tracking-widest uppercase mt-0.5">
                MEETING INTELLIGENCE
              </span>
            </div>
          </div>

          {/* Single Primary Action & Mode Switcher */}
          <div className={`flex items-center gap-3 transition-all duration-500 ${
            animStage >= 1 ? 'opacity-100 translate-y-0' : 'opacity-0 -translate-y-2'
          }`}>
            {/* Visual Mode Switcher */}
            <button
              onClick={toggleTheme}
              className="btn-secondary text-xs py-2 px-3 flex items-center gap-2 font-semibold"
              title="Toggle Visual Mode"
            >
              {theme === 'dark' ? <Sun size={14} /> : <Moon size={14} />}
              <span className="hidden sm:inline">{theme === 'dark' ? 'Light Mode' : 'Dark Mode'}</span>
            </button>

            {/* Single Primary Authentication CTA */}
            <button
              onClick={() => navigate('/login')}
              className="btn-primary text-sm py-2.5 px-5 font-bold flex items-center gap-2 group shadow-lg"
            >
              <span>Get Started</span>
              <ArrowRight size={15} className="group-hover:translate-x-1 transition-transform duration-200" />
            </button>
          </div>
        </div>
      </header>

      {/* ── Main Hero Section ── */}
      <section className="relative z-10 pt-16 sm:pt-24 pb-20 px-6 max-w-5xl mx-auto text-center space-y-8">
        
        {/* Animated Brand Mark Entrance Badge */}
        <div className={`transition-all duration-500 transform ${
          animStage >= 1 ? 'opacity-100 translate-y-0 scale-100' : 'opacity-0 -translate-y-4 scale-95'
        }`}>
          <div className="inline-flex items-center gap-2.5 px-4 py-1.5 rounded-full bg-surface-hover border border-border-default text-text-primary text-xs font-bold uppercase tracking-widest shadow-sm">
            <Sparkles size={14} className="text-text-primary" />
            <span>Contextual Meeting Intelligence</span>
          </div>
        </div>

        {/* Hero Headline — Word Reveal */}
        <h1 className="text-4xl sm:text-6xl md:text-7xl font-extrabold text-text-primary tracking-tight leading-[1.08] max-w-4xl mx-auto font-display flex flex-wrap justify-center gap-x-3 gap-y-1 overflow-hidden py-1">
          {headlineWords.map((word, idx) => (
            <span
              key={idx}
              className={`inline-block transition-all duration-500 ease-out transform ${
                animStage >= 2 ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'
              }`}
              style={{ transitionDelay: `${idx * 40}ms` }}
            >
              {word}
            </span>
          ))}
        </h1>

        {/* Hero Description */}
        <p className={`text-text-secondary text-base sm:text-xl max-w-2xl mx-auto leading-relaxed transition-all duration-700 transform ${
          animStage >= 3 ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-6'
        }`}>
          CMIS transcribes multi-speaker audio recordings into verified transcripts, executive summaries, owner-assigned action items, and cumulative project workspaces.
        </p>

        {/* Single Primary CTA Flow */}
        <div className={`flex justify-center pt-2 transition-all duration-700 transform ${
          animStage >= 3 ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-6'
        }`}>
          <button
            onClick={() => navigate('/login')}
            className="btn-primary py-3.5 px-8 text-base font-extrabold flex items-center justify-center gap-3 group shadow-xl hover:scale-[1.02] active:scale-[0.98] transition-all"
          >
            <Zap size={18} />
            <span>Get Started with CMIS</span>
            <ArrowRight size={18} className="group-hover:translate-x-2 transition-transform duration-200" />
          </button>
        </div>

        {/* Feature Points Strip */}
        <div className={`pt-6 flex flex-wrap justify-center items-center gap-8 text-xs sm:text-sm text-text-secondary font-medium transition-all duration-700 ${
          animStage >= 4 ? 'opacity-100' : 'opacity-0'
        }`}>
          <span className="flex items-center gap-2">
            <CheckCircle2 size={16} className="text-semantic-success" /> Whisper Diarization &amp; Transcription
          </span>
          <span className="flex items-center gap-2">
            <CheckCircle2 size={16} className="text-semantic-success" /> Automated Action Item Tracking
          </span>
          <span className="flex items-center gap-2">
            <CheckCircle2 size={16} className="text-semantic-success" /> Cumulative Multi-Meeting Projects
          </span>
        </div>
      </section>

      {/* ── Feature Showcase Section ── */}
      <section className={`relative z-10 py-16 px-6 max-w-6xl mx-auto border-t border-border-subtle space-y-12 transition-all duration-700 ${
        animStage >= 4 ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'
      }`}>
        <div className="text-center max-w-2xl mx-auto space-y-2">
          <h2 className="text-2xl sm:text-4xl font-extrabold text-text-primary tracking-tight font-display">
            Designed for High-Velocity Teams &amp; Leaders
          </h2>
          <p className="text-text-secondary text-sm sm:text-base">
            Capture every key decision, topic thread, and next step with zero manual note-taking overhead.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {[
            {
              title: 'Audio Speech Processing',
              desc: 'Upload MP3, WAV, M4A, and WEBM audio recordings from any device with live status feedback.',
              icon: Mic,
            },
            {
              title: 'Tailored Summaries',
              desc: 'Generate Brief highlights, Balanced overviews, or In-Depth intelligence reports on demand.',
              icon: Sparkles,
            },
            {
              title: 'Action Items & Decisions',
              desc: 'Automatically extracts owner-assigned tasks and key consensus decisions with urgency tagging.',
              icon: CheckSquare,
            },
            {
              title: 'Project Workspaces',
              desc: 'Group recordings by project or client to synthesize cumulative context across multiple sessions.',
              icon: FolderKanban,
            },
            {
              title: 'Editable Transcripts',
              desc: 'Review and edit speaker segments directly with full audit trail history and revision logs.',
              icon: FileText,
            },
            {
              title: 'Locality-Sensitive Hashing',
              desc: 'MinHash LSH index automatically identifies repeating discussion topics across different dates.',
              icon: ShieldCheck,
            },
          ].map((feature) => (
            <div
              key={feature.title}
              className="card card-hover p-6 sm:p-7 flex flex-col justify-between space-y-4"
            >
              <div className="space-y-3">
                <div className="w-11 h-11 rounded-xl border border-border-default bg-surface-hover flex items-center justify-center text-text-primary shadow-sm">
                  <feature.icon size={20} />
                </div>
                <h3 className="text-lg font-bold text-text-primary tracking-tight font-display">
                  {feature.title}
                </h3>
                <p className="text-text-secondary text-xs sm:text-sm leading-relaxed">
                  {feature.desc}
                </p>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* ── Bottom Call To Action ── */}
      <section className={`relative z-10 py-16 px-6 max-w-4xl mx-auto text-center transition-all duration-700 ${
        animStage >= 4 ? 'opacity-100' : 'opacity-0'
      }`}>
        <div className="card p-10 sm:p-14 space-y-6 border border-border-default">
          <h2 className="text-2xl sm:text-4xl font-extrabold text-text-primary tracking-tight font-display">
            Elevate Your Meeting Productivity Today
          </h2>
          <p className="text-text-secondary text-sm sm:text-base max-w-md mx-auto leading-relaxed">
            Experience structured summaries, clear action items, and project workspace organization now.
          </p>
          <div className="flex justify-center pt-2">
            <button
              onClick={() => navigate('/login')}
              className="btn-primary py-3.5 px-8 text-sm sm:text-base font-extrabold flex items-center gap-3 group shadow-xl"
            >
              <Zap size={18} />
              <span>Get Started with CMIS</span>
              <ArrowRight size={16} className="group-hover:translate-x-1.5 transition-transform duration-200" />
            </button>
          </div>
        </div>
      </section>

      {/* ── Footer ── */}
      <footer className="relative z-10 border-t border-border-subtle py-8 px-6 text-center text-xs text-text-muted font-mono uppercase tracking-wider">
        CMIS · CONTEXTUAL MEETING INTELLIGENCE SYSTEM
      </footer>

    </div>
  );
}
