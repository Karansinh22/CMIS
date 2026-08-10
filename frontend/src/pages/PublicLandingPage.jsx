/**
 * PublicLandingPage.jsx — Public Welcome & Feature Showcase.
 * Strict enterprise monochrome aesthetic supporting both light and dark visual modes.
 */
import { useNavigate } from 'react-router-dom';
import {
  Brain, Zap, Mic, Sparkles, FolderKanban, CheckSquare,
  ShieldCheck, ArrowRight, Sun, Moon, FileText, ChevronRight, CheckCircle2,
} from 'lucide-react';
import { useTheme } from '../context/ThemeContext';

export default function PublicLandingPage() {
  const navigate = useNavigate();
  const { theme, toggleTheme } = useTheme();

  return (
    <div className="min-h-screen bg-canvas text-text-primary transition-colors duration-200">

      {/* ── Top Header Navigation ── */}
      <header className="sticky top-0 z-50 backdrop-blur-md bg-canvas/90 border-b border-border-subtle transition-colors duration-200">
        <div className="max-w-7xl mx-auto px-6 py-3.5 flex items-center justify-between">
          <div
            onClick={() => navigate('/')}
            className="flex items-center gap-3 cursor-pointer group"
          >
            <div className="w-8 h-8 rounded-lg bg-text-primary text-canvas flex items-center justify-center font-bold">
              <Brain size={18} />
            </div>
            <div>
              <span className="font-extrabold text-base tracking-tight text-text-primary">
                CMIS
              </span>
              <span className="block text-[9px] text-text-muted font-mono tracking-wider">
                MEETING INTELLIGENCE
              </span>
            </div>
          </div>

          <div className="flex items-center gap-3">
            {/* Visual Mode Switcher */}
            <button
              onClick={toggleTheme}
              className="btn-secondary text-xs py-1.5 px-3 flex items-center gap-2"
              title="Toggle Mode"
            >
              {theme === 'dark' ? <Sun size={13} /> : <Moon size={13} />}
              <span className="hidden sm:inline">{theme === 'dark' ? 'Light Mode' : 'Dark Mode'}</span>
            </button>

            <button
              onClick={() => navigate('/login')}
              className="btn-ghost text-xs py-1.5 px-3 font-semibold"
            >
              Sign In
            </button>

            {/* Primary CTA */}
            <button
              onClick={() => navigate('/login')}
              className="btn-primary text-xs py-1.5 px-4 font-bold flex items-center gap-1.5"
            >
              <span>Get Started</span>
              <ArrowRight size={13} />
            </button>
          </div>
        </div>
      </header>

      {/* ── Main Hero Section ── */}
      <section className="relative pt-20 pb-20 px-6 max-w-5xl mx-auto text-center space-y-7">
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-surface-hover border border-border-default text-text-primary text-xs font-semibold uppercase tracking-wider">
          <Sparkles size={13} />
          <span>Contextual Meeting Intelligence</span>
        </div>

        <h1 className="text-4xl sm:text-6xl md:text-7xl font-extrabold text-text-primary tracking-tight leading-[1.08] max-w-4xl mx-auto">
          Convert Spoken Meetings into Structured Action Plans
        </h1>

        <p className="text-text-secondary text-base sm:text-lg max-w-2xl mx-auto leading-relaxed">
          CMIS transcribes multi-speaker audio recordings into verified transcripts, executive summaries, owner-assigned action items, and cumulative project workspaces.
        </p>

        {/* Hero Actions */}
        <div className="flex flex-col sm:flex-row items-center justify-center gap-3 pt-2">
          <button
            onClick={() => navigate('/login')}
            className="w-full sm:w-auto btn-primary py-3 px-6 text-sm font-bold flex items-center justify-center gap-2"
          >
            <Zap size={16} />
            <span>Launch Workspace</span>
            <ChevronRight size={16} />
          </button>

          <button
            onClick={() => navigate('/register')}
            className="w-full sm:w-auto btn-secondary py-3 px-6 text-sm font-semibold"
          >
            Create Free Account
          </button>
        </div>

        {/* Feature Points Strip */}
        <div className="pt-8 flex flex-wrap justify-center items-center gap-6 text-xs text-text-secondary font-medium">
          <span className="flex items-center gap-1.5">
            <CheckCircle2 size={14} className="text-semantic-success" /> Whisper Diarization &amp; Transcription
          </span>
          <span className="flex items-center gap-1.5">
            <CheckCircle2 size={14} className="text-semantic-success" /> Automated Action Item Tracking
          </span>
          <span className="flex items-center gap-1.5">
            <CheckCircle2 size={14} className="text-semantic-success" /> Cumulative Multi-Meeting Projects
          </span>
        </div>
      </section>

      {/* ── Feature Showcase Section ── */}
      <section className="py-16 px-6 max-w-6xl mx-auto border-t border-border-subtle space-y-12">
        <div className="text-center max-w-2xl mx-auto space-y-1.5">
          <h2 className="text-2xl sm:text-3xl font-extrabold text-text-primary tracking-tight">
            Designed for High-Velocity Teams &amp; Leaders
          </h2>
          <p className="text-text-secondary text-xs sm:text-sm">
            Capture every key decision, topic thread, and next step with zero manual note-taking overhead.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
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
              className="card card-hover p-6 flex flex-col justify-between space-y-4"
            >
              <div className="space-y-3">
                <div className="w-10 h-10 rounded-lg border border-border-default bg-surface-hover flex items-center justify-center text-text-primary">
                  <feature.icon size={18} />
                </div>
                <h3 className="text-base font-bold text-text-primary tracking-tight">
                  {feature.title}
                </h3>
                <p className="text-text-secondary text-xs leading-relaxed">
                  {feature.desc}
                </p>
              </div>

              <div className="pt-2">
                <button
                  onClick={() => navigate('/login')}
                  className="text-xs font-semibold text-text-primary hover:underline flex items-center gap-1"
                >
                  <span>Explore feature</span>
                  <ChevronRight size={13} />
                </button>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* ── Bottom Call To Action ── */}
      <section className="py-16 px-6 max-w-4xl mx-auto text-center">
        <div className="card p-10 sm:p-12 space-y-5">
          <h2 className="text-2xl sm:text-3xl font-extrabold text-text-primary tracking-tight">
            Elevate Your Meeting Productivity Today
          </h2>
          <p className="text-text-secondary text-xs sm:text-sm max-w-md mx-auto leading-relaxed">
            Experience structured summaries, clear action items, and project workspace organization now.
          </p>
          <div className="flex justify-center pt-2">
            <button
              onClick={() => navigate('/login')}
              className="btn-primary py-3 px-8 text-xs sm:text-sm font-bold flex items-center gap-2"
            >
              <Zap size={16} />
              <span>Get Started with CMIS</span>
              <ArrowRight size={14} />
            </button>
          </div>
        </div>
      </section>

      {/* ── Footer ── */}
      <footer className="border-t border-border-subtle py-8 px-6 text-center text-xs text-text-muted font-mono">
        CMIS · Contextual Meeting Intelligence System
      </footer>

    </div>
  );
}
