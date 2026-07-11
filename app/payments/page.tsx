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
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const [mpesaPhone, setMpesaPhone] = useState('');
  const [mpesaAmount, setMpesaAmount] = useState('');
  const [processing, setProcessing] = useState(false);
  const [userRole, setUserRole] = useState('');

  const [manualDate, setManualDate] = useState(new Date().toISOString().slice(0, 10));
  const [manualMonth, setManualMonth] = useState('');
  const [manualDueAmount, setManualDueAmount] = useState('');
  const [manualPaidAmount, setManualPaidAmount] = useState('');
  const [manualBalAmount, setManualBalAmount] = useState('');
  const [manualTransType, setManualTransType] = useState('rent');
  const [manualTransNumber, setManualTransNumber] = useState('');
  const [manualTransCode, setManualTransCode] = useState('');
  const [manualPaymentMethod, setManualPaymentMethod] = useState('Cash');

  const transactionTypes = [
    { value: 'rent', label: 'Rent' },
    { value: 'overdue', label: 'Overdue' },
    { value: 'deposit', label: 'Deposit' },
  ];

  const [paybill, setPaybill] = useState('');
  const [paybillAccount, setPaybillAccount] = useState('');
  const [till, setTill] = useState('');
  const [pochi, setPochi] = useState('');
  const [mobile, setMobile] = useState('');
  const [consumerKey, setConsumerKey] = useState('');
  const [consumerSecret, setConsumerSecret] = useState('');
  const [passkey, setPasskey] = useState('');
  const [showSettings, setShowSettings] = useState(false);
  const [selectedMethod, setSelectedMethod] = useState<'paybill' | 'till' | 'pochi' | 'mobile'>('paybill');

  const paymentMethods = [
    { value: 'paybill', label: 'Paybill' },
    { value: 'till', label: 'Till' },
    { value: 'pochi', label: 'Pochi la Biashara' },
    { value: 'mobile', label: 'Mobile Number' },
  ] as const;

  async function loadPayments() {
    const response = await fetch('/api/bills', { headers: await getAuthHeaders() });
    const result = await response.json();
    if (!response.ok) {
      setError(result.message ?? 'Unable to load payments.');
      setLoading(false);
      return;
    }
    // Map bills to payments format for display - only rent, overdue, deposit
    const mappedPayments = (result.bills ?? [])
      .filter((b: any) => b.transaction_type === 'rent' || b.transaction_type === 'overdue' || b.transaction_type === 'deposit')
      .map((b: any) => ({
        id: b.id,
        tenant: b.tenant_name || '—',
        tenant_email: '',
        property: '',
        unit: b.unit_number || '—',
        description: b.description,
        transaction_type: b.transaction_type,
        amount: b.paid_amount || 0,
        due_amount: b.due_amount || 0,
        month_due: b.month_due,
        balance_remaining: b.balance || 0,
        status: b.balance === 0 ? 'paid' : 'pending',
        transaction_number: b.transaction_number,
        created_at: b.created_at,
      }));
    setPayments(mappedPayments);
    setLoading(false);
  }

  async function loadTenants() {
    const response = await fetch('/api/tenants', { headers: await getAuthHeaders() });
    const result = await response.json();
    if (response.ok) setTenants(result.tenants ?? []);
  }

  async function loadSettings() {
    const response = await fetch('/api/payment-settings', { headers: await getAuthHeaders() });
    const result = await response.json();
    if (response.ok) {
      setPaybill(result.paybill ?? '');
      setPaybillAccount(result.paybillAccount ?? '');
      setTill(result.till ?? '');
      setPochi(result.pochi ?? '');
      setMobile(result.mobile ?? '');
      setConsumerKey(result.consumerKey ?? '');
      setConsumerSecret(result.consumerSecret ?? '');
      setPasskey(result.passkey ?? '');
    }
  }

  async function saveSettings(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const response = await fetch('/api/payment-settings', {
      method: 'POST',
      headers: await getAuthHeaders(),
      body: JSON.stringify({
        paybill, paybillAccount, till, pochi, mobile, consumerKey, consumerSecret, passkey,
      }),
    });

    const result = await response.json();
    if (response.ok) {
      setMessage('Payment settings saved.');
      setShowSettings(false);
    } else {
      setError(result.message ?? 'Unable to save settings.');
    }
  }

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      setUserRole(data?.user?.user_metadata?.role || '');
    });
    Promise.all([loadPayments(), loadTenants(), loadSettings()]);
  }, []);

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

    const response = await fetch('/api/bills', {
      method: 'POST',
      headers: await getAuthHeaders(),
      body: JSON.stringify({
        tenantId,
        description: `${manualMonth || 'Rent'} payment`,
        monthDue: manualMonth,
        dueAmount: Number(manualDueAmount) || 0,
        paidAmount: Number(manualPaidAmount) || 0,
        transactionType: manualTransType,
        paymentMethod: manualPaymentMethod,
        referenceNumber: manualTransNumber,
        transactionCode: manualTransCode || null,
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
    setManualPaymentMethod('Cash');
    await loadPayments();
  }

  const formatCurrency = (value: number) => new Intl.NumberFormat('en-KE', { style: 'currency', currency: 'KES' }).format(value);

return (
    <main className="container">
      <div className="card-admin-header">
        <p className="heading">Rent Payments</p>
        <p className="subheading">Record rent transactions, track balances, and view payment history.</p>
      </div>

      {message && <p style={{ color: 'var(--accent)', fontWeight: 700, marginBottom: 16 }}>{message}</p>}
      {error && <p style={{ color: '#dc2626', fontWeight: 700, marginBottom: 16 }}>{error}</p>}

      <section className="card-grid">
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
            <select value={manualTransType} onChange={(event) => setManualTransType(event.target.value)}>
              {transactionTypes.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
            </select>
            <input type="number" step="0.01" value={manualDueAmount} onChange={(event) => setManualDueAmount(event.target.value)} placeholder="Due Amount" />
            <input type="number" step="0.01" value={manualPaidAmount} onChange={(event) => setManualPaidAmount(event.target.value)} required placeholder="Amount Paid" />
            <select value={manualPaymentMethod} onChange={(event) => setManualPaymentMethod(event.target.value)}>
              <option value="Cash">Cash</option>
              <option value="M-pesa">M-pesa</option>
              <option value="Bank Transfer">Bank Transfer</option>
            </select>
            <input value={manualTransNumber} onChange={(event) => setManualTransNumber(event.target.value)} required placeholder="Transaction/Receipt Number" />
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

      {userRole !== 'tenant' && (
        <article className="card" style={{ marginTop: 24 }}>
          <div className="card-label">Payment Instructions</div>
          <h3 style={{ marginBottom: 16 }}>Tenant Payment Details</h3>
          <p style={{ color: '#111827', marginBottom: 12 }}>Share these details with tenants for manual payments via M-Pesa:</p>
          <div style={{ padding: 12, background: 'var(--surface)', borderRadius: 8, fontSize: '14px', color: '#111827' }}>
            {paybill && <div><strong>Paybill:</strong> {paybill}{paybillAccount ? ` (Account: ${paybillAccount})` : ''}</div>}
            {till && <div><strong>Till:</strong> {till}</div>}
            {pochi && <div><strong>Pochi la Biashara:</strong> {pochi}</div>}
            {mobile && <div><strong>Mobile:</strong> {mobile}</div>}
            {!paybill && !till && !pochi && !mobile && <div>No payment details configured. Click "Edit Payment Details" to add.</div>}
          </div>
          <button onClick={() => setShowSettings(true)} className="btn btn-ghost" style={{ marginTop: 12, fontSize: '14px', padding: '10px 16px', fontWeight: 600, background: '#f3f4f6', color: '#111827', border: '1px solid #d1d5db' }}>Edit Payment Details</button>
        </article>
      )}

      {showSettings && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.5)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div className="card" style={{ maxWidth: 500, width: '90%' }}>
            <div className="card-label">Payment Settings</div>
            <h3 style={{ marginBottom: 16 }}>Configure Daraja & Payment Details</h3>
            <form onSubmit={saveSettings} className="form-grid">
              <h4 style={{ margin: '16px 0 8px', fontSize: '14px' }}>M-Pesa Daraja Keys</h4>
              <input value={consumerKey} onChange={e => setConsumerKey(e.target.value)} placeholder="Consumer Key" />
              <input value={consumerSecret} onChange={e => setConsumerSecret(e.target.value)} placeholder="Consumer Secret" />
              <input value={passkey} onChange={e => setPasskey(e.target.value)} placeholder="Passkey" />

              <h4 style={{ margin: '16px 0 8px', fontSize: '14px' }}>Payment Method Selection</h4>
              <select value={selectedMethod} onChange={e => setSelectedMethod(e.target.value as any)}>
                {paymentMethods.map(m => <option key={m.value} value={m.value}>{m.label}</option>)}
              </select>

              <h4 style={{ margin: '16px 0 8px', fontSize: '14px' }}>Payment Number</h4>
              {selectedMethod === 'paybill' && (
                <>
                  <input value={paybill} onChange={e => setPaybill(e.target.value)} placeholder="Paybill Number" />
                  <input value={paybillAccount} onChange={e => setPaybillAccount(e.target.value)} placeholder="Account Number" />
                </>
              )}
              {selectedMethod === 'till' && <input value={till} onChange={e => setTill(e.target.value)} placeholder="Till Number" />}
              {selectedMethod === 'pochi' && <input value={pochi} onChange={e => setPochi(e.target.value)} placeholder="Pochi Number" />}
              {selectedMethod === 'mobile' && <input value={mobile} onChange={e => setMobile(e.target.value)} placeholder="Mobile Number" />}

              <div style={{ display: 'flex', gap: 8, marginTop: 16 }}>
                <button type="submit">Save Settings</button>
                <button type="button" onClick={() => setShowSettings(false)} className="btn btn-ghost">Cancel</button>
              </div>
            </form>
          </div>
        </div>
      )}

      <article className="card" style={{ marginTop: 24 }}>
        <div className="card-label">Transactions</div>
        <h3 style={{ marginBottom: 16 }}>Payment History</h3>
        {loading ? <p style={{ color: '#111827' }}>Loading payments…</p> : payments.length === 0 ? (
          <p style={{ color: '#111827' }}>No payments recorded yet.</p>
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