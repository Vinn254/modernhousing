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
  month_due?: string;
  due_amount?: number;
  penalty_fee?: number;
  transaction_number?: string;
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
  const [mpesaPhone, setMpesaPhone] = useState('');
  const [mpesaAmount, setMpesaAmount] = useState('');
  const [processing, setProcessing] = useState(false);
  
  const [manualDate, setManualDate] = useState(new Date().toISOString().slice(0, 10));
  const [manualMonth, setManualMonth] = useState('');
  const [manualDueAmount, setManualDueAmount] = useState('');
  const [manualPaidAmount, setManualPaidAmount] = useState('');
  const [manualBalAmount, setManualBalAmount] = useState('');
  const [manualTransType, setManualTransType] = useState('rent');
  const [manualTransNumber, setManualTransNumber] = useState('');
  const [manualTransCode, setManualTransCode] = useState('');

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

  async function handleStkPush(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setProcessing(true);
    
    const response = await fetch('/api/mpesa/stk-push', {
      method: 'POST',
      headers: await getAuthHeaders(),
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
      setError(result.message ?? 'STK push failed');
      return;
    }

    setMessage('M-Pesa prompt sent successfully.');
    setMpesaPhone('');
    setMpesaAmount('');
  }

  async function handleManualPayment(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setMessage('');
    setError('');

    const response = await fetch('/api/payments', {
      method: 'POST',
      headers: await getAuthHeaders(),
      body: JSON.stringify({
        tenantId,
        description: `${manualMonth || 'Rent'} payment`,
        transactionType: manualTransType,
        amount: Number(manualPaidAmount),
        balanceRemaining: Number(manualBalAmount),
        monthDue: manualMonth,
        dueAmount: Number(manualDueAmount),
        paidAmount: Number(manualPaidAmount),
        transNumber: manualTransNumber,
        transCode: manualTransCode,
        paymentDate: manualDate
      }),
    });

    const result = await response.json();

    if (!response.ok) {
      setError(result.message || 'Unable to record payment.');
      return;
    }

    setMessage('Payment recorded successfully.');
    setTenantId('');
    setManualMonth('');
    setManualDueAmount('');
    setManualPaidAmount('');
    setManualBalAmount('');
    setManualTransType('rent');
    setManualTransNumber('');
    setManualTransCode('');
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

      <section className="payments-form-grid" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20, alignItems: 'start' }}>
        <div className="card">
          <div className="card-label">Manual Payment Entry</div>
          <h3 style={{ marginBottom: 16 }}>Record Direct Payment</h3>
          <form onSubmit={handleManualPayment} className="form-grid">
            <select value={tenantId} onChange={(event) => setTenantId(event.target.value)} required>
              <option value="">Select tenant</option>
              {tenants.map((tenant) => <option key={tenant.id} value={tenant.id}>{tenant.full_name} — {tenant.property} · Unit {tenant.unit}</option>)}
            </select>
            <input type="date" value={manualDate} onChange={(event) => setManualDate(event.target.value)} required placeholder="Payment Date" />
            <input value={manualMonth} onChange={(event) => setManualMonth(event.target.value)} placeholder="Month Due (e.g., January 2024)" />
            <input type="number" step="0.01" value={manualDueAmount} onChange={(event) => setManualDueAmount(event.target.value)} placeholder="Due Amount" />
            <input type="number" step="0.01" value={manualPaidAmount} onChange={(event) => setManualPaidAmount(event.target.value)} required placeholder="Amount Paid" />
            <input type="number" step="0.01" value={manualBalAmount} onChange={(event) => setManualBalAmount(event.target.value)} placeholder="Balance" />
            <select value={manualTransType} onChange={(event) => setManualTransType(event.target.value)}>
              <option value="rent">Rent</option>
              <option value="overdue">Overdue</option>
              <option value="other">Other</option>
            </select>
            <input value={manualTransNumber} onChange={(event) => setManualTransNumber(event.target.value)} required placeholder="Transaction Number" />
            <input value={manualTransCode} onChange={(event) => setManualTransCode(event.target.value)} placeholder="Transaction Code (MPESA code)" />
            <button type="submit" style={{ gridColumn: 'span 2' }}>Record Payment</button>
          </form>
          {error && <p className="landlord-error" style={{ marginTop: 16 }}>{error}</p>}
        </div>

        <div className="card">
          <div className="card-label">M-Pesa Payment</div>
          <h3 style={{ marginBottom: 16 }}>Send STK Prompt</h3>
          <form onSubmit={handleStkPush} className="form-grid">
            <input type="tel" value={mpesaPhone} onChange={e => setMpesaPhone(e.target.value)} required placeholder="Tenant Phone (07XX XXX XXX)" />
            <input type="number" value={mpesaAmount} onChange={e => setMpesaAmount(e.target.value)} required placeholder="Amount (KES)" min="1" />
            <button type="submit" disabled={processing} style={{ gridColumn: 'span 2' }}>{processing ? 'Sending…' : 'Send Prompt'}</button>
          </form>
          {message && <p className="landlord-success" style={{ marginTop: 16 }}>{message}</p>}
        </div>
      </section>

      <article className="card" style={{ marginTop: 24 }}>
        <div className="card-label">Transactions</div>
        <h3 style={{ marginBottom: 16 }}>Payment History</h3>
        {loading ? <p style={{ color: 'var(--ink-3)' }}>Loading payments…</p> : payments.length === 0 ? (
          <p style={{ color: 'var(--ink-3)' }}>No payments recorded yet.</p>
        ) : (
          <div className="table-shell">
            <table className="landlord-table">
              <thead>
                <tr>
                  <th>Tenant</th>
                  <th>Month Due</th>
                  <th>Due</th>
                  <th>Paid</th>
                  <th>Balance</th>
                  <th>Type</th>
                  <th>Trans #</th>
                  <th>Date</th>
                </tr>
              </thead>
              <tbody>
                {payments.map((payment) => (
                  <tr key={payment.id}>
                    <td className="landlord-name">{payment.tenant}</td>
                    <td>{(payment as any).month_due || payment.description}</td>
                    <td>{formatCurrency((payment as any).due_amount || payment.amount)}</td>
                    <td>{formatCurrency(payment.amount)}</td>
                    <td style={{ color: payment.balance_remaining > 0 ? '#dc2626' : 'var(--accent)' }}>{formatCurrency(payment.balance_remaining)}</td>
                    <td style={{ textTransform: 'capitalize' }}>{(payment as any).transaction_type || 'rent'}</td>
                    <td style={{ fontSize: '12px' }}>{(payment as any).transaction_number || '—'}</td>
                    <td>{payment.created_at ? new Date(payment.created_at).toLocaleDateString() : '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </article>
    </main>
  );
}
