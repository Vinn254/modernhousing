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
            <span className="auth-eyebrow">Create Account</span>
            <h1>Register as a landlord or agent.</h1>
            <p>Your account will be reviewed by the super admin before activation. No OTP required.</p>
          </div>
        </section>

        <section className="auth-panel">
          <div className="auth-header" style={{ textAlign: 'center' }}>
            <Link href="/" className="auth-back">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M19 12H5"/><polyline points="12 19 5 12 12 5"/></svg>
              Back to home
            </Link>
            <span className="auth-badge">Registration</span>
            <h2>Create Account</h2>
            <p style={{ textAlign: 'center' }}>Register as a landlord or agent. Your account will be reviewed by the super admin before activation.</p>
          </div>

          <form onSubmit={handleSubmit} className="auth-form">
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
              <div className="field-group">
                <label htmlFor="organizationName">Organization name</label>
                <input id="organizationName" value={organizationName} onChange={(event) => setOrganizationName(event.target.value)} required placeholder="Springfield Properties" />
              </div>
            )}

            <div className="field-group">
              <label htmlFor="managerName">Full name</label>
              <input id="managerName" value={managerName} onChange={(event) => setManagerName(event.target.value)} required placeholder="Jane Doe" />
            </div>

            <div className="field-group">
              <label htmlFor="email">Email address</label>
              <input id="email" type="email" value={email} onChange={(event) => setEmail(event.target.value)} required placeholder="you@example.com" />
            </div>

            <div className="field-group">
              <label htmlFor="password">Password</label>
              <input id="password" type="password" value={password} onChange={(event) => setPassword(event.target.value)} required placeholder="Choose a secure password" minLength={6} />
            </div>

            {role === 'project_manager' && (
              <div className="field-group">
                <label htmlFor="selectedPlan">Subscription Plan</label>
                <select id="selectedPlan" value={selectedPlan} onChange={(event) => setSelectedPlan(event.target.value)} required>
                  {plans.map((plan) => (
                    <option key={plan.value} value={plan.value}>{plan.name} - {plan.price}</option>
                  ))}
                </select>
              </div>
            )}

            {error && <p className="auth-error">{error}</p>}

            <button type="submit" className="auth-submit" disabled={loading}>
              {loading ? 'Creating account…' : role === 'project_manager' ? 'Create Landlord Account' : 'Create Agent Account'}
            </button>
          </form>

          <p className="auth-alt">
            Already have an account? <Link href="/login" style={{ color: 'var(--accent)', fontWeight: 600 }}>Sign in</Link>
          </p>
        </section>
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
