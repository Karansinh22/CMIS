/**
 * LoginPage.jsx — Slick dark-mode login with email + password.
 */
import { useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { login, saveTokens } from '../auth';
import { useAuth } from '../context/AuthContext';

export default function LoginPage() {
  const navigate   = useNavigate();
  const location   = useLocation();
  const { setUser, refetchUser } = useAuth();
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
      const msg = err.response?.data?.detail || 'Login failed. Please try again.';
      setError(msg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthLayout title="Welcome back" subtitle="Sign in to your CMIS account">
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="block text-sm text-white/60 mb-1.5">Email</label>
          <input
            name="email" type="email" required autoFocus
            value={form.email} onChange={onChange}
            className="input"
            placeholder="you@example.com"
          />
        </div>
        <div>
          <div className="flex items-center justify-between mb-1.5">
            <label className="block text-sm text-white/60">Password</label>
            <Link to="/forgot-password" className="text-xs text-brand-400 hover:text-brand-300 transition-colors">
              Forgot password?
            </Link>
          </div>
          <input
            name="password" type="password" required
            value={form.password} onChange={onChange}
            className="input"
            placeholder="••••••••"
          />
        </div>

        {error && <ErrorBanner message={error} />}

        <button type="submit" disabled={loading} className="btn-primary w-full justify-center py-3 text-base mt-2">
          {loading ? <Spinner /> : 'Sign In'}
        </button>
      </form>

      <p className="mt-6 text-center text-sm text-white/40">
        Don't have an account?{' '}
        <Link to="/register" className="text-brand-400 hover:text-brand-300 font-medium transition-colors">
          Create one
        </Link>
      </p>
    </AuthLayout>
  );
}

// ── Shared sub-components ─────────────────────────────────────────────────────

export function AuthLayout({ title, subtitle, children }) {
  return (
    <div className="min-h-screen bg-surface flex items-center justify-center p-4 relative overflow-hidden">
      {/* Decorative orbs */}
      <div className="fixed inset-0 pointer-events-none">
        <div className="absolute w-96 h-96 bg-brand-600 -top-32 -left-32 rounded-full blur-3xl opacity-20" />
        <div className="absolute w-72 h-72 bg-purple-600 top-1/2 -right-20 rounded-full blur-3xl opacity-10" />
        <div className="absolute w-64 h-64 bg-cyan-500 bottom-0 left-1/3 rounded-full blur-3xl opacity-10" />
      </div>

      <div className="w-full max-w-md relative z-10">
        {/* Logo */}
        <div className="flex justify-center mb-8">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-brand-500 to-purple-600 flex items-center justify-center shadow-glow-brand">
              <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                  d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
              </svg>
            </div>
            <span className="text-xl font-bold text-white tracking-tight">CMIS</span>
          </div>
        </div>

        <div className="glass p-8 shadow-card-hover">
          <h1 className="text-2xl font-bold text-white mb-1">{title}</h1>
          <p className="text-white/40 text-sm mb-6">{subtitle}</p>
          {children}
        </div>
      </div>
    </div>
  );
}

export function Spinner() {
  return <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />;
}

export function ErrorBanner({ message }) {
  return (
    <div className="flex items-start gap-2.5 bg-red-500/10 border border-red-500/20 rounded-xl px-4 py-3 text-sm text-red-300">
      <svg className="w-4 h-4 mt-0.5 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
      </svg>
      {message}
    </div>
  );
}

export function SuccessBanner({ message }) {
  return (
    <div className="flex items-start gap-2.5 bg-emerald-500/10 border border-emerald-500/20 rounded-xl px-4 py-3 text-sm text-emerald-300">
      <svg className="w-4 h-4 mt-0.5 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
      </svg>
      {message}
    </div>
  );
}
