'use client';

import { useState } from 'react';
import { supabase } from '../../lib/supabaseClient';
import { useRouter } from 'next/navigation';
import Link from 'next/link';

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
      setError(signInError.message);
      setLoading(false);
      return;
    }

    const role = data.user?.user_metadata?.role;
    if (role === 'super_admin') {
      router.push('/super-admin');
    } else if (role === 'admin') {
      router.push('/admin');
    } else if (role === 'agent') {
      router.push('/dashboard');
    } else if (role === 'tenant') {
      router.push('/tenant/dashboard');
    } else {
      router.push('/dashboard');
    }
  }

  return (
    <main className="auth-page">
      <div className="auth-card">
        <div className="auth-header">
          <div className="auth-badge">Springfield Systems</div>
          <h2>Welcome Back</h2>
          <p>Log in to access your landlord, agent, admin, or tenant workspace.</p>
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
          Don&apos;t have an account? <Link href="/signup">Create landlord account</Link> · <Link href="/tenant/register">Tenant registration</Link>
        </p>
      </div>
    </main>
  );
}
