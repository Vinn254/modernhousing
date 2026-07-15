'use client';

import { Suspense, useState } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { supabase } from '../../lib/supabaseClient';

type UserRole = 'admin' | 'agent' | 'tenant' | 'super_admin' | 'project_manager';

const roleRoutes: Record<UserRole, string> = {
  admin: '/admin',
  agent: '/dashboard',
  tenant: '/tenant/dashboard',
  super_admin: '/super-admin',
  project_manager: '/admin',
};

function LoginForm() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [subscriptionPlan, setSubscriptionPlan] = useState<string>('');
  const [paying, setPaying] = useState(false);
  const router = useRouter();
  const searchParams = useSearchParams();
  const subscribe = searchParams.get('subscribe');
  const restricted = searchParams.get('restricted') === 'true';

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError('');
    setLoading(true);

    const { data, error: signInError } = await supabase.auth.signInWithPassword({ email, password });

    // Record login attempt
    await fetch('/api/login-attempts', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, success: !signInError })
    });

    // Clear failed attempts on successful login
    if (!signInError) {
      await fetch('/api/login-attempts', { method: 'DELETE' });
    }

    if (signInError) {
      setError(signInError.message === 'FetchError: Failed to fetch' ? 'Unable to connect to Springfield Systems. Check your internet connection and Supabase configuration.' : signInError.message);
      setLoading(false);
      return;
    }

    const { data: sessionData, error: sessionError } = await supabase.auth.getSession();

    if (sessionError || !sessionData.session) {
      setError('Login succeeded, but the session could not be saved. Please try again.');
      setLoading(false);
      return;
    }

    const role = data.user?.user_metadata?.role ?? 'admin';
    router.push(roleRoutes[role as UserRole] ?? roleRoutes.admin);
  }

  async function handleSubscription() {
    if (!email || !subscriptionPlan) return;
    setPaying(true);
    setError('');

    try {
      const { data: signInData, error: signInErr } = await supabase.auth.signInWithPassword({ email, password: 'temp-password' });

      const { data: { session } } = await supabase.auth.getSession();
      const headers: Record<string, string> = { 'Content-Type': 'application/json' };
      if (session?.access_token) headers.Authorization = `Bearer ${session.access_token}`;

      const response = await fetch('/api/subscriptions', {
        method: 'POST',
        headers,
        body: JSON.stringify({
          adminName: 'Project Manager',
          email,
          plan: subscriptionPlan === 'quarter' ? 'quarterly' : subscriptionPlan === 'year' ? 'yearly' : 'monthly',
        }),
      });

      const result = await response.json();

      if (!response.ok) {
        setError(result.message ?? 'Unable to process subscription.');
        setPaying(false);
        return;
      }
      router.push('/admin');
    } catch (err: any) {
      setError(err.message ?? 'Subscription failed.');
    } finally {
      setPaying(false);
    }
  }

  if (restricted || subscribe) {
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
              <span className="auth-eyebrow">Subscription Required</span>
              <h1>Your subscription has expired or is pending payment.</h1>
              <p>Choose a plan below to regain access to your property management workspace.</p>
            </div>
          </section>

          <section className="auth-panel">
            <div className="auth-header">
              <span className="auth-badge" style={{ background: 'rgba(244,63,94,0.1)', borderColor: 'rgba(244,63,94,0.2)' }}>Payment Required</span>
              <h2>Renew Subscription</h2>
            </div>

            <div style={{ display: 'grid', gap: 12 }}>
              <div>
                <label style={{ display: 'block', marginBottom: 6, fontSize: 13, fontWeight: 600 }}>Email</label>
                <input value={email} onChange={(event) => setEmail(event.target.value)} required placeholder="you@example.com" style={{ width: '100%', padding: 11, borderRadius: 10, border: '1px solid var(--line)' }} />
              </div>

              <div>
                <label style={{ display: 'block', marginBottom: 6, fontSize: 13, fontWeight: 600 }}>Select Plan</label>
                <select value={subscriptionPlan} onChange={(event) => setSubscriptionPlan(event.target.value)} required style={{ width: '100%', padding: 11, borderRadius: 10, border: '1px solid var(--line)' }}>
                  <option value="">Choose plan</option>
                  <option value="monthly">Monthly - KSH 2,500</option>
                  <option value="quarter">Quarterly - KSH 5,000</option>
                  <option value="year">Yearly - KSH 6,000</option>
                </select>
              </div>

              {error && <p className="auth-error">{error}</p>}

              <button type="button" onClick={handleSubscription} disabled={paying || !email || !subscriptionPlan} className="auth-submit">
                {paying ? 'Processing…' : 'Complete Payment'}
              </button>

              <p style={{ textAlign: 'center', fontSize: 13, color: 'var(--ink-3)', marginTop: 8 }}>
                Already paid? <a href="/login" style={{ color: 'var(--accent)' }}>Sign in</a>
              </p>
            </div>
          </section>
        </div>
      </main>
    );
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
            <span className="auth-eyebrow">Housing Management Platform</span>
            <h1>Manage properties, tenants, agents, and payments from one workspace.</h1>
            <p>Secure access for landlords, agents, and tenants with role-based dashboards.</p>
          </div>

          <div className="auth-stats">
            <div>
              <strong>Landlords</strong>
              <span>Property and subscription access</span>
            </div>
            <div>
              <strong>Agents</strong>
              <span>Property and tenant coordination</span>
            </div>
            <div>
              <strong>Tenants</strong>
              <span>Rent, comments, and notices</span>
            </div>
          </div>
        </section>

        <section className="auth-panel">
          <div className="auth-header">
            <span className="auth-badge">Welcome Back</span>
            <h2>Sign in to Springfield Systems</h2>
            <p>Use your project manager, agent, or tenant credentials to continue.</p>
          </div>

          <form onSubmit={handleSubmit} className="auth-form">
            <div className="field-group">
              <label htmlFor="email">Email address</label>
              <input id="email" type="email" value={email} onChange={(event) => setEmail(event.target.value)} required placeholder="you@example.com" />
            </div>

            <div className="field-group">
              <label htmlFor="password">Password</label>
              <input id="password" type="password" value={password} onChange={(event) => setPassword(event.target.value)} required placeholder="••••••••" />
            </div>

            {error && <p className="auth-error">{error}</p>}

            <button type="submit" className="auth-submit" disabled={loading}>
              {loading ? 'Signing in…' : 'Sign In'}
            </button>
          </form>

          <p className="auth-alt">
            Need tenant access? <Link href="/tenant/register">Tenant registration</Link>
          </p>
          <p className="auth-alt">
            <Link href="/forgot-password">Forgot password?</Link>
          </p>

        </section>
      </div>
    </main>
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={<div>Loading…</div>}>
      <LoginForm />
    </Suspense>
  );
}