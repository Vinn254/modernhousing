'use client';

import { useEffect, useState } from 'react';
import { supabase } from '../../../lib/supabaseClient';

interface Payment {
  id: string;
  amount: number;
  balance_remaining: number;
  created_at: string;
  transaction_type: string;
  description: string;
}

export default function TenantPaymentsPage() {
  const [user, setUser] = useState<any>(null);
  const [payments, setPayments] = useState<Payment[]>([]);
  const [loading, setLoading] = useState(true);
  const [mpesaPhone, setMpesaPhone] = useState('');
  const [mpesaAmount, setMpesaAmount] = useState('');
  const [processing, setProcessing] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  const formatCurrency = (value: number) => new Intl.NumberFormat('en-KE', { style: 'currency', currency: 'KES' }).format(value);

  async function loadPayments(userId: string) {
    setLoading(true);
    const { data: { session } } = await supabase.auth.getSession();
    const response = await fetch(`/api/tenant/payments?userId=${encodeURIComponent(userId)}`, {
      headers: session?.access_token ? { Authorization: `Bearer ${session.access_token}` } : undefined,
    });
    const result = await response.json();
    if (response.ok) setPayments(result.payments ?? []);
    setLoading(false);
  }

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      if (data.user) {
        setUser(data.user);
        loadPayments(data.user.id);
      }
    });
  }, []);

  async function handleStkPush(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    
    const { data: { session } } = await supabase.auth.getSession();
    const headers: Record<string, string> = { 'Content-Type': 'application/json' };
    if (session?.access_token) headers.Authorization = `Bearer ${session.access_token}`;

    setProcessing(true);
    const response = await fetch('/api/mpesa/stk-push', {
      method: 'POST',
      headers,
      body: JSON.stringify({
        phone: mpesaPhone,
        amount: Number(mpesaAmount),
        accountReference: 'SPRINGFIELD',
        transactionDesc: 'Rent Payment'
      }),
    });

    const result = await response.json();
    setProcessing(false);

    if (!response.ok) {
      setError(result.message ?? 'Payment failed');
      return;
    }

    setMessage('M-Pesa prompt sent. Complete payment on your phone.');
    setMpesaPhone('');
    setMpesaAmount('');
  }

  if (loading) {
    return (
      <main className="container page-layout">
        <div className="card">Loading payment history…</div>
      </main>
    );
  }

  return (
    <main className="container page-layout">
      <div className="card-admin-header">
        <div><p className="heading">Payment History</p><p className="subheading">View all your rent and utility payments.</p></div>
      </div>

      {user && (
        <article className="card" style={{ marginTop: 24, maxWidth: '480px' }}>
          <div className="card-label">Make Payment</div>
          <h3>Pay Rent via M-Pesa</h3>
          <form onSubmit={handleStkPush} className="form-grid">
            <input type="tel" value={mpesaPhone} onChange={e => setMpesaPhone(e.target.value)} required placeholder="M-Pesa Phone (07XX XXX XXX)" />
            <input type="number" value={mpesaAmount} onChange={e => setMpesaAmount(e.target.value)} required placeholder="Amount (KES)" min="1" />
            <button type="submit" disabled={processing}>{processing ? 'Processing…' : 'Pay Now'}</button>
          </form>
          {message && <p className="landlord-success" style={{ marginTop: 16 }}>{message}</p>}
          {error && <p className="landlord-error" style={{ marginTop: 16 }}>{error}</p>}
        </article>
      )}

      {loading ? <p className="landlord-muted" style={{ marginTop: 24 }}>Loading payments...</p> : null}

      {!loading && payments.length > 0 && (
        <section className="card" style={{ marginTop: 24 }}>
          <div className="card-label">Payment Records</div>
          <h3 style={{ marginBottom: 16 }}>All Payments</h3>
          <div className="table-shell">
            <table className="landlord-table">
              <thead><tr><th>Date</th><th>Month Due</th><th>Paid</th><th>Balance</th><th>Type</th></tr></thead>
              <tbody>
                {payments.map(p => (
                  <tr key={p.id}>
                    <td>{p.created_at ? new Date(p.created_at).toLocaleDateString() : ''}</td>
                    <td>{(p as any).month_due || p.description}</td>
                    <td>{formatCurrency(p.amount)}</td>
                    <td style={{ color: p.balance_remaining > 0 ? '#dc2626' : 'var(--accent)' }}>{formatCurrency(p.balance_remaining)}</td>
                    <td style={{ textTransform: 'capitalize' }}>{(p as any).transaction_type || 'rent'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {!loading && payments.length === 0 && !message && (
        <p className="landlord-empty" style={{ marginTop: 24 }}>No payments recorded yet.</p>
      )}
    </main>
  );
}