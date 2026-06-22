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

      <section className="card" style={{ marginTop: 24 }}>
        {payments.length === 0 ? <p style={{ color: 'var(--ink-3)' }}>No payments recorded yet.</p> : (
          <div className="table-shell">
            <table className="landlord-table">
              <thead><tr><th>Date</th><th>Type</th><th>Amount</th><th>Balance</th></tr></thead>
              <tbody>
                {payments.map(p => (
                  <tr key={p.id}>
                    <td>{p.created_at ? new Date(p.created_at).toLocaleDateString() : ''}</td>
                    <td>{p.transaction_type.replace('_', ' ')}</td>
                    <td>{formatCurrency(p.amount)}</td>
                    <td style={{ color: p.balance_remaining > 0 ? '#dc2626' : 'var(--accent)' }}>{formatCurrency(p.balance_remaining)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </main>
  );
}