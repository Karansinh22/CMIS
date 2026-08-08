/**
 * ForgotPasswordPage.jsx — Step 1: Enter email → receive OTP
 * ForgotPasswordPage is a two-step flow: email → OTP+new password.
 */
import { useState } from 'react';
import { Link } from 'react-router-dom';
import { forgotPassword } from '../auth';
import { AuthLayout, ErrorBanner, Spinner, SuccessBanner } from './LoginPage';
import ResetPasswordPage from './ResetPasswordPage';

export default function ForgotPasswordPage() {
  const [email, setEmail]   = useState('');
  const [sent, setSent]     = useState(false);
  const [error, setError]   = useState('');
  const [success, setSuccess] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(''); setLoading(true);
    try {
      const { data } = await forgotPassword(email);
      setSuccess(data.message);
      setSent(true);
    } catch {
      setError('Something went wrong. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  if (sent) return <ResetPasswordPage prefillEmail={email} />;

  return (
    <AuthLayout title="Forgot password?" subtitle="We'll send a reset OTP to your email">
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="block text-sm text-white/60 mb-1.5">Email address</label>
          <input
            type="email" required autoFocus
            value={email} onChange={(e) => setEmail(e.target.value)}
            className="input" placeholder="you@example.com"
          />
        </div>

        {error   && <ErrorBanner   message={error} />}
        {success && <SuccessBanner message={success} />}

        <button type="submit" disabled={loading} className="btn-primary w-full justify-center py-3 text-base">
          {loading ? <Spinner /> : 'Send Reset OTP'}
        </button>
      </form>

      <p className="mt-6 text-center text-sm text-white/40">
        Remembered it?{' '}
        <Link to="/login" className="text-brand-400 hover:text-brand-300 font-medium transition-colors">
          Back to login
        </Link>
      </p>
    </AuthLayout>
  );
}
