'use client';

import { useEffect, useState } from 'react';
import { supabase } from '../../../lib/supabaseClient';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';

export default function OTPLoginPage() {
  const [email, setEmail] = useState('');
  const [code, setCode] = useState('');
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [verified, setVerified] = useState(false);
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const router = useRouter();
  const searchParams = useSearchParams();

  useEffect(() => {
    const emailParam = searchParams.get('email');
    if (emailParam) setEmail(emailParam);
  }, [searchParams]);

  useEffect(() => {
    const checkUser = async () => {
      const { data } = await supabase.auth.getUser();
      if (data.user) {
        const { data: sessionData } = await supabase.auth.getSession();
        const profileRes = sessionData.session ? await fetch('/api/profile', { headers: { Authorization: `Bearer ${sessionData.session.access_token}` } }) : null;
        const profileData = profileRes?.ok ? await profileRes.json() : {};
        if (profileData.profile?.otp_code) {
          router.push('/login/otp');
        } else {
          router.push('/dashboard');
        }
      }
    };
    checkUser();
  }, [router, searchParams]);

  async function handleVerify(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError('');
    setMessage('');
    setLoading(true);

    try {
      const response = await fetch('/api/auth/otp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, code, action: 'verify' }),
      });

      const result = await response.json();

      if (!response.ok) {
        setError(result.message ?? 'OTP verification failed.');
        setLoading(false);
        return;
      }

      setVerified(true);
      setMessage('OTP verified. Please set your new password.');
    } catch (err: any) {
      setError(err.message ?? 'Request failed.');
    } finally {
      setLoading(false);
    }
  }

  async function handleSetPassword(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError('');
    setMessage('');
    setLoading(true);

    if (newPassword !== confirmPassword) {
      setError('Passwords do not match.');
      setLoading(false);
      return;
    }

    try {
      const { error } = await supabase.auth.updateUser({ password: newPassword });

      if (error) {
        setError(error.message ?? 'Unable to update password.');
      } else {
        setMessage('Password set successfully. Redirecting...');
        setTimeout(() => router.push('/dashboard'), 1500);
      }
    } catch (err: any) {
      setError(err.message ?? 'Request failed.');
    } finally {
      setLoading(false);
    }
  }

  async function handleResend() {
    setError('');
    setMessage('');
    setLoading(true);

    try {
      const response = await fetch(`/api/auth/otp?email=${encodeURIComponent(email)}&action=resend`);
      const result = await response.json();

      if (!response.ok) {
        setError(result.message ?? 'Unable to resend OTP.');
      } else {
        setMessage('A new OTP has been sent to your email.');
      }
    } catch (err: any) {
      setError(err.message ?? 'Request failed.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="auth-page">
      <div className="auth-layout">
        <section className="auth-visual" aria-hidden="true">
          <div className="auth-brand-lockup">
            <span className="auth-logo">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M3 21h18"/><path d="M5 21V7l8-4v18"/><path d="M19 21V11l-6-4"/></svg>
            </span>
            Springfield Systems
          </div>
          <div className="auth-visual-copy">
            <span className="auth-eyebrow">Account Activation</span>
            <h1>Verify your email and set your password.</h1>
            <p>Enter the 6-digit code sent to your email, then create a new password for your account.</p>
          </div>
        </section>

        <section className="auth-panel">
          <div className="auth-header">
            <Link href="/login" className="auth-back">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M19 12H5"/><polyline points="12 19 5 12 12 5"/></svg>
              Back to login
            </Link>
            <span className="auth-badge">Activate Account</span>
            <h2>{verified ? 'Set your password' : 'Enter your one-time password'}</h2>
            <p>{verified ? 'Create a secure password for your account.' : 'Check your email for a 6-digit code.'}</p>
          </div>

          {!verified ? (
            <form onSubmit={handleVerify} className="auth-form">
              <div className="field-group">
                <label htmlFor="email">Email address</label>
                <input id="email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required placeholder="you@example.com" />
              </div>

              <div className="field-group">
                <label htmlFor="code">One-Time Password</label>
                <input id="code" type="text" value={code} onChange={(e) => setCode(e.target.value.replace(/[^0-9]/g, '').slice(0, 6))} required placeholder="123456" maxLength={6} style={{ letterSpacing: '6px', fontSize: '18px', textAlign: 'center' }} />
              </div>

              {error && <p className="auth-error">{error}</p>}
              {message && <p style={{ color: 'var(--accent)', marginBottom: 12 }}>{message}</p>}

              <button type="submit" className="auth-submit" disabled={loading || code.length !== 6}>
                {loading ? 'Verifying…' : 'Verify OTP'}
              </button>
            </form>
          ) : (
            <form onSubmit={handleSetPassword} className="auth-form">
              <div className="field-group">
                <label htmlFor="newPassword">New Password</label>
                <input id="newPassword" type="password" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} required placeholder="Create a secure password" minLength={6} />
              </div>

              <div className="field-group">
                <label htmlFor="confirmPassword">Confirm Password</label>
                <input id="confirmPassword" type="password" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} required placeholder="Confirm your password" minLength={6} />
              </div>

              {error && <p className="auth-error">{error}</p>}
              {message && <p style={{ color: 'var(--accent)', marginBottom: 12 }}>{message}</p>}

              <button type="submit" className="auth-submit" disabled={loading || !newPassword || !confirmPassword}>
                {loading ? 'Saving…' : 'Set Password'}
              </button>
            </form>
          )}

          {!verified && (
            <p className="auth-alt">
              Didn't receive the code? <button type="button" onClick={handleResend} disabled={loading} style={{ background: 'none', border: 'none', color: 'var(--accent)', cursor: 'pointer', fontWeight: 600 }}>Resend OTP</button>
            </p>
          )}
          <p className="auth-alt">
            <Link href="/forgot-password">Forgot password instead?</Link>
          </p>
        </section>
      </div>
    </main>
  );
}
