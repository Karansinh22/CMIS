/**
 * VerifyEmailPage.jsx — 6-digit OTP email verification screen.
 * Strict enterprise monochrome UI.
 */
import { useEffect, useRef, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { verifyEmail, resendOTP, saveTokens } from '../auth';
import { useAuth } from '../context/AuthContext';
import { AuthLayout, ErrorBanner, Spinner, SuccessBanner } from './LoginPage';

const OTP_LENGTH = 6;

export default function VerifyEmailPage() {
  const navigate  = useNavigate();
  const location  = useLocation();
  const { refetchUser } = useAuth();

  const [email]         = useState(location.state?.email || '');
  const [digits, setDigits] = useState(Array(OTP_LENGTH).fill(''));
  const [error, setError]   = useState('');
  const [success, setSuccess] = useState('');
  const [loading, setLoading] = useState(false);
  const [resendTimer, setResendTimer] = useState(60);
  const inputRefs = useRef([]);

  useEffect(() => {
    if (resendTimer <= 0) return;
    const t = setTimeout(() => setResendTimer((p) => p - 1), 1000);
    return () => clearTimeout(t);
  }, [resendTimer]);

  const handleDigitChange = (e, idx) => {
    const val = e.target.value.replace(/\D/g, '').slice(-1);
    const next = [...digits];
    next[idx] = val;
    setDigits(next);
    if (val && idx < OTP_LENGTH - 1) inputRefs.current[idx + 1]?.focus();
  };

  const handleKeyDown = (e, idx) => {
    if (e.key === 'Backspace' && !digits[idx] && idx > 0) {
      inputRefs.current[idx - 1]?.focus();
    }
  };

  const handlePaste = (e) => {
    const pasted = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, OTP_LENGTH);
    if (pasted.length === OTP_LENGTH) {
      setDigits(pasted.split(''));
      inputRefs.current[OTP_LENGTH - 1]?.focus();
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    const otp = digits.join('');
    if (otp.length < OTP_LENGTH) { setError('Please enter the full 6-digit verification code.'); return; }
    setError(''); setLoading(true);
    try {
      const { data } = await verifyEmail(email, otp);
      saveTokens(data.access_token, data.refresh_token);
      await refetchUser();
      setSuccess('Email verified successfully! Opening workspace...');
      setTimeout(() => navigate('/'), 1000);
    } catch (err) {
      setError(err.response?.data?.detail || 'Verification failed. Invalid code.');
    } finally {
      setLoading(false);
    }
  };

  const handleResend = async () => {
    if (resendTimer > 0) return;
    setError(''); setSuccess('');
    try {
      await resendOTP(email);
      setSuccess('A new verification code has been dispatched.');
      setResendTimer(60);
      setDigits(Array(OTP_LENGTH).fill(''));
      inputRefs.current[0]?.focus();
    } catch (err) {
      setError(err.response?.data?.detail || 'Could not resend code.');
    }
  };

  return (
    <AuthLayout title="Verify Email" subtitle={`Enter the 6-digit code sent to ${email || 'your email'}`}>
      <form onSubmit={handleSubmit} className="space-y-5">
        {/* OTP Input Boxes */}
        <div className="flex gap-2 justify-center" onPaste={handlePaste}>
          {digits.map((d, i) => (
            <input
              key={i}
              ref={(el) => (inputRefs.current[i] = el)}
              type="text"
              inputMode="numeric"
              maxLength={1}
              value={d}
              onChange={(e) => handleDigitChange(e, i)}
              onKeyDown={(e) => handleKeyDown(e, i)}
              className="w-10 h-12 text-center text-lg font-mono font-bold bg-surface border border-border-default rounded-lg text-text-primary focus:border-text-primary focus:outline-none transition-colors"
            />
          ))}
        </div>

        {error   && <ErrorBanner   message={error} />}
        {success && <SuccessBanner message={success} />}

        <button
          type="submit"
          disabled={loading}
          className="btn-primary w-full justify-center py-2.5 text-xs font-semibold"
        >
          {loading ? <Spinner /> : 'Verify Account'}
        </button>

        <div className="text-center pt-1">
          <button
            type="button"
            onClick={handleResend}
            disabled={resendTimer > 0}
            className="text-xs text-text-muted hover:text-text-primary disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
          >
            {resendTimer > 0 ? `Resend code in ${resendTimer}s` : 'Resend verification code'}
          </button>
        </div>
      </form>
    </AuthLayout>
  );
}
