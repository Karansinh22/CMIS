/**
 * RegisterPage.jsx — Create account with name, email, password.
 * On success routes to /verify-email with the email pre-filled.
 */
import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { register } from '../auth';
import { AuthLayout, ErrorBanner, Spinner, SuccessBanner } from './LoginPage';

export default function RegisterPage() {
  const navigate = useNavigate();
  const [form, setForm]     = useState({ name: '', email: '', password: '', confirm: '' });
  const [error, setError]   = useState('');
  const [success, setSuccess] = useState('');
  const [loading, setLoading] = useState(false);

  const onChange = (e) => setForm((p) => ({ ...p, [e.target.name]: e.target.value }));

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    if (form.password !== form.confirm) {
      setError('Passwords do not match.');
      return;
    }
    if (form.password.length < 8) {
      setError('Password must be at least 8 characters.');
      return;
    }
    setLoading(true);
    try {
      const { data } = await register(form.name, form.email, form.password);
      setSuccess(data.message);
      setTimeout(() => navigate('/verify-email', { state: { email: form.email } }), 1500);
    } catch (err) {
      setError(err.response?.data?.detail || 'Registration failed. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthLayout title="Create your account" subtitle="Start transforming your meetings with AI">
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="block text-sm text-white/60 mb-1.5">Full Name</label>
          <input
            name="name" type="text" required autoFocus
            value={form.name} onChange={onChange}
            className="input" placeholder="Jane Smith"
          />
        </div>
        <div>
          <label className="block text-sm text-white/60 mb-1.5">Email</label>
          <input
            name="email" type="email" required
            value={form.email} onChange={onChange}
            className="input" placeholder="jane@example.com"
          />
        </div>
        <div>
          <label className="block text-sm text-white/60 mb-1.5">Password</label>
          <input
            name="password" type="password" required
            value={form.password} onChange={onChange}
            className="input" placeholder="At least 8 characters"
          />
        </div>
        <div>
          <label className="block text-sm text-white/60 mb-1.5">Confirm Password</label>
          <input
            name="confirm" type="password" required
            value={form.confirm} onChange={onChange}
            className="input" placeholder="••••••••"
          />
        </div>

        {error   && <ErrorBanner   message={error} />}
        {success && <SuccessBanner message={success} />}

        <button type="submit" disabled={loading} className="btn-primary w-full justify-center py-3 text-base mt-2">
          {loading ? <Spinner /> : 'Create Account'}
        </button>
      </form>

      <p className="mt-6 text-center text-sm text-white/40">
        Already have an account?{' '}
        <Link to="/login" className="text-brand-400 hover:text-brand-300 font-medium transition-colors">
          Sign in
        </Link>
      </p>
    </AuthLayout>
  );
}
