/**
 * LoginPage.jsx — Authentication login page.
 * Strict enterprise monochrome UI with theme support.
 */
import { useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { Brain, Sun, Moon, AlertCircle, CheckCircle2 } from 'lucide-react';
import { login, saveTokens } from '../auth';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';

export default function LoginPage() {
  const navigate   = useNavigate();
  const location   = useLocation();
  const { refetchUser } = useAuth();
  const from = location.state?.from?.pathname || '/';

  const [form, setForm]     = useState({ email: '', password: '' });
  const [error, setError]   = useState('');
  const [loading, setLoading] = useState(false);

  const onChange = (e) => setForm((p) => ({ ...p, [e.target.name]: e.target.value }));

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const { data } = await login(form.email, form.password);
      saveTokens(data.access_token, data.refresh_token);
      await refetchUser();
      navigate(from, { replace: true });
    } catch (err) {
      const msg = err.response?.data?.detail || 'Invalid email or password. Please try again.';
      setError(msg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthLayout title="Sign In" subtitle="Access your meeting intelligence dashboard">
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="label">Email Address</label>
          <input
            name="email"
            type="email"
            required
            autoFocus
            value={form.email}
            onChange={onChange}
            className="input text-xs"
            placeholder="you@company.com"
          />
        </div>
        <div>
          <div className="flex items-center justify-between mb-1.5">
            <label className="label mb-0">Password</label>
            <Link to="/forgot-password" className="text-xs text-text-secondary hover:text-text-primary underline">
              Forgot password?
            </Link>
          </div>
          <input
            name="password"
            type="password"
            required
            value={form.password}
            onChange={onChange}
            className="input text-xs"
            placeholder="••••••••"
          />
        </div>

        {error && <ErrorBanner message={error} />}

        <button
          type="submit"
          disabled={loading}
          className="btn-primary w-full justify-center py-2.5 text-xs font-semibold mt-2"
        >
          {loading ? <Spinner /> : 'Sign In'}
        </button>
      </form>

      <p className="mt-6 text-center text-xs text-text-secondary">
        Don't have an account?{' '}
        <Link to="/register" className="text-text-primary font-semibold hover:underline">
          Create an account
        </Link>
      </p>
    </AuthLayout>
  );
}

// ── Shared Sub-components for Auth Flow ──────────────────────────────────────

export function AuthLayout({ title, subtitle, children }) {
  const { theme, toggleTheme } = useTheme();

  return (
    <div className="min-h-screen bg-canvas text-text-primary flex items-center justify-center p-4 relative transition-colors duration-200">
      {/* Top right theme toggle */}
      <div className="absolute top-5 right-5 z-20">
        <button
          onClick={toggleTheme}
          className="btn-secondary text-xs py-1.5 px-3 flex items-center gap-2"
          title="Toggle Visual Mode"
        >
          {theme === 'dark' ? <Sun size={14} /> : <Moon size={14} />}
          <span className="hidden sm:inline">{theme === 'dark' ? 'Light Mode' : 'Dark Mode'}</span>
        </button>
      </div>

      <div className="w-full max-w-sm relative z-10 space-y-6">
        {/* Brand Logo */}
        <div className="flex flex-col items-center justify-center text-center space-y-2">
          <div className="w-10 h-10 rounded-lg bg-text-primary text-canvas flex items-center justify-center font-bold">
            <Brain size={20} />
          </div>
          <div>
            <h2 className="text-lg font-extrabold tracking-tight text-text-primary">CMIS</h2>
            <p className="text-[10px] uppercase font-mono tracking-widest text-text-muted">Contextual Meeting Intelligence</p>
          </div>
        </div>

        {/* Auth Card */}
        <div className="card p-6 shadow-modal space-y-4">
          <div className="pb-2 border-b border-border-subtle">
            <h1 className="text-base font-bold text-text-primary">{title}</h1>
            <p className="text-xs text-text-secondary mt-0.5">{subtitle}</p>
          </div>
          {children}
        </div>
      </div>
    </div>
  );
}

export function Spinner() {
  return <div className="w-4 h-4 border-2 border-canvas border-t-transparent rounded-full animate-spin" />;
}

export function ErrorBanner({ message }) {
  return (
    <div className="flex items-start gap-2 bg-semantic-error/10 border border-semantic-error/30 rounded-lg p-3 text-xs text-semantic-error">
      <AlertCircle size={14} className="mt-0.5 shrink-0" />
      <span>{message}</span>
    </div>
  );
}

export function SuccessBanner({ message }) {
  return (
    <div className="flex items-start gap-2 bg-semantic-success/10 border border-semantic-success/30 rounded-lg p-3 text-xs text-semantic-success">
      <CheckCircle2 size={14} className="mt-0.5 shrink-0" />
      <span>{message}</span>
    </div>
  );
}
