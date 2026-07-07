'use client';

import { useState } from 'react';

const SUPER_ADMIN_EMAIL = 'vin.oumaotieno@gmail.com';

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    setError('');
    setMessage('');

    if (email.toLowerCase() === SUPER_ADMIN_EMAIL.toLowerCase()) {
      setError('Password reset is not available for the super admin account. Please contact support.');
      setLoading(false);
      return;
    }

    try {
      const response = await fetch('/api/auth/forgot-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      });

      const result = await response.json();
      
      if (!response.ok) {
        setError(result.message ?? 'Unable to send reset link.');
      } else {
        setMessage('If an account exists with this email, a reset link has been sent.');
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
            <span className="auth-eyebrow">Password Reset</span>
            <h1>Recover your account access.</h1>
            <p>Enter your registered email to receive a password reset link.</p>
          </div>
        </section>

        <section className="auth-panel">
          <div className="auth-header">
            <span className="auth-badge">Forgot Password</span>
            <h2>Reset your password</h2>
            <p>We will email you a secure reset link.</p>
          </div>

          <form onSubmit={handleSubmit} className="auth-form">
            <div className="field-group">
              <label htmlFor="email">Email address</label>
              <input id="email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required placeholder="you@example.com" />
            </div>

            {error && <p className="auth-error">{error}</p>}
            {message && <p style={{ color: 'var(--accent)', marginBottom: 12 }}>{message}</p>}

            <button type="submit" className="auth-submit" disabled={loading}>
              {loading ? 'Sending…' : 'Send Reset Link'}
            </button>
          </form>

          <p className="auth-alt">
            Remember your password? <a href="/login">Sign in</a>
          </p>
        </section>
      </div>
    </main>
  );
}