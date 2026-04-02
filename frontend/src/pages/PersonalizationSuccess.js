import { useState, useEffect, useCallback } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { Loader2, CheckCircle, Mail, AlertCircle, BookOpen } from 'lucide-react';

const API_URL = process.env.REACT_APP_BACKEND_URL || '';
const POLL_INTERVAL_MS = 2000;
const MAX_POLLS = 30;           // 60 seconds total
const LATE_THRESHOLD = 15;      // After 30s show "almost there" messaging

export default function PersonalizationSuccess() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const checkoutId = searchParams.get('checkout_id');

  const [pollCount, setPollCount] = useState(0);
  const [status, setStatus] = useState('polling'); // polling | redirecting | check_email | error
  const [errorMessage, setErrorMessage] = useState('');

  const poll = useCallback(async () => {
    if (!checkoutId) return false;
    try {
      const res = await fetch(
        `${API_URL}/api/personalization/by-checkout?checkout_id=${encodeURIComponent(checkoutId)}`
      );
      if (!res.ok) return false;
      const data = await res.json();

      if (data.status === 'ready') {
        setStatus('redirecting');
        const dest = data.redirect_url || `/personalize/${data.session_token}`;
        setTimeout(() => navigate(dest), 400);
        return true;
      }
      if (data.status === 'submitted' || data.status === 'completed') {
        const url = data.customer_view_url;
        if (url) {
          setStatus('redirecting');
          setTimeout(() => { window.location.href = url; }, 400);
        } else {
          setStatus('check_email');
        }
        return true;
      }
      return false;
    } catch {
      return false;
    }
  }, [checkoutId, navigate]);

  useEffect(() => {
    if (!checkoutId) {
      setStatus('error');
      setErrorMessage('No checkout ID found. Please check your confirmation email.');
      return;
    }

    let count = 0;
    let timer = null;
    let stopped = false;

    const runPoll = async () => {
      if (stopped) return;
      count++;
      setPollCount(count);
      const done = await poll();
      if (done || stopped) return;
      if (count >= MAX_POLLS) {
        setStatus('check_email');
        return;
      }
      timer = setTimeout(runPoll, POLL_INTERVAL_MS);
    };

    runPoll();
    return () => {
      stopped = true;
      clearTimeout(timer);
    };
  }, [checkoutId, poll]);

  const progress = Math.min((pollCount / MAX_POLLS) * 100, 100);
  const isLate = pollCount > LATE_THRESHOLD;

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-50 via-pink-50 to-blue-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-xl p-8 max-w-md w-full text-center space-y-6">

        {/* Logo */}
        <div className="w-16 h-16 bg-purple-600 rounded-2xl flex items-center justify-center mx-auto">
          <BookOpen className="w-8 h-8 text-white" />
        </div>

        {/* ── Polling ── */}
        {status === 'polling' && (
          <>
            <Loader2 className="w-10 h-10 text-purple-500 animate-spin mx-auto" />
            <div>
              <h1 className="text-2xl font-bold text-gray-900 mb-2">
                {isLate ? 'Almost there…' : 'Payment confirmed!'}
              </h1>
              <p className="text-gray-500 text-sm">
                {isLate
                  ? 'Still setting up your session — this usually takes under a minute.'
                  : 'Setting up your personalization form, hang tight…'}
              </p>
            </div>
            {/* Progress bar */}
            <div className="w-full bg-gray-100 rounded-full h-1.5 overflow-hidden">
              <div
                className="bg-purple-500 h-1.5 rounded-full transition-all duration-500"
                style={{ width: `${progress}%` }}
              />
            </div>
          </>
        )}

        {/* ── Redirecting ── */}
        {status === 'redirecting' && (
          <>
            <CheckCircle className="w-10 h-10 text-green-500 mx-auto" />
            <div>
              <h1 className="text-2xl font-bold text-gray-900 mb-2">Ready!</h1>
              <p className="text-gray-500 text-sm">Redirecting to your form…</p>
            </div>
          </>
        )}

        {/* ── Check Email ── */}
        {status === 'check_email' && (
          <>
            <Mail className="w-10 h-10 text-purple-500 mx-auto" />
            <div>
              <h1 className="text-2xl font-bold text-gray-900 mb-2">Check your email!</h1>
              <p className="text-gray-500 text-sm mb-2">
                We've emailed you a personalization link. Click it to fill in the details for your storybook.
              </p>
              <p className="text-xs text-gray-400">
                Didn't get it? Check your spam folder, or contact support.
              </p>
            </div>
          </>
        )}

        {/* ── Error ── */}
        {status === 'error' && (
          <>
            <AlertCircle className="w-10 h-10 text-red-500 mx-auto" />
            <div>
              <h1 className="text-2xl font-bold text-gray-900 mb-2">Something went wrong</h1>
              <p className="text-gray-500 text-sm">{errorMessage}</p>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
