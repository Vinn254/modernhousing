'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import AdminTopNav from '../../components/AdminTopNav';

interface Subscription {
  id: string;
  admin_name: string;
  email: string;
  plan: string;
  amount: number;
  status: string;
  start_date: string;
  expiry_date: string;
  paid_at: string;
}

export default function SuperAdminPaymentsPage() {
  const [subscriptions, setSubscriptions] = useState<Subscription[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');

  async function loadData() {
    setLoading(true);
    setError('');

    const response = await fetch('/api/subscriptions');
    const result = await response.json();

    if (!response.ok) {
      setError(result.message ?? 'Unable to load landlord subscriptions.');
      setLoading(false);
      return;
    }

    setSubscriptions(result.subscriptions ?? []);
    setLoading(false);
  }

  useEffect(() => {
    loadData();
  }, []);

  async function markOverdue(subscription: Subscription) {
    const response = await fetch('/api/subscriptions', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: subscription.id, status: 'overdue' }),
    });

    const result = await response.json();
    if (!response.ok) {
      setError(result.message ?? 'Unable to update subscription.');
      return;
    }

    setSubscriptions((current) => current.map((item) => (item.id === subscription.id ? result.subscription : item)));
    setMessage('Subscription marked as overdue.');
  }

  const totalSubscriptions = subscriptions.reduce((sum, item) => sum + Number(item.amount ?? 0), 0);
  const activeSubscriptions = subscriptions.filter((item) => item.status === 'paid' || item.status === 'active').length;
  const overdueSubscriptions = subscriptions.filter((item) => item.status === 'overdue').length;
  const expiringSubscriptions = subscriptions.filter((item) => item.status === 'pending').length;

  return (
    <>
      <section className="hero">
        <nav className="nav">
          <Link href="/" className="logo">
            <span className="logo-mark">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M3 21h18"/><path d="M5 21V7l8-4v18"/><path d="M19 21V11l-6-4"/></svg>
            </span>
            Springfield Systems
          </Link>
          <AdminTopNav variant="super" />
        </nav>

        <div className="hero-inner">
          <span className="eyebrow">
            <span className="pulse"></span>
            Super Admin
          </span>

          <h1>Payments</h1>

          <p className="hero-sub">
            Review landlord subscription payments, renewals, overdue access payments, and system revenue.
          </p>
        </div>
      </section>

      <section className="bento-section">
        <div className="bento">
          {loading && <p style={{ color: 'var(--ink-3)', gridColumn: 'span 12' }}>Loading subscriptions…</p>}
          {message && <p style={{ color: 'var(--accent)', gridColumn: 'span 12' }}>{message}</p>}
          {error && <p style={{ color: '#dc2626', gridColumn: 'span 12' }}>{error}</p>}

          <article className="card" style={{ gridColumn: 'span 3' }}>
            <div className="card-label">Landlord Subscriptions</div>
            <h3 style={{ fontSize: '34px', margin: 0 }}>KSH {totalSubscriptions.toLocaleString()}</h3>
            <p>Total landlord system access payments.</p>
          </article>

          <article className="card" style={{ gridColumn: 'span 3' }}>
            <div className="card-label">Active</div>
            <h3 style={{ fontSize: '34px', margin: 0 }}>{activeSubscriptions}</h3>
            <p>Landlords with active access.</p>
          </article>

          <article className="card" style={{ gridColumn: 'span 3' }}>
            <div className="card-label">Overdue</div>
            <h3 style={{ fontSize: '34px', margin: 0, color: 'var(--rose)' }}>{overdueSubscriptions}</h3>
            <p>Renewals requiring follow-up.</p>
          </article>

          <article className="card" style={{ gridColumn: 'span 3' }}>
            <div className="card-label">Pending</div>
            <h3 style={{ fontSize: '34px', margin: 0, color: 'var(--amber)' }}>{expiringSubscriptions}</h3>
            <p>Payments awaiting confirmation.</p>
          </article>

          <article className="card card-pm" style={{ gridColumn: 'span 12' }}>
            <div className="card-label">Landlord Subscriptions</div>
            <h3 style={{ marginBottom: 16 }}>System Access Payments</h3>

            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '14px' }}>
                <thead>
                  <tr style={{ borderBottom: '1px solid var(--line)' }}>
                    <th style={{ textAlign: 'left', padding: '12px', color: 'var(--ink-2)' }}>Landlord</th>
                    <th style={{ textAlign: 'left', padding: '12px', color: 'var(--ink-2)' }}>Plan</th>
                    <th style={{ textAlign: 'left', padding: '12px', color: 'var(--ink-2)' }}>Amount</th>
                    <th style={{ textAlign: 'left', padding: '12px', color: 'var(--ink-2)' }}>Start</th>
                    <th style={{ textAlign: 'left', padding: '12px', color: 'var(--ink-2)' }}>Expiry</th>
                    <th style={{ textAlign: 'left', padding: '12px', color: 'var(--ink-2)' }}>Status</th>
                    <th style={{ textAlign: 'left', padding: '12px', color: 'var(--ink-2)' }}>Action</th>
                  </tr>
                </thead>
                <tbody>
                  {subscriptions.length === 0 ? (
                    <tr>
                      <td colSpan={7} style={{ padding: '24px', color: 'var(--ink-3)', textAlign: 'center' }}>No subscription payments recorded yet.</td>
                    </tr>
                  ) : subscriptions.map((subscription) => (
                    <tr key={subscription.id} style={{ borderBottom: '1px solid var(--line-soft)' }}>
                      <td style={{ padding: '14px 12px' }}>
                        <strong>{subscription.admin_name}</strong>
                        <div style={{ color: 'var(--ink-3)', fontSize: '12px' }}>{subscription.email}</div>
                      </td>
                      <td style={{ padding: '14px 12px', textTransform: 'capitalize' }}>{subscription.plan}</td>
                      <td style={{ padding: '14px 12px', color: 'var(--accent)', fontWeight: 700 }}>KSH {Number(subscription.amount).toLocaleString()}</td>
                      <td style={{ padding: '14px 12px', color: 'var(--ink-3)' }}>{subscription.start_date}</td>
                      <td style={{ padding: '14px 12px', color: 'var(--ink-3)' }}>{subscription.expiry_date}</td>
                      <td style={{ padding: '14px 12px' }}>
                        <span style={{
                          display: 'inline-block',
                          padding: '4px 10px',
                          borderRadius: '999px',
                          fontSize: '12px',
                          fontWeight: 700,
                          background: subscription.status === 'paid' || subscription.status === 'active' ? 'rgba(16,185,129,0.12)' : subscription.status === 'overdue' ? 'rgba(220,38,38,0.1)' : 'rgba(245,158,11,0.1)',
                          color: subscription.status === 'paid' || subscription.status === 'active' ? 'var(--accent)' : subscription.status === 'overdue' ? '#dc2626' : 'var(--amber)'
                        }}>{subscription.status}</span>
                      </td>
                      <td style={{ padding: '14px 12px' }}>
                        <button className="btn btn-ghost" style={{ fontSize: '12px', padding: '6px 10px', background: 'rgba(245,158,11,0.1)', color: '#92400e' }} onClick={() => markOverdue(subscription)}>Mark Overdue</button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </article>
        </div>
      </section>

      <footer>
        <div className="footer-inner">
          <div className="footer-brand">
            <span className="logo-mark" style={{width:26,height:26,borderRadius:7}}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M3 21h18"/><path d="M5 21V7l8-4v18"/><path d="M19 21V11l-6-4"/></svg>
            </span>
            Springfield Systems
          </div>
          <div className="footer-links">
            <a href="/">Home</a>
            <a href="/super-admin">Dashboard</a>
          </div>
          <div className="footer-copy">© 2024 Springfield Systems. All rights reserved.</div>
        </div>
      </footer>
    </>
  );
}
