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
  transaction_number: string;
  transaction_code: string;
  payment_date: string;
  payment_method: string;
  reference_number: string;
  created_at: string;
}

const months = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

export default function TenantPaymentsPage() {
  const [user, setUser] = useState<any>(null);
  const [bills, setBills] = useState<Bill[]>([]);
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

    const [billsResponse, paymentsResponse, settingsResponse] = await Promise.all([
      fetch(billsUrl, { headers }).catch(() => null),
      fetch(`/api/payments?email=${encodeURIComponent(email)}`, { headers }).catch(() => null),
      fetch(tenantId ? `/api/payment-settings?tenantId=${tenantId}` : '/api/payment-settings', { headers }).catch(() => null),
    ]);

    const allBills: Bill[] = [];

    if (billsResponse?.ok) {
      const billsResult = await billsResponse.json();
      (billsResult.bills ?? []).forEach((b: any) => allBills.push(b));
    }

    if (paymentsResponse?.ok) {
      const paymentsResult = await paymentsResponse.json();
      (paymentsResult.payments ?? []).forEach((p: any) => {
        allBills.push({
          id: p.id,
          description: p.description,
          month_due: p.month_due || '',
          due_amount: p.due_amount || 0,
          paid_amount: p.amount || 0,
          penalty_fee: 0,
          balance: p.balance_remaining || 0,
          transaction_type: p.transaction_type || 'rent',
          transaction_number: p.transaction_number || '',
          transaction_code: p.transaction_code || '',
          payment_date: p.paid_at ? new Date(p.paid_at).toISOString().split('T')[0] : '',
          payment_method: p.payment_method || '',
          reference_number: p.reference_number || '',
          created_at: p.created_at,
        });
      });
    }

    setBills(allBills);
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

  // Group bills by month
  const billsByMonth: Record<string, Bill[]> = {};
  bills.forEach(bill => {
    const monthKey = bill.month_due || 'No Month';
    if (!billsByMonth[monthKey]) billsByMonth[monthKey] = [];
    billsByMonth[monthKey].push(bill);
  });

  const monthlyTotals = Object.entries(billsByMonth).map(([month, monthBills]) => ({
    month,
    rent: monthBills.filter(b => b.transaction_type === 'rent').reduce((sum, b) => sum + Number(b.balance || 0), 0),
    water: monthBills.filter(b => b.transaction_type === 'water').reduce((sum, b) => sum + Number(b.balance || 0), 0),
    utilities: monthBills.filter(b => !['rent', 'water'].includes(b.transaction_type)).reduce((sum, b) => sum + Number(b.balance || 0), 0),
    total: monthBills.reduce((sum, b) => sum + Number(b.balance || 0), 0),
  }));

  const totalOutstanding = monthlyTotals.reduce((sum, m) => sum + m.total, 0);

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
        <div><p className="heading">Tenant Payment History</p><p className="subheading">BEDSITTER MAIN - Monthly rent and utility billing</p></div>
      </div>

      {user && (
        <section className="card-grid" style={{ marginBottom: 24 }}>
          <article className="card">
            <div className="card-label">Make Payment</div>
            <h3>Pay via M-Pesa</h3>
            <form onSubmit={handleStkPush} className="form-grid">
              <input type="tel" value={mpesaPhone} onChange={e => setMpesaPhone(e.target.value)} required placeholder="M-Pesa Phone (07XX XXX XXX)" />
              <input type="number" value={mpesaAmount} onChange={e => setMpesaAmount(e.target.value)} required placeholder="Amount (KES)" min="1" />
              <button type="submit" disabled={processing}>{processing ? 'Processing…' : 'Pay Now'}</button>
            </form>
            {paymentSettings.paybill && <div style={{ marginTop: 12, padding: 12, background: 'var(--surface)', borderRadius: 8, fontSize: '13px' }}><strong>Paybill:</strong> {paymentSettings.paybill}</div>}
            {message && <p className="landlord-success" style={{ marginTop: 16 }}>{message}</p>}
            {error && <p className="landlord-error" style={{ marginTop: 16 }}>{error}</p>}
          </article>
        </section>
      )}

      <section className="card" style={{ marginTop: 24 }}>
        <div className="card-label">MONTHLY TRANSACTION STATEMENT - BED SITTER MAIN</div>
        <h3 style={{ marginBottom: 16 }}>Bills by Month</h3>
        
        {Object.keys(billsByMonth).length === 0 ? (
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
                {Object.entries(billsByMonth).map(([month, monthBills]) => (
                  <>
                    <tr key={`header-${month}`} style={{ background: 'var(--line-soft)' }}>
                      <td colSpan={7} style={{ fontWeight: 700, textTransform: 'capitalize' }}>{month}</td>
                    </tr>
                    {monthBills.map(bill => (
                      <tr key={bill.id}>
                        <td></td>
                        <td>{bill.description}</td>
                        <td><span style={{ textTransform: 'capitalize', fontSize: '11px' }}>{bill.transaction_type}</span></td>
                        <td>{bill.due_amount.toLocaleString()}</td>
                        <td>{bill.paid_amount.toLocaleString() || '-'}</td>
                        <td>{(bill.penalty_fee || 0).toLocaleString()}</td>
                        <td style={{ color: bill.balance > 0 ? '#dc2626' : 'var(--accent)' }}>{bill.balance.toLocaleString()}</td>
                        <td>{bill.payment_date || '-'}</td>
                      </tr>
                    ))}
                  </>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section className="card" style={{ marginTop: 24 }}>
        <div className="card-label">Monthly Summary</div>
        <div style={{ padding: '16px', background: 'var(--line-soft)', borderRadius: '8px' }}>
          {monthlyTotals.map(m => (
            <div key={m.month} style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8, borderBottom: '1px solid var(--line)', paddingBottom: 8 }}>
              <span>{m.month}:</span>
              <span style={{ color: m.total > 0 ? '#dc2626' : 'var(--accent)', fontWeight: 600 }}>{formatCurrency(m.total)}</span>
            </div>
          ))}
          <hr style={{ margin: '12px 0' }} />
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '18px', fontWeight: 700 }}>
            <span>Total Outstanding:</span>
            <span style={{ color: totalOutstanding > 0 ? '#dc2626' : 'var(--accent)' }}>{formatCurrency(totalOutstanding)}</span>
          </div>
        </div>
      </section>
    </main>
  );
}