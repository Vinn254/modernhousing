'use client';

import { useEffect, useState } from 'react';

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
      <main className="container admin-no-hero" style={{ paddingBottom: 32 }}>
        <div className="card-admin-header" style={{ marginBottom: 20, padding: '24px 28px', borderRadius: 24, background: 'linear-gradient(135deg, #f8fff9 0%, #eefdf5 100%)', border: '1px solid rgba(16, 185, 129, 0.16)', boxShadow: '0 18px 45px rgba(15, 23, 42, 0.05)' }}>
          <div>
            <p className="heading">Payments</p>
            <p className="subheading">Review subscriptions, renewals, overdue access payments, and revenue in one clean overview.</p>
          </div>
        </div>

        <section style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 16, marginBottom: 20 }}>
          <article className="card" style={{ padding: 20, borderRadius: 20, background: 'linear-gradient(135deg, #ecfdf5 0%, #f8fffb 100%)', border: '1px solid rgba(16, 185, 129, 0.16)' }}>
            <div className="card-label">Revenue</div>
            <h3 style={{ fontSize: '30px', margin: '6px 0 4px' }}>KSH {totalSubscriptions.toLocaleString()}</h3>
            <p style={{ margin: 0, color: 'var(--ink-3)' }}>Total landlord system access payments.</p>
          </article>

          <article className="card" style={{ padding: 20, borderRadius: 20, background: 'linear-gradient(135deg, #eff6ff 0%, #f8fbff 100%)', border: '1px solid rgba(59, 130, 246, 0.16)' }}>
            <div className="card-label">Active</div>
            <h3 style={{ fontSize: '30px', margin: '6px 0 4px' }}>{activeSubscriptions}</h3>
            <p style={{ margin: 0, color: 'var(--ink-3)' }}>Landlords with active access.</p>
          </article>

          <article className="card" style={{ padding: 20, borderRadius: 20, background: 'linear-gradient(135deg, #fff7ed 0%, #fffdf8 100%)', border: '1px solid rgba(245, 158, 11, 0.18)' }}>
            <div className="card-label">Pending</div>
            <h3 style={{ fontSize: '30px', margin: '6px 0 4px', color: 'var(--amber)' }}>{expiringSubscriptions}</h3>
            <p style={{ margin: 0, color: 'var(--ink-3)' }}>Payments awaiting confirmation.</p>
          </article>

          <article className="card" style={{ padding: 20, borderRadius: 20, background: 'linear-gradient(135deg, #fef2f2 0%, #fff8f8 100%)', border: '1px solid rgba(239, 68, 68, 0.16)' }}>
            <div className="card-label">Overdue</div>
            <h3 style={{ fontSize: '30px', margin: '6px 0 4px', color: 'var(--rose)' }}>{overdueSubscriptions}</h3>
            <p style={{ margin: 0, color: 'var(--ink-3)' }}>Renewals requiring follow-up.</p>
          </article>
        </section>

        <section className="card" style={{ padding: 0, borderRadius: 24, border: '1px solid rgba(15, 23, 42, 0.06)', boxShadow: '0 18px 45px rgba(15, 23, 42, 0.06)', overflow: 'hidden' }}>
          <div style={{ padding: '20px 22px', borderBottom: '1px solid #eef2f7', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
            <div>
              <div className="card-label">System access payments</div>
              <h3 style={{ margin: '4px 0 0' }}>Landlord subscriptions</h3>
            </div>
            <div style={{ fontSize: 13, color: 'var(--ink-3)' }}>{subscriptions.length} records</div>
          </div>

          <div style={{ padding: 20 }}>
            {loading && <p className="landlord-muted">Loading subscriptions…</p>}
            {message && <p className="landlord-success">{message}</p>}
            {error && <p className="landlord-error">{error}</p>}

            {subscriptions.length === 0 ? (
              <p className="landlord-empty">No subscription payments recorded yet.</p>
            ) : (
              <div className="table-shell">
                <table className="landlord-table">
                  <thead>
                    <tr>
                      <th>Landlord</th>
                      <th>Plan</th>
                      <th>Amount</th>
                      <th>Start</th>
                      <th>Expiry</th>
                      <th>Status</th>
                      <th>Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {subscriptions.map((subscription) => (
                      <tr key={subscription.id}>
                        <td>
                          <strong>{subscription.admin_name}</strong>
                          <div style={{ color: 'var(--ink-3)', fontSize: '12px' }}>{subscription.email}</div>
                        </td>
                        <td style={{ textTransform: 'capitalize' }}>{subscription.plan}</td>
                        <td style={{ color: 'var(--accent)', fontWeight: 700 }}>KSH {Number(subscription.amount).toLocaleString()}</td>
                        <td>{subscription.start_date}</td>
                        <td>{subscription.expiry_date}</td>
                        <td>
                          <span className={`status-pill ${subscription.status === 'paid' || subscription.status === 'active' ? 'status-active' : subscription.status === 'overdue' ? 'status-pending danger' : 'status-pending'}`}>
                            {subscription.status}
                          </span>
                        </td>
                        <td>
                          <button className="action-button" onClick={() => markOverdue(subscription)}>Mark Overdue</button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </section>
      </main>

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
          <div className="footer-copy">© 2026 Springfield Systems. All rights reserved.</div>
        </div>
      </footer>
    </>
  );
}