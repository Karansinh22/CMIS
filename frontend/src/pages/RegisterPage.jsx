/**
 * RegisterPage.jsx — Create account with name, email, password.
 * Strict enterprise monochrome UI.
 */
import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { register } from '../auth';
import { AuthLayout, ErrorBanner, Spinner, SuccessBanner } from './LoginPage';

export default function RegisterPage() {
  const navigate = useNavigate();
  const [form, setForm]       = useState({ name: '', email: '', password: '', confirm: '' });
  const [error, setError]     = useState('');
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
      setError('Password must be at least 8 characters long.');
      return;
    }
    setLoading(true);
    try {
      const { data } = await register(form.name, form.email, form.password);
      setSuccess(data.message || 'Account created! Redirecting to email verification...');
      setTimeout(() => navigate('/verify-email', { state: { email: form.email } }), 1200);
    } catch (err) {
      setError(err.response?.data?.detail || 'Registration failed. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthLayout title="Create Account" subtitle="Start extracting intelligence from your meeting recordings">
      <form onSubmit={handleSubmit} className="space-y-3.5">
        <div>
          <label className="label">Full Name</label>
          <input
            name="name"
            type="text"
            required
            autoFocus
            value={form.name}
            onChange={onChange}
            className="input text-xs"
            placeholder="Jane Smith"
          />
        </div>
        <div>
          <label className="label">Email Address</label>
          <input
            name="email"
            type="email"
            required
            value={form.email}
            onChange={onChange}
            className="input text-xs"
            placeholder="jane@company.com"
          />
        </div>
        <div>
          <label className="label">Password</label>
          <input
            name="password"
            type="password"
            required
            value={form.password}
            onChange={onChange}
            className="input text-xs"
            placeholder="At least 8 characters"
          />
        </div>
        <div>
          <label className="label">Confirm Password</label>
          <input
            name="confirm"
            type="password"
            required
            value={form.confirm}
            onChange={onChange}
            className="input text-xs"
            placeholder="Re-enter password"
          />
        </div>

        {error   && <ErrorBanner   message={error} />}
        {success && <SuccessBanner message={success} />}

        <button
          type="submit"
          disabled={loading}
          className="btn-primary w-full justify-center py-2.5 text-xs font-semibold mt-2"
        >
          {loading ? <Spinner /> : 'Create Account'}
        </button>
      </form>

      <p className="mt-5 text-center text-xs text-text-secondary">
        Already have an account?{' '}
        <Link to="/login" className="text-text-primary font-semibold hover:underline">
          Sign in
        </Link>
      </p>
    </AuthLayout>
  );
}
