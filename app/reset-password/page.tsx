'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { supabase } from '../../lib/supabaseClient';

export default function ResetPasswordPage() {
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    supabase.auth.onAuthStateChange((event, session) => {
      if (event === 'PASSWORD_RECOVERY' && session) {
        // User has clicked the reset link and has a recovery session
      }
    });
  }, []);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    
    if (password !== confirmPassword) {
      setError('Passwords do not match.');
      return;
    }

    setLoading(true);
    setError('');
    setMessage('');

    try {
      const { error } = await supabase.auth.updateUser({ password });

      if (error) {
        setError(error.message ?? 'Unable to reset password.');
      } else {
        setMessage('Password reset successfully. You can now sign in.');
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
            <span className="auth-eyebrow">Set New Password</span>
            <h1>Create a new password for your account.</h1>
            <p>Enter your new password below to complete the reset process.</p>
          </div>
        </section>

        <section className="auth-panel">
          <div className="auth-header">
            <span className="auth-badge">Reset Password</span>
            <h2>Create New Password</h2>
          </div>

          <form onSubmit={handleSubmit} className="auth-form">
            <div className="field-group">
              <label htmlFor="password">New Password</label>
              <input id="password" type="password" value={password} onChange={(e) => setPassword(e.target.value)} required placeholder="••••••••" />
            </div>

            <div className="field-group">
              <label htmlFor="confirmPassword">Confirm Password</label>
              <input id="confirmPassword" type="password" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} required placeholder="••••••••" />
            </div>

            {error && <p className="auth-error">{error}</p>}
            {message && <p style={{ color: 'var(--accent)', marginBottom: 12 }}>{message}</p>}

            <button type="submit" className="auth-submit" disabled={loading}>
              {loading ? 'Updating…' : 'Update Password'}
            </button>
          </form>

          <p className="auth-alt">
            <Link href="/login">Back to sign in</Link>
          </p>
        </section>
      </div>
    </main>
  );
}