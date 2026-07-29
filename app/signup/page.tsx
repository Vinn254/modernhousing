'use client';

import { useState, useEffect, Suspense } from 'react';
import { supabase } from '../../lib/supabaseClient';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';

const plans = [
  { name: 'Monthly', price: 'KSH 2,500', value: 'monthly' },
  { name: 'Quarterly', price: 'KSH 5,000', value: 'quarterly' },
  { name: 'Yearly', price: 'KSH 6,000', value: 'yearly' },
];

function SignupForm() {
  const [role, setRole] = useState<'project_manager' | 'agent'>('project_manager');
  const [organizationName, setOrganizationName] = useState('');
  const [managerName, setManagerName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [selectedPlan, setSelectedPlan] = useState('monthly');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const router = useRouter();
  const searchParams = useSearchParams();

  useEffect(() => {
    const roleParam = searchParams.get('role');
    if (roleParam === 'project_manager' || roleParam === 'agent') {
      setRole(roleParam);
    }
  }, [searchParams]);

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

    const body: any = {
      userId: data.user.id,
      organizationName,
      managerName,
      email,
      plan: selectedPlan,
      role,
    };

    if (role === 'agent') {
      body.organizationName = 'Agent Workspace';
    }

    const response = await fetch('/api/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });

    const result = await response.json();
    if (!response.ok) {
      setError(result.message ?? 'Registration failed.');
      setLoading(false);
      return;
    }

    router.push('/login?message=Registration submitted successfully. Please wait for super admin approval before logging in.');
  }

  return (
    <main className="container" style={{ overflowX: 'hidden' }}>
      <div className="hero" style={{ padding: '40px 20px 120px' }}>
        <h1>Create Account</h1>
        <p>Register as a landlord or agent. Your account will be reviewed by the super admin before activation.</p>
      </div>

      <div className="card" style={{ maxWidth: '520px', margin: '-80px auto 0' }}>
        <h2 style={{ marginTop: 0, color: 'var(--dark-blue-accent)', marginBottom: 8 }}>Registration</h2>

        <form onSubmit={handleSubmit} className="grid" style={{ gap: 16, marginTop: 8 }}>
          <div className="field-group">
            <label>I am registering as</label>
            <div style={{ display: 'flex', gap: 12 }}>
              <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', padding: '10px 14px', borderRadius: 8, border: `1px solid ${role === 'project_manager' ? 'var(--accent)' : 'var(--line)'}`, background: role === 'project_manager' ? 'rgba(16,185,129,0.08)' : 'transparent' }}>
                <input type="radio" name="role" value="project_manager" checked={role === 'project_manager'} onChange={() => setRole('project_manager')} />
                <span>Landlord</span>
              </label>
              <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', padding: '10px 14px', borderRadius: 8, border: `1px solid ${role === 'agent' ? 'var(--accent)' : 'var(--line)'}`, background: role === 'agent' ? 'rgba(16,185,129,0.08)' : 'transparent' }}>
                <input type="radio" name="role" value="agent" checked={role === 'agent'} onChange={() => setRole('agent')} />
                <span>Agent</span>
              </label>
            </div>
          </div>

          {role === 'project_manager' && (
            <label>
              Organization name
              <input value={organizationName} onChange={(event) => setOrganizationName(event.target.value)} required placeholder="Springfield Properties" />
            </label>
          )}

          <label>
            Full name
            <input value={managerName} onChange={(event) => setManagerName(event.target.value)} required placeholder="Jane Doe" />
          </label>

          <label>
            Email address
            <input type="email" value={email} onChange={(event) => setEmail(event.target.value)} required placeholder="you@example.com" />
          </label>

          <label>
            Password
            <input type="password" value={password} onChange={(event) => setPassword(event.target.value)} required placeholder="Choose a secure password" minLength={6} />
          </label>

          {role === 'project_manager' && (
            <label>
              Subscription Plan
              <select value={selectedPlan} onChange={(event) => setSelectedPlan(event.target.value)} required>
                {plans.map((plan) => (
                  <option key={plan.value} value={plan.value}>{plan.name} - {plan.price}</option>
                ))}
              </select>
            </label>
          )}

          {error ? <p style={{ color: '#ef4444', fontSize: '0.9rem' }}>{error}</p> : null}

          <button type="submit" disabled={loading}>
            {loading ? 'Creating account…' : role === 'project_manager' ? 'Create Landlord Account' : 'Create Agent Account'}
          </button>
        </form>

        <p style={{ marginTop: 24, textAlign: 'center', color: 'var(--text-secondary)', fontSize: '0.95rem' }}>
          Already have an account? <Link href="/login" style={{ color: 'var(--accent)', fontWeight: 600 }}>Sign in</Link>
        </p>
      </div>
    </main>
  );
}

export default function SignupPage() {
  return (
    <Suspense fallback={<div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '100vh' }}>Loading…</div>}>
      <SignupForm />
    </Suspense>
  );
}
