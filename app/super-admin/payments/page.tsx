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
      <main className="container admin-no-hero" style={{ padding: '34px 0 80px' }}>
        <div className="card-admin-header">
          <div>
            <p className="heading">Payments</p>
            <p className="subheading">Review landlord subscription payments, renewals, overdue access payments, and system revenue.</p>
          </div>
        </div>

        <section className="bento-section">
          <div className="bento">
            <article className="card">
              <div className="card-label">Landlord Subscriptions</div>
              <h3 style={{ fontSize: '34px', margin: 0 }}>KSH {totalSubscriptions.toLocaleString()}</h3>
              <p>Total landlord system access payments.</p>
            </article>

            <article className="card">
              <div className="card-label">Active</div>
              <h3 style={{ fontSize: '34px', margin: 0 }}>{activeSubscriptions}</h3>
              <p>Landlords with active access.</p>
            </article>

            <article className="card">
              <div className="card-label">Overdue</div>
              <h3 style={{ fontSize: '34px', margin: 0, color: 'var(--rose)' }}>{overdueSubscriptions}</h3>
              <p>Renewals requiring follow-up.</p>
            </article>

            <article className="card">
              <div className="card-label">Pending</div>
              <h3 style={{ fontSize: '34px', margin: 0, color: 'var(--amber)' }}>{expiringSubscriptions}</h3>
              <p>Payments awaiting confirmation.</p>
            </article>

            <article className="card">
              <div className="card-label">System Access Payments</div>
              <h3 style={{ marginBottom: 16 }}>Landlord Subscriptions</h3>

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
            </article>
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