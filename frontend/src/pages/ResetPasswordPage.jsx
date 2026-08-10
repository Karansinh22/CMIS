/**
 * ResetPasswordPage.jsx — Enter OTP and set new password.
 * Strict enterprise monochrome UI.
 */
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { resetPassword } from '../auth';
import { AuthLayout, ErrorBanner, Spinner, SuccessBanner } from './LoginPage';

export default function ResetPasswordPage({ prefillEmail = '' }) {
  const navigate = useNavigate();
  const [form, setForm]       = useState({ email: prefillEmail, otp: '', password: '', confirm: '' });
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
      const { data } = await resetPassword(form.email, form.otp, form.password);
      setSuccess(data.message || 'Password reset successfully! Redirecting...');
      setTimeout(() => navigate('/login'), 1500);
    } catch (err) {
      setError(err.response?.data?.detail || 'Password reset failed. Please check OTP.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthLayout title="Choose New Password" subtitle="Enter the 6-digit code sent to your email">
      <form onSubmit={handleSubmit} className="space-y-3.5">
        {!prefillEmail && (
          <div>
            <label className="label">Email Address</label>
            <input
              name="email"
              type="email"
              required
              value={form.email}
              onChange={onChange}
              className="input text-xs"
              placeholder="you@company.com"
            />
          </div>
        )}

        <div>
          <label className="label">6-Digit OTP</label>
          <input
            name="otp"
            type="text"
            inputMode="numeric"
            maxLength={6}
            required
            value={form.otp}
            onChange={onChange}
            className="input text-center text-lg font-mono font-bold tracking-widest"
            placeholder="000000"
          />
        </div>

        <div>
          <label className="label">New Password</label>
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
          <label className="label">Confirm New Password</label>
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
          {loading ? <Spinner /> : 'Save New Password'}
        </button>
      </form>
    </AuthLayout>
  );
}
