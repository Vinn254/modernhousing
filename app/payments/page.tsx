'use client';

import { useEffect, useState } from 'react';
import { supabase } from '../../lib/supabaseClient';

interface TenantOption {
  id: string;
  full_name: string;
  email: string;
  unit?: string;
  property?: string;
}

interface Payment {
  id: string;
  tenant: string;
  tenant_email: string;
  property: string;
  unit: string;
  description: string;
  transaction_type: string;
  amount: number;
  balance_remaining: number;
  status: string;
  next_payment_date: string;
  created_at: string;
}

async function getAuthHeaders() {
  const { data } = await supabase.auth.getSession();
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (data.session?.access_token) headers.Authorization = `Bearer ${data.session.access_token}`;
  return headers;
}

export default function PaymentsPage() {
  const [payments, setPayments] = useState<Payment[]>([]);
  const [tenants, setTenants] = useState<TenantOption[]>([]);
  const [tenantId, setTenantId] = useState('');
  const [description, setDescription] = useState('');
  const [transactionType, setTransactionType] = useState('rent');
  const [amount, setAmount] = useState('');
  const [balanceRemaining, setBalanceRemaining] = useState('');
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);

  async function loadPayments() {
    const response = await fetch('/api/payments', { headers: await getAuthHeaders() });
    const result = await response.json();
    if (!response.ok) {
      setError(result.message ?? 'Unable to load payments.');
      setLoading(false);
      return;
    }
    setPayments(result.payments ?? []);
    setLoading(false);
  }

  async function loadTenants() {
    const response = await fetch('/api/tenants', { headers: await getAuthHeaders() });
    const result = await response.json();
    if (response.ok) setTenants(result.tenants ?? []);
  }

  useEffect(() => {
    Promise.all([loadPayments(), loadTenants()]);
  }, []);

  async function handleCreate(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setMessage('');
    setError('');

    const response = await fetch('/api/payments', {
      method: 'POST',
      headers: await getAuthHeaders(),
      body: JSON.stringify({ tenantId, description, transactionType, amount: Number(amount), balanceRemaining: Number(balanceRemaining) }),
    });

    const result = await response.json();

    if (!response.ok) {
      setError(result.message || 'Unable to record payment.');
      return;
    }

    setMessage('Payment recorded successfully.');
    setTenantId('');
    setDescription('');
    setTransactionType('rent');
    setAmount('');
    setBalanceRemaining('');
    await loadPayments();
  }

  const formatCurrency = (value: number) => new Intl.NumberFormat('en-KE', { style: 'currency', currency: 'KES' }).format(value);

  return (
    <main className="container" style={{ padding: '34px 0 80px' }}>
      <div className="card-admin-header">
        <p className="heading">Payments</p>
        <p className="subheading">Record rent transactions, track balances, and view due dates.</p>
      </div>

      {message && <p style={{ color: 'var(--accent)', fontWeight: 700, marginBottom: 16 }}>{message}</p>}
      {error && <p style={{ color: '#dc2626', fontWeight: 700, marginBottom: 16 }}>{error}</p>}

      <section style={{ display: 'grid', gridTemplateColumns: 'minmax(320px, 420px) 1fr', gap: 20, alignItems: 'start' }}>
        <div className="card">
          <div className="card-label">Payment Entry</div>
          <h3 style={{ marginBottom: 16 }}>Record Payment</h3>
          <form onSubmit={handleCreate} className="form-grid">
            <select value={tenantId} onChange={(event) => setTenantId(event.target.value)} required>
              <option value="">Select tenant</option>
              {tenants.map((tenant) => <option key={tenant.id} value={tenant.id}>{tenant.full_name} — {tenant.property} · Unit {tenant.unit}</option>)}
            </select>
            <input value={description} onChange={(event) => setDescription(event.target.value)} required placeholder="Description" />
            <select value={transactionType} onChange={(event) => setTransactionType(event.target.value)}>
              <option value="rent">Rent</option>
              <option value="overdue">Overdue</option>
              <option value="other">Other</option>
            </select>
            <input type="number" step="0.01" value={amount} onChange={(event) => setAmount(event.target.value)} required placeholder="Amount" />
            <input type="number" step="0.01" value={balanceRemaining} onChange={(event) => setBalanceRemaining(event.target.value)} required placeholder="Balance remaining" />
            <button type="submit" style={{ gridColumn: 'span 2' }}>Record Payment</button>
          </form>
        </div>

        <div className="card">
          <div className="card-label">Transactions</div>
          <h3 style={{ marginBottom: 16 }}>Payment History</h3>
          {loading ? <p style={{ color: 'var(--ink-3)' }}>Loading payments…</p> : payments.length === 0 ? (
            <p style={{ color: 'var(--ink-3)' }}>No payments recorded yet.</p>
          ) : (
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '14px' }}>
                <thead>
                  <tr style={{ borderBottom: '1px solid var(--line)' }}>
                    <th style={{ textAlign: 'left', padding: '12px', fontWeight: 700 }}>Tenant</th>
                    <th style={{ textAlign: 'left', padding: '12px', fontWeight: 700 }}>Description</th>
                    <th style={{ textAlign: 'left', padding: '12px', fontWeight: 700 }}>Amount</th>
                    <th style={{ textAlign: 'left', padding: '12px', fontWeight: 700 }}>Balance</th>
                    <th style={{ textAlign: 'left', padding: '12px', fontWeight: 700 }}>Status</th>
                    <th style={{ textAlign: 'left', padding: '12px', fontWeight: 700 }}>Date</th>
                  </tr>
                </thead>
                <tbody>
                  {payments.map((payment) => (
                    <tr key={payment.id} style={{ borderBottom: '1px solid var(--line-soft)' }}>
                      <td style={{ padding: '14px 12px' }}>
                        <strong>{payment.tenant}</strong>
                        <div style={{ color: 'var(--ink-3)', fontSize: '13px' }}>{payment.property} · Unit {payment.unit}</div>
                      </td>
                      <td style={{ padding: '14px 12px', color: 'var(--ink-3)' }}>{payment.description}</td>
                      <td style={{ padding: '14px 12px', fontWeight: 700 }}>{formatCurrency(payment.amount)}</td>
                      <td style={{ padding: '14px 12px', fontWeight: 700, color: payment.balance_remaining > 0 ? '#dc2626' : 'var(--accent)' }}>{formatCurrency(payment.balance_remaining)}</td>
                      <td style={{ padding: '14px 12px' }}>
                        <span style={{ display: 'inline-block', padding: '4px 10px', borderRadius: '999px', fontSize: '11px', fontWeight: 700, background: payment.status === 'paid' ? 'rgba(16,185,129,0.12)' : payment.status === 'overdue' ? 'rgba(220,38,38,0.1)' : 'rgba(245,158,11,0.12)', color: payment.status === 'paid' ? 'var(--accent)' : payment.status === 'overdue' ? '#dc2626' : 'var(--amber)' }}>{payment.status}</span>
                      </td>
                      <td style={{ padding: '14px 12px', color: 'var(--ink-3)' }}>{payment.created_at ? new Date(payment.created_at).toLocaleDateString() : '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </section>
    </main>
  );
}
