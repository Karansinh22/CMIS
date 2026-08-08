/**
 * VerifyEmailPage.jsx — 6-digit OTP input with auto-advance, resend timer.
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

  // Countdown for resend button
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
    if (otp.length < OTP_LENGTH) { setError('Please enter the full 6-digit OTP.'); return; }
    setError(''); setLoading(true);
    try {
      const { data } = await verifyEmail(email, otp);
      saveTokens(data.access_token, data.refresh_token);
      await refetchUser();
      setSuccess('Email verified! Redirecting...');
      setTimeout(() => navigate('/'), 1000);
    } catch (err) {
      setError(err.response?.data?.detail || 'Verification failed.');
    } finally {
      setLoading(false);
    }
  };

  const handleResend = async () => {
    if (resendTimer > 0) return;
    setError(''); setSuccess('');
    try {
      await resendOTP(email);
      setSuccess('A new OTP has been sent to your email.');
      setResendTimer(60);
      setDigits(Array(OTP_LENGTH).fill(''));
      inputRefs.current[0]?.focus();
    } catch (err) {
      setError(err.response?.data?.detail || 'Could not resend OTP.');
    }
  };

  return (
    <AuthLayout title="Verify your email" subtitle={`Enter the 6-digit OTP sent to ${email || 'your email'}`}>
      <form onSubmit={handleSubmit} className="space-y-6">
        {/* OTP input boxes */}
        <div className="flex gap-3 justify-center" onPaste={handlePaste}>
          {digits.map((d, i) => (
            <input
              key={i}
              ref={(el) => (inputRefs.current[i] = el)}
              type="text" inputMode="numeric" maxLength={1}
              value={d}
              onChange={(e) => handleDigitChange(e, i)}
              onKeyDown={(e) => handleKeyDown(e, i)}
              className="w-12 h-14 text-center text-2xl font-bold bg-white/5 border border-white/10
                         rounded-xl text-white focus:outline-none focus:border-brand-500 focus:ring-1
                         focus:ring-brand-500/30 transition-all duration-200 caret-transparent"
            />
          ))}
        </div>

        {error   && <ErrorBanner   message={error} />}
        {success && <SuccessBanner message={success} />}

        <button type="submit" disabled={loading} className="btn-primary w-full justify-center py-3 text-base">
          {loading ? <Spinner /> : 'Verify Email'}
        </button>

        <div className="text-center">
          <button
            type="button"
            onClick={handleResend}
            disabled={resendTimer > 0}
            className="text-sm text-white/40 hover:text-white/70 disabled:cursor-not-allowed disabled:opacity-40 transition-colors"
          >
            {resendTimer > 0 ? `Resend OTP in ${resendTimer}s` : 'Resend OTP'}
          </button>
        </div>
      </form>
    </AuthLayout>
  );
}
