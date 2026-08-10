/**
 * LoginPage.jsx — Authentication login page with post-login workspace transition.
 * Strict enterprise monochrome UI with theme support.
 */
import { useState, useEffect } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { Brain, Sun, Moon, AlertCircle } from 'lucide-react';
import { login, saveTokens } from '../auth';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import PostLoginTransition from '../components/PostLoginTransition';

export default function LoginPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const { user, refetchUser } = useAuth();
  const from = location.state?.from?.pathname || '/';

  const [form, setForm] = useState({ email: '', password: '' });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [showSuccessTransition, setShowSuccessTransition] = useState(false);
  const [authedUser, setAuthedUser] = useState(null);

  // If already logged in, redirect straight to dashboard
  useEffect(() => {
    if (user && !showSuccessTransition) {
      navigate('/', { replace: true });
    }
  }, [user, navigate, showSuccessTransition]);

  const onChange = (e) => setForm((p) => ({ ...p, [e.target.name]: e.target.value }));

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const { data } = await login(form.email, form.password);
      saveTokens(data.access_token, data.refresh_token);
      const res = await refetchUser();
      setAuthedUser(res?.data || null);
      // Trigger post-login animation transition
      setShowSuccessTransition(true);
    } catch (err) {
      const msg = err.response?.data?.detail || 'Invalid email or password. Please try again.';
      setError(msg);
      setLoading(false);
    }
  };

  const handleTransitionComplete = () => {
    navigate(from, { replace: true });
  };

  if (showSuccessTransition) {
    return <PostLoginTransition user={authedUser || user} onComplete={handleTransitionComplete} />;
  }

  return (
    <AuthLayout title="Sign In" subtitle="Access your contextual meeting intelligence workspace">
      <form onSubmit={handleSubmit} className="space-y-5">
        <div>
          <label className="label text-sm font-bold">Email Address</label>
          <input
            name="email"
            type="email"
            required
            autoFocus
            value={form.email}
            onChange={onChange}
            className="input text-base"
            placeholder="you@company.com"
          />
        </div>
        <div>
          <div className="flex items-center justify-between mb-2">
            <label className="label text-sm font-bold mb-0">Password</label>
            <Link to="/forgot-password" className="text-sm text-text-secondary hover:text-text-primary underline">
              Forgot password?
            </Link>
          </div>
          <input
            name="password"
            type="password"
            required
            value={form.password}
            onChange={onChange}
            className="input text-base"
            placeholder="••••••••"
          />
        </div>

        {error && <ErrorBanner message={error} />}

        <button
          type="submit"
          disabled={loading}
          className="btn-primary w-full justify-center text-base font-extrabold h-[52px] mt-2 shadow-lg"
        >
          {loading ? <Spinner /> : 'Sign In to CMIS'}
        </button>
      </form>

      <p className="pt-2 text-center text-sm text-text-secondary font-medium">
        Don't have an account?{' '}
        <Link to="/register" className="font-bold text-text-primary hover:underline">
          Create one now
        </Link>
      </p>
    </AuthLayout>
  );
}

// ── Shared sub-components ─────────────────────────────────────────────────────

export function AuthLayout({ title, subtitle, children }) {
  const { theme, toggleTheme } = useTheme();
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-canvas text-text-primary flex items-center justify-center p-4 sm:p-6 relative overflow-hidden transition-colors duration-200">
      {/* Top right theme toggle */}
      <div className="absolute top-6 right-6 z-20">
        <button
          onClick={toggleTheme}
          className="btn-secondary text-sm py-2 px-4 flex items-center gap-2 font-semibold"
          title="Toggle Visual Theme"
        >
          {theme === 'dark' ? <Sun size={16} /> : <Moon size={16} />}
          <span className="hidden sm:inline">{theme === 'dark' ? 'Light Mode' : 'Dark Mode'}</span>
        </button>
      </div>

      <div className="w-full max-w-[500px] relative z-10 py-8">
        {/* Logo Branding */}
        <div className="flex justify-center mb-8">
          <div
            onClick={() => navigate('/')}
            className="flex items-center gap-3.5 cursor-pointer group"
          >
            <div className="w-14 h-14 rounded-2xl bg-text-primary text-canvas flex items-center justify-center font-extrabold shadow-lg group-hover:scale-105 transition-transform duration-200">
              <Brain size={28} className="text-canvas" />
            </div>
            <div>
              <span className="text-3xl font-extrabold text-text-primary tracking-tight font-display block leading-none">CMIS</span>
              <span className="text-xs text-text-muted font-mono tracking-widest uppercase block mt-1">MEETING INTELLIGENCE</span>
            </div>
          </div>
        </div>

        {/* Large Auth Card */}
        <div className="card p-8 sm:p-12 border border-border-default shadow-2xl rounded-2xl space-y-6">
          <div className="space-y-1.5 text-center sm:text-left">
            <h1 className="text-2xl sm:text-3xl font-extrabold text-text-primary tracking-tight font-display">{title}</h1>
            <p className="text-text-secondary text-sm sm:text-base leading-relaxed">{subtitle}</p>
          </div>
          {children}
        </div>
      </div>
    </div>
  );
}

export function Spinner() {
  return (
    <div className="flex items-center gap-2">
      <div className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin" />
      <span>Authenticating...</span>
    </div>
  );
}

export function ErrorBanner({ message }) {
  return (
    <div className="flex items-start gap-2.5 p-3 rounded-xl bg-semantic-error/10 border border-semantic-error/20 text-xs text-semantic-error font-medium">
      <AlertCircle size={15} className="mt-0.5 shrink-0" />
      <span>{message}</span>
    </div>
  );
}

export function SuccessBanner({ message }) {
  return (
    <div className="flex items-start gap-2.5 p-3 rounded-xl bg-semantic-success/10 border border-semantic-success/20 text-xs text-semantic-success font-medium">
      <AlertCircle size={15} className="mt-0.5 shrink-0 rotate-180" />
      <span>{message}</span>
    </div>
  );
}
