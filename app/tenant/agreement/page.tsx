'use client';

import { useEffect, useState } from 'react';
import { supabase } from '../../../lib/supabaseClient';

interface Agreement {
  id: string;
  content: string;
  status: string;
  created_at: string;
  accepted_at?: string;
}

export default function TenantAgreementPage() {
  const [user, setUser] = useState<any>(null);
  const [agreement, setAgreement] = useState<Agreement | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');

  async function loadAgreement(userId: string) {
    setLoading(true);
    const { data: { session } } = await supabase.auth.getSession();
    const response = await fetch(`/api/tenant/agreement?userId=${encodeURIComponent(userId)}`, {
      headers: session?.access_token ? { Authorization: `Bearer ${session.access_token}` } : undefined,
    });
    const result = await response.json();
    if (response.ok) setAgreement(result.agreement ?? null);
    setLoading(false);
  }

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      if (data.user) {
        setUser(data.user);
        loadAgreement(data.user.id);
      }
    });
  }, []);

  async function handleAccept() {
    const { data: { session } } = await supabase.auth.getSession();
    const response = await fetch('/api/tenant/agreement', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(session?.access_token ? { Authorization: `Bearer ${session.access_token}` } : {}),
      },
      body: JSON.stringify({ status: 'accepted' }),
    });
    const result = await response.json();
    if (response.ok) {
      setMessage('Agreement accepted successfully.');
      setAgreement(result.agreement);
    } else {
      setError(result.message ?? 'Failed to accept agreement.');
    }
  }

  async function handleDecline() {
    const { data: { session } } = await supabase.auth.getSession();
    const response = await fetch('/api/tenant/agreement', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(session?.access_token ? { Authorization: `Bearer ${session.access_token}` } : {}),
      },
      body: JSON.stringify({ status: 'declined' }),
    });
    const result = await response.json();
    if (response.ok) {
      setMessage('Agreement declined. Contact your landlord for details.');
      setAgreement(result.agreement);
    } else {
      setError(result.message ?? 'Failed to decline agreement.');
    }
  }

  if (loading) {
    return (
      <main className="container page-layout">
        <div className="card">Loading agreement...</div>
      </main>
    );
  }

  if (!agreement) {
    return (
      <main className="container page-layout">
        <div className="card-admin-header">
          <p className="heading">No Agreement</p>
        </div>
        <article className="card" style={{ marginTop: 24 }}>
          <p>No tenancy agreement found. Please contact your landlord.</p>
        </article>
      </main>
    );
  }

  return (
    <main className="container page-layout">
      <div className="card-admin-header">
        <p className="heading">Tenancy Agreement</p>
        <p className="subheading">Review and accept your rental agreement.</p>
      </div>

      <article className="card" style={{ marginTop: 24 }}>
        <div className="card-label">
          <span className={`status-pill ${agreement.status === 'accepted' ? 'status-active' : agreement.status === 'declined' ? 'status-pending' : ''}`}>
            {agreement.status}
          </span>
        </div>
        <h3 style={{ whiteSpace: 'pre-wrap', fontFamily: 'monospace', fontSize: '14px' }}>{agreement.content}</h3>

        {agreement.status === 'pending' && (
          <div style={{ marginTop: 24, display: 'flex', gap: 12 }}>
            <button className="action-button primary" onClick={handleAccept}>Accept Agreement</button>
            <button className="action-button danger" onClick={handleDecline}>Decline</button>
          </div>
        )}

        {message && <p className="landlord-success" style={{ marginTop: 16 }}>{message}</p>}
        {error && <p className="landlord-error" style={{ marginTop: 16 }}>{error}</p>}
      </article>
    </main>
  );
}