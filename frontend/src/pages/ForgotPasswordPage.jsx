/**
 * ForgotPasswordPage.jsx — Request OTP for password reset.
 * Strict enterprise monochrome UI.
 */
import { useState } from 'react';
import { Link } from 'react-router-dom';
import { forgotPassword } from '../auth';
import { AuthLayout, ErrorBanner, Spinner, SuccessBanner } from './LoginPage';
import ResetPasswordPage from './ResetPasswordPage';

export default function ForgotPasswordPage() {
  const [email, setEmail]     = useState('');
  const [sent, setSent]       = useState(false);
  const [error, setError]     = useState('');
  const [success, setSuccess] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const { data } = await forgotPassword(email);
      setSuccess(data.message || 'OTP sent successfully.');
      setSent(true);
    } catch {
      setError('Failed to send reset OTP. Please verify your email.');
    } finally {
      setLoading(false);
    }
  };

  if (sent) return <ResetPasswordPage prefillEmail={email} />;

  return (
    <AuthLayout title="Reset Password" subtitle="We'll send a 6-digit verification code to your email">
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="label">Email Address</label>
          <input
            type="email"
            required
            autoFocus
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="input text-xs"
            placeholder="you@company.com"
          />
        </div>

        {error   && <ErrorBanner   message={error} />}
        {success && <SuccessBanner message={success} />}

        <button
          type="submit"
          disabled={loading}
          className="btn-primary w-full justify-center py-2.5 text-xs font-semibold"
        >
          {loading ? <Spinner /> : 'Send Reset OTP'}
        </button>
      </form>

      <p className="mt-5 text-center text-xs text-text-secondary">
        Remembered your password?{' '}
        <Link to="/login" className="text-text-primary font-semibold hover:underline">
          Back to sign in
        </Link>
      </p>
    </AuthLayout>
  );
}
