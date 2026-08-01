'use client';

import { useState } from 'react';
import Link from 'next/link';

export default function TenantRegisterPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setMessage('');
    setError('');

    if (password !== confirmPassword) {
      setError('Passwords do not match.');
      return;
    }

    setLoading(true);

    const response = await fetch('/api/tenant/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password }),
    });

    const result = await response.json();

    if (!response.ok) {
      setError(result.message ?? 'Unable to register tenant.');
      setLoading(false);
      return;
    }

    setMessage(result.message);
    setPassword('');
    setConfirmPassword('');
    setLoading(false);
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
            <span className="auth-eyebrow">Tenant Portal</span>
            <h1>Activate your tenant account.</h1>
            <p>Use the same email your agent or landlord used when adding you as a tenant. You can set your own password here.</p>
          </div>
        </section>

        <section className="auth-panel">
          <div className="auth-header">
            <span className="auth-badge">Tenant Registration</span>
            <h2>Create tenant login</h2>
            <p>Enter your registered tenant email and choose a password.</p>
          </div>

          <form onSubmit={handleSubmit} className="auth-form">
            <div className="field-group">
              <label htmlFor="email">Tenant email</label>
              <input
                id="email"
                type="email"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                required
                placeholder="tenant@example.com"
              />
            </div>
            <div className="field-group">
              <label htmlFor="password">Password</label>
              <input
                id="password"
                type="password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                required
                placeholder="Choose a password"
              />
            </div>
            <div className="field-group">
              <label htmlFor="confirmPassword">Confirm password</label>
              <input
                id="confirmPassword"
                type="password"
                value={confirmPassword}
                onChange={(event) => setConfirmPassword(event.target.value)}
                required
                placeholder="Confirm password"
              />
            </div>
            {message && <p style={{ color: 'var(--accent)', marginBottom: 12, fontWeight: 700 }}>{message}</p>}
            {error && <p className="auth-error">{error}</p>}
            <button type="submit" className="auth-submit" disabled={loading}>
              {loading ? 'Activating…' : 'Activate Tenant Account'}
            </button>
          </form>

          <p className="auth-alt">
            Already activated? <Link href="/login">Sign in as tenant</Link>
          </p>
        </section>
      </div>
    </main>
  );
}