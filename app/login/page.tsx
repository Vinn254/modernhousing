'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { supabase } from '../../lib/supabaseClient';

type UserRole = 'admin' | 'agent' | 'tenant' | 'super_admin';

const roleRoutes: Record<UserRole, string> = {
  admin: '/admin',
  agent: '/dashboard',
  tenant: '/tenant/dashboard',
  super_admin: '/super-admin',
};

export default function LoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError('');
    setLoading(true);

    const { data, error: signInError } = await supabase.auth.signInWithPassword({ email, password });

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
            <p>Use your landlord, agent, or tenant credentials to continue.</p>
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
        </section>
      </div>
    </main>
  );
}
