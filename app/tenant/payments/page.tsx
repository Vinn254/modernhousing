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

interface Invoice {
  id: string;
  invoice_type: 'rent' | 'water' | 'utility' | 'other';
  description: string;
  amount: number;
  water_consumption?: number;
  due_date: string;
  status: string;
  month_due?: string;
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

    // Fetch bills by tenantId or email (fallback)
    let billsUrl = '/api/bills';
    if (tenantId) {
      billsUrl = `/api/bills?tenantId=${tenantId}`;
    } else {
      billsUrl = `/api/bills?tenantEmail=${encodeURIComponent(email)}`;
    }

    const [billsResponse, paymentsResponse, invoicesResponse, settingsResponse] = await Promise.all([
      fetch(billsUrl, { headers }).catch(() => null),
      fetch(`/api/payments?email=${encodeURIComponent(email)}`, { headers }).catch(() => null),
      fetch(`/api/invoices?tenantEmail=${encodeURIComponent(email)}`, { headers }).catch(() => null),
      fetch(tenantId ? `/api/payment-settings?tenantId=${tenantId}` : '/api/payment-settings', { headers }).catch(() => null),
    ]);

    // Combine bills and payments into single view
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

  // Calculate monthly totals
  const currentMonth = new Date().toISOString().slice(0, 7);
  const monthlyBills = bills.filter(b => b.month_due?.startsWith(currentMonth));
  
  const monthlyRent = bills.filter(b => b.transaction_type === 'rent').reduce((sum, b) => sum + Number(b.balance || 0), 0);
  const monthlyWater = bills.filter(b => b.transaction_type === 'water').reduce((sum, b) => sum + Number(b.balance || 0), 0);
  const monthlyUtilities = bills.filter(b => ['garbage', 'service_charge', 'parking', 'security', 'other', 'utility'].includes(b.transaction_type)).reduce((sum, b) => sum + Number(b.balance || 0), 0);
  
  const totalOutstanding = bills.reduce((sum, b) => sum + Number(b.balance || 0), 0);

  const renderInvoiceDownload = () => {
    const invoiceWindow = window.open('', '_blank');
    if (invoiceWindow) {
      invoiceWindow.document.write(`
        <html>
          <head><title>Invoice</title>
          <style>
            body { font-family: system-ui; padding: 24px; } 
            .header { text-align: center; margin-bottom: 24px; } 
            .item { margin: 8px 0; } 
            .total { font-weight: bold; font-size: 20px; border-top: 2px solid #333; padding-top: 12px; margin-top: 16px; }
          </style>
          </head>
          <body>
            <div class="header"><h2>SPRINGFIELD SYSTEMS</h2><p>Tenant Invoice - BED SITTER MAIN</p></div>
            <div class="item"><strong>Date:</strong> ${new Date().toLocaleDateString('en-GB')}</div>
            <div class="item"><strong>Tenant:</strong> ${user?.email || ''}</div>
            <hr style="margin: 16px 0;">
            <table style="width: 100%; border-collapse: collapse;">
              <thead>
                <tr style="border-bottom: 2px solid #333;">
                  <th style="text-align: left;">Date</th>
                  <th style="text-align: left;">Description</th>
                  <th style="text-align: left;">Month Due</th>
                  <th style="text-align: right;">Due Amount</th>
                  <th style="text-align: right;">Paid</th>
                  <th style="text-align: right;">Penalty</th>
                  <th style="text-align: right;">Balance</th>
                </tr>
              </thead>
              <tbody>
                ${bills.filter(b => b.balance > 0).map(b => `
                  <tr style="border-bottom: 1px solid #ccc;">
                    <td>${new Date(b.created_at).toLocaleDateString('en-GB')}</td>
                    <td>${b.description}</td>
                    <td>${b.month_due || '-'}</td>
                    <td style="text-align: right;">${b.due_amount.toLocaleString()}</td>
                    <td style="text-align: right;">${b.paid_amount.toLocaleString() || '-'}</td>
                    <td style="text-align: right;">${(b.penalty_fee || 0).toLocaleString()}</td>
                    <td style="text-align: right; color: #dc2626;">${b.balance.toLocaleString()}</td>
                  </tr>
                `).join('')}
              </tbody>
            </table>
            <div class="total" style="text-align: right;">Total Due: ${formatCurrency(totalOutstanding)}</div>
          </body>
        </html>
      `);
      invoiceWindow.document.close();
    }
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
            {paymentSettings.paybill || paymentSettings.till || paymentSettings.pochi || paymentSettings.mobile ? (
              <div style={{ marginTop: 12, padding: 12, background: 'var(--surface)', borderRadius: 8, fontSize: '13px' }}>
                <strong>Manual Payment:</strong><br />
                {paymentSettings.paybill && <div>Paybill: {paymentSettings.paybill}{paymentSettings.paybillAccount ? ` (Account: ${paymentSettings.paybillAccount})` : ''}</div>}
                {paymentSettings.till && <div>Till: {paymentSettings.till}</div>}
              </div>
            ) : null}
            {message && <p className="landlord-success" style={{ marginTop: 16 }}>{message}</p>}
            {error && <p className="landlord-error" style={{ marginTop: 16 }}>{error}</p>}
          </article>
        </section>
      )}

      <section className="card" style={{ marginTop: 24 }}>
        <div className="card-label">MONTHLY BILLING - BED SITTER MAIN</div>
        <h3 style={{ marginBottom: 16 }}>Transaction Statement</h3>
        {bills.length === 0 ? (
          <p className="landlord-empty">No bills recorded yet.</p>
        ) : (
          <div className="table-shell" style={{ maxHeight: '500px', overflowY: 'auto' }}>
            <table className="landlord-table" style={{ minWidth: '100%', fontSize: '12px' }}>
              <thead>
                <tr>
                  <th>Date</th>
                  <th>Description</th>
                  <th>Month Due</th>
                  <th>Due Amount</th>
                  <th>Amount Paid</th>
                  <th>Penalty Fee</th>
                  <th>Balance</th>
                  <th>Type</th>
                  <th>Trans #</th>
                  <th>Code</th>
                  <th>Payment Date</th>
                </tr>
              </thead>
              <tbody>
                {bills.map(bill => (
                  <tr key={bill.id}>
                    <td>{new Date(bill.created_at).toLocaleDateString('en-GB')}</td>
                    <td>{bill.description}</td>
                    <td>{bill.month_due || '-'}</td>
                    <td>{bill.due_amount.toLocaleString()}</td>
                    <td>{bill.paid_amount.toLocaleString() || '-'}</td>
                    <td>{(bill.penalty_fee || 0).toLocaleString()}</td>
                    <td style={{ color: bill.balance > 0 ? '#dc2626' : 'var(--accent)' }}>{bill.balance.toLocaleString()}</td>
                    <td style={{ textTransform: 'capitalize' }}>{bill.transaction_type}</td>
                    <td>{bill.transaction_number || '-'}</td>
                    <td>{bill.transaction_code || '-'}</td>
                    <td>{bill.payment_date || '-'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {bills.length > 0 && (
        <section className="card" style={{ marginTop: 24 }}>
          <div className="card-label">Monthly Summary</div>
          <div style={{ padding: '16px', background: 'var(--line-soft)', borderRadius: '8px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
              <span>Rent Total:</span>
              <span style={{ color: monthlyRent > 0 ? '#dc2626' : 'var(--accent)' }}>{formatCurrency(monthlyRent)}</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
              <span>Water Total:</span>
              <span style={{ color: monthlyWater > 0 ? '#dc2626' : 'var(--accent)' }}>{formatCurrency(monthlyWater)}</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
              <span>Other Utilities:</span>
              <span style={{ color: monthlyUtilities > 0 ? '#dc2626' : 'var(--accent)' }}>{formatCurrency(monthlyUtilities)}</span>
            </div>
            <hr style={{ margin: '12px 0' }} />
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '18px', fontWeight: 700 }}>
              <span>Total Outstanding:</span>
              <span style={{ color: totalOutstanding > 0 ? '#dc2626' : 'var(--accent)' }}>{formatCurrency(totalOutstanding)}</span>
            </div>
          </div>
          <button className="btn btn-primary" onClick={renderInvoiceDownload} style={{ marginTop: 16, fontSize: '14px', padding: '10px 20px' }}>Download Invoice PDF</button>
        </section>
      )}
    </main>
  );
}