'use client';

import { useEffect, useState } from 'react';
import { supabase } from '../../../lib/supabaseClient';

interface Payment {
  id: string;
  tenant: string;
  tenant_email: string;
  property: string;
  amount: number;
  balance_remaining: number;
  created_at: string;
  transaction_type: string;
  description: string;
}

export default function PaymentsPage() {
  const [payments, setPayments] = useState<Payment[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  async function getAuthHeaders() {
    const { data } = await supabase.auth.getSession();
    const headers: Record<string, string> = { 'Content-Type': 'application/json' };
    if (data.session?.access_token) headers.Authorization = `Bearer ${data.session.access_token}`;
    return headers;
  }

  async function loadData() {
    setLoading(true);
    setError('');

    try {
      const response = await fetch('/api/payments', { headers: await getAuthHeaders() });
      const result = await response.json();

      if (!response.ok) throw new Error(result.message ?? 'Failed to load payments');

      setPayments(result.payments ?? []);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadData();
  }, []);

  const formatCurrency = (value: number) => new Intl.NumberFormat('en-KE', { style: 'currency', currency: 'KES' }).format(value);

  return (
    <>
      <main className="container admin-no-hero" style={{ padding: '34px 0 80px' }}>
        <div className="card-admin-header">
          <div>
            <p className="heading">Financial Monitoring</p>
            <p className="subheading">Review rent collection, utility payments, outstanding balances, and revenue reports.</p>
          </div>
        </div>

        <section className="bento-section">
          <div className="bento">
            <article className="card">
              <div className="card-label"><span className="badge badge-pm">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><rect x="1" y="4" width="22" height="16" rx="2"/><line x1="1" y1="10" x2="23" y2="10"/></svg>
              </span>Payments</div>
              <h3 style={{ marginBottom: 16 }}>Transaction Records</h3>

              {loading && <p className="landlord-muted">Loading payments...</p>}
              {error && <p className="landlord-error">{error}</p>}

              {!loading && payments.length === 0 && <p className="landlord-empty">No payments recorded yet.</p>}

              {!loading && payments.length > 0 && (
                <div className="table-shell">
                  <table className="landlord-table">
                    <thead>
                      <tr>
                        <th>Tenant</th>
                        <th>Type</th>
                        <th>Amount</th>
                        <th>Balance</th>
                        <th>Date</th>
                      </tr>
                    </thead>
                    <tbody>
                      {payments.map(payment => (
                        <tr key={payment.id}>
                          <td className="landlord-name">{payment.tenant}</td>
                          <td>{payment.transaction_type}</td>
                          <td>{formatCurrency(payment.amount)}</td>
                          <td style={{ color: payment.balance_remaining > 0 ? '#dc2626' : 'var(--accent)', fontWeight: 600 }}>
                            {formatCurrency(payment.balance_remaining)}
                          </td>
                          <td>{payment.created_at ? new Date(payment.created_at).toLocaleDateString() : ''}</td>
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
          <div className="footer-brand"><span className="logo-mark" style={{ width: 26, height: 26, borderRadius: 7 }}><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M3 21h18"/><path d="M5 21V7l8-4v18"/><path d="M19 21V11l-6-4"/></svg></span>Springfield Systems</div>
          <div className="footer-links"><a href="/">Home</a><a href="/dashboard">Dashboard</a></div>
          <div className="footer-copy">© 2026 Springfield Systems. All rights reserved.</div>
        </div>
      </footer>
    </>
  );
}