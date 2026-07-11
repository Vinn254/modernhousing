'use client';

import { useEffect, useState } from 'react';
import { supabase } from '../../../lib/supabaseClient';

interface Bill {
  id: string;
  description: string;
  month_due: string;
  due_amount: number;
  paid_amount: number;
  penalty_fee: number;
  balance: number;
  transaction_type: string;
  payment_date: string;
  transaction_number?: string;
  created_at: string;
}

interface Invoice {
  id: string;
  invoice_type: string;
  description: string;
  amount: number;
  due_date: string;
  status: string;
  month_due: string;
  file_path?: string;
  created_at: string;
}

export default function TenantPaymentsPage() {
  const [user, setUser] = useState<any>(null);
  const [bills, setBills] = useState<Bill[]>([]);
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [loading, setLoading] = useState(true);
  const [mpesaPhone, setMpesaPhone] = useState('');
  const [mpesaAmount, setMpesaAmount] = useState('');
  const [processing, setProcessing] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [paymentSettings, setPaymentSettings] = useState({ paybill: '', till: '', pochi: '', mobile: '', paybillAccount: '' });

  const formatCurrency = (value: number) => new Intl.NumberFormat('en-KE', { style: 'currency', currency: 'KES' }).format(value);

  async function loadPayments(email: string, tenantId: string | null = null) {
    setLoading(true);
    const { data: { session } } = await supabase.auth.getSession();
    const headers: Record<string, string> = { 'Content-Type': 'application/json' };
    if (session?.access_token) headers.Authorization = `Bearer ${session.access_token}`;

    const billsUrl = tenantId 
      ? `/api/bills?tenantId=${tenantId}` 
      : `/api/bills?tenantEmail=${encodeURIComponent(email)}`;

    const [billsResponse, paymentsResponse, settingsResponse, invoicesResponse] = await Promise.all([
      fetch(billsUrl, { headers }).catch(() => null),
      fetch(`/api/payments?email=${encodeURIComponent(email)}`, { headers }).catch(() => null),
      fetch(tenantId ? `/api/payment-settings?tenantId=${tenantId}` : '/api/payment-settings', { headers }).catch(() => null),
      fetch(`/api/invoices?tenantId=${tenantId}`, { headers }).catch(() => null),
    ]);

    let allBills: Bill[] = [];

    if (billsResponse?.ok) {
      const billsResult = await billsResponse.json();
      // Show all bills (rent, overdue, deposit, utilities)
      allBills = (billsResult.bills ?? []).map((b: any) => ({
        id: b.id,
        description: b.description,
        month_due: b.month_due,
        due_amount: b.due_amount || 0,
        paid_amount: b.paid_amount || 0,
        penalty_fee: b.penalty_fee || 0,
        balance: b.balance || 0,
        transaction_type: b.transaction_type,
        payment_date: b.payment_date,
        transaction_number: b.transaction_number,
        created_at: b.created_at,
      }));
    }

    if (paymentsResponse?.ok) {
      const paymentsResult = await paymentsResponse.json();
      // Map payments to bills format
      const legacyBills = (paymentsResult.payments ?? []).map((p: any) => ({
        id: p.id,
        description: p.description,
        month_due: p.month_due,
        due_amount: p.due_amount || p.amount || 0,
        paid_amount: p.amount || 0,
        penalty_fee: 0,
        balance: p.balance_remaining || 0,
        transaction_type: p.transaction_type || 'rent',
        payment_date: p.paid_at?.split('T')[0] || null,
        created_at: p.paid_at || p.created_at,
      }));
      allBills = [...allBills, ...legacyBills];
    }

    // Sort by date descending, then calculate running balance
    allBills.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
    
    // Calculate proper balance: apply payments to oldest balances first
    let runningBalance = 0;
    const billsWithCalculatedBalance = allBills.map(bill => {
      const effectiveBalance = bill.balance + runningBalance;
      runningBalance = effectiveBalance > 0 ? effectiveBalance : 0;
      return { ...bill, calculated_balance: effectiveBalance };
    });
    
    setBills(billsWithCalculatedBalance);

    if (invoicesResponse?.ok) {
      const invoicesResult = await invoicesResponse.json();
      setInvoices(invoicesResult.invoices ?? []);
    }

    if (settingsResponse?.ok) {
      const settings = await settingsResponse.json();
      setPaymentSettings(settings);
    }
    setLoading(false);
  }

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      if (data.user?.email) {
        setUser(data.user);
        const tenantId = data.user?.user_metadata?.tenant_id ?? null;
        loadPayments(data.user.email, tenantId);
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
      method: 'POST', headers,
      body: JSON.stringify({
        phone: mpesaPhone,
        amount: Number(mpesaAmount),
        accountReference: 'SPRINGFIELD',
        transactionDesc: 'Rent Payment'
      }),
    });
    const result = await response.json();
    setProcessing(false);
    if (!response.ok) { setError(result.message ?? 'Payment failed'); return; }
    setMessage('M-Pesa prompt sent. Complete payment on your phone.');
    setMpesaPhone(''); setMpesaAmount('');
  }

  const totalOutstanding = bills.reduce((sum, b) => sum + Number(b.balance || 0), 0);

  const getTypeLabel = (type: string) => {
    const map: Record<string, string> = {
      rent: 'Rent',
      overdue: 'Overdue',
      deposit: 'Deposit',
      water: 'Water',
      garbage: 'Garbage',
      service_charge: 'Service Charge',
      parking: 'Parking',
      security: 'Security',
      other: 'Other',
    };
    return map[type] || type;
  };

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
        <div><p className="heading">Tenant Payment History</p><p className="subheading">Monthly rent payments, utility bills, and invoices.</p></div>
      </div>

      {user && (
        <section className="card-grid" style={{ marginBottom: 24 }}>
          <article className="card">
            <div className="card-label">Make Payment</div>
            <h3>Pay via M-Pesa STK Push</h3>
            <form onSubmit={handleStkPush} className="form-grid">
              <input type="tel" value={mpesaPhone} onChange={e => setMpesaPhone(e.target.value)} required placeholder="M-Pesa Phone (07XX XXX XXX)" />
              <input type="number" value={mpesaAmount} onChange={e => setMpesaAmount(e.target.value)} required placeholder="Amount (KES)" min="1" />
              <button type="submit" disabled={processing}>{processing ? 'Processing…' : 'Pay Now'}</button>
            </form>
            
            {paymentSettings.paybill && (
              <div style={{ marginTop: 12, padding: 12, background: 'var(--surface)', borderRadius: 8, fontSize: '13px' }}>
                <strong>Paybill:</strong> {paymentSettings.paybill}{paymentSettings.paybillAccount ? ` (Account: ${paymentSettings.paybillAccount})` : ''}
              </div>
            )}
            {paymentSettings.till && (
              <div style={{ marginTop: 8, padding: 12, background: 'var(--surface)', borderRadius: 8, fontSize: '13px' }}>
                <strong>Till:</strong> {paymentSettings.till}
              </div>
            )}
            {paymentSettings.pochi && (
              <div style={{ marginTop: 8, padding: 12, background: 'var(--surface)', borderRadius: 8, fontSize: '13px' }}>
                <strong>Pochi la Biashara:</strong> {paymentSettings.pochi}
              </div>
            )}
            {paymentSettings.mobile && (
              <div style={{ marginTop: 8, padding: 12, background: 'var(--surface)', borderRadius: 8, fontSize: '13px' }}>
                <strong>Mobile:</strong> {paymentSettings.mobile}
              </div>
            )}
            
            {message && <p className="landlord-success" style={{ marginTop: 16 }}>{message}</p>}
            {error && <p className="landlord-error" style={{ marginTop: 16 }}>{error}</p>}
          </article>
        </section>
      )}

      <section className="card" style={{ marginTop: 24 }}>
        <div className="card-label">PAYMENT INSTRUCTIONS</div>
        <h3 style={{ marginBottom: 16 }}>How to Pay</h3>
        <p style={{ color: '#111827', marginBottom: 12 }}>Use these details for manual payments:</p>
        <div style={{ padding: 12, background: 'var(--line-soft)', borderRadius: 8 }}>
          {paymentSettings.paybill && <div><strong>Paybill:</strong> {paymentSettings.paybill}{paymentSettings.paybillAccount ? ` (Account: ${paymentSettings.paybillAccount})` : ''}</div>}
          {paymentSettings.till && <div><strong>Till:</strong> {paymentSettings.till}</div>}
          {paymentSettings.pochi && <div><strong>Pochi la Biashara:</strong> {paymentSettings.pochi}</div>}
          {paymentSettings.mobile && <div><strong>Mobile:</strong> {paymentSettings.mobile}</div>}
          {!paymentSettings.paybill && !paymentSettings.till && !paymentSettings.pochi && !paymentSettings.mobile && <div style={{ color: 'var(--ink-3)' }}>No payment details configured. Contact your landlord.</div>}
        </div>
      </section>

      {invoices.length > 0 && (
        <section className="card" style={{ marginTop: 24 }}>
          <div className="card-label">INVOICES</div>
          <h3 style={{ marginBottom: 16 }}>Download Invoices</h3>
          <div className="table-shell">
            <table className="landlord-table">
              <thead>
                <tr>
                  <th>Month</th>
                  <th>Type</th>
                  <th>Description</th>
                  <th>Amount</th>
                  <th>Due Date</th>
                  <th>Status</th>
                  <th>Download</th>
                </tr>
              </thead>
              <tbody>
                {invoices.map(invoice => (
                  <tr key={invoice.id}>
                    <td>{invoice.month_due || '-'}</td>
                    <td style={{ textTransform: 'capitalize' }}>{invoice.invoice_type}</td>
                    <td>{invoice.description}</td>
                    <td>{formatCurrency(invoice.amount)}</td>
                    <td>{invoice.due_date ? new Date(invoice.due_date).toLocaleDateString() : '-'}</td>
                    <td>
                      <span className={`status-pill ${invoice.status === 'paid' ? 'status-active' : 'status-pending'}`}>
                        {invoice.status}
                      </span>
                    </td>
                    <td>
                      {invoice.file_path && (
                        <a href={`/api/invoices/download/${invoice.id}`} className="action-button primary" style={{ padding: '4px 8px', fontSize: '11px' }}>Download</a>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}

      <section className="card" style={{ marginTop: 24 }}>
        <div className="card-label">TRANSACTION HISTORY</div>
        <h3 style={{ marginBottom: 16 }}>Payment Records</h3>
        
        {bills.length === 0 ? (
          <p className="landlord-empty">No bills recorded yet.</p>
        ) : (
          <div className="table-shell" style={{ maxHeight: '500px', overflowY: 'auto' }}>
            <table className="landlord-table" style={{ minWidth: '100%', fontSize: '12px' }}>
              <thead>
                <tr>
                  <th>Month</th>
                  <th>Description</th>
                  <th>Type</th>
                  <th>Due Amount</th>
                  <th>Paid</th>
                  <th>Penalty</th>
                  <th>Balance</th>
                  <th>Payment Date</th>
                </tr>
              </thead>
              <tbody>
                {bills.map(bill => (
                  <tr key={bill.id}>
                    <td style={{ textTransform: 'capitalize' }}>{bill.month_due || '-'}</td>
                    <td>{bill.description}</td>
                    <td><span style={{ textTransform: 'capitalize', fontSize: '11px' }}>{getTypeLabel(bill.transaction_type)}</span></td>
                    <td>{formatCurrency(bill.due_amount)}</td>
                    <td>{formatCurrency(bill.paid_amount)}</td>
                    <td>{formatCurrency(bill.penalty_fee || 0)}</td>
                    <td style={{ color: bill.balance > 0 ? '#dc2626' : 'var(--accent)', fontWeight: 600 }}>
                      {formatCurrency(bill.balance)}
                    </td>
                    <td>{bill.payment_date ? new Date(bill.payment_date).toLocaleDateString() : '-'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section className="card" style={{ marginTop: 24 }}>
        <div className="card-label">BALANCE SUMMARY</div>
        <div style={{ padding: '16px', background: 'var(--line-soft)', borderRadius: '8px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '18px', fontWeight: 700 }}>
            <span>Total Outstanding:</span>
            <span style={{ color: totalOutstanding > 0 ? '#dc2626' : 'var(--accent)' }}>{formatCurrency(totalOutstanding)}</span>
          </div>
        </div>
      </section>
    </main>
  );
}