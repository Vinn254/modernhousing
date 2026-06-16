'use client';

import { useState } from 'react';
import { supabase } from '../../lib/supabaseClient';
import { useRouter } from 'next/navigation';
import Link from 'next/link';

export default function SignupPage() {
  const [organizationName, setOrganizationName] = useState('');
  const [managerName, setManagerName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError('');
    setLoading(true);

    const { data, error: signUpError } = await supabase.auth.signUp({ email, password });

    if (signUpError || !data.user) {
      setError(signUpError?.message ?? 'Unable to create account.');
      setLoading(false);
      return;
    }

    const response = await fetch('/api/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId: data.user.id, organizationName, managerName, email }),
    });

    const result = await response.json();
    if (!response.ok) {
      setError(result.message ?? 'Registration failed.');
      setLoading(false);
      return;
    }

    router.push('/admin');
  }

  return (
    <main className="container">
      <div className="hero" style={{ padding: '40px 20px 140px' }}>
        <h1>Create Landlord Account</h1>
        <p>Register a landlord workspace to manage properties, agents, tenants, and payments.</p>
      </div>

      <div className="card" style={{ maxWidth: '520px', margin: '-80px auto 0' }}>
        <h2 style={{ marginTop: 0, color: 'var(--dark-blue-accent)', marginBottom: 8 }}>Landlord Registration</h2>

        <form onSubmit={handleSubmit} className="grid" style={{ gap: 16, marginTop: 8 }}>
          <label>
            Organization name
            <input value={organizationName} onChange={(event) => setOrganizationName(event.target.value)} required placeholder="Springfield Properties" />
          </label>

          <label>
            Full name
            <input value={managerName} onChange={(event) => setManagerName(event.target.value)} required placeholder="Jane Doe" />
          </label>

          <label>
            Email address
            <input type="email" value={email} onChange={(event) => setEmail(event.target.value)} required placeholder="landlord@example.com" />
          </label>

          <label>
            Password
            <input type="password" value={password} onChange={(event) => setPassword(event.target.value)} required placeholder="Choose a secure password" />
          </label>

          {error ? <p style={{ color: '#ef4444', fontSize: '0.9rem' }}>{error}</p> : null}

          <button type="submit" disabled={loading}>
            {loading ? 'Creating account…' : 'Create Landlord Account'}
          </button>
        </form>

        <p style={{ marginTop: 24, textAlign: 'center', color: 'var(--text-secondary)', fontSize: '0.95rem' }}>
          Already have an account? <Link href="/login" style={{ color: 'var(--accent)', fontWeight: 600 }}>Sign in</Link>
        </p>
      </div>
    </main>
  );
}
