'use client';

import { useEffect, useState } from 'react';
import { supabase } from '../../../lib/supabaseClient';

interface Payment {
  id: string;
  amount: number;
  balance_remaining: number;
  created_at: string;
  paid_at?: string;
  transaction_type: string;
  description: string;
  month_due?: string;
  due_amount?: number;
  transaction_number?: string;
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
  unit?: string;
  property?: string;
  tenants?: { full_name?: string; units?: { unit_number?: string; properties?: { name?: string } } };
}

export default function TenantPaymentsPage() {
  const [user, setUser] = useState<any>(null);
  const [payments, setPayments] = useState<Payment[]>([]);
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [loading, setLoading] = useState(true);
  const [mpesaPhone, setMpesaPhone] = useState('');
  const [mpesaAmount, setMpesaAmount] = useState('');
  const [processing, setProcessing] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [activeTab, setActiveTab] = useState<'rent' | 'utility' | 'combined'>('rent');
  const [paymentSettings, setPaymentSettings] = useState({ paybill: '', till: '', pochi: '', mobile: '', paybillAccount: '' });

  const formatCurrency = (value: number) => new Intl.NumberFormat('en-KE', { style: 'currency', currency: 'KES' }).format(value);

  async function loadPayments(email: string, tenantId: string | null = null) {
    setLoading(true);
    const { data: { session } } = await supabase.auth.getSession();
    const headers: Record<string, string> = { 'Content-Type': 'application/json' };
    if (session?.access_token) headers.Authorization = `Bearer ${session.access_token}`;

    const [paymentsResponse, invoicesResponse, settingsResponse] = await Promise.all([
      fetch(`/api/tenant/payments?email=${encodeURIComponent(email)}`, { headers }).catch(() => null),
      fetch(`/api/invoices?tenantEmail=${encodeURIComponent(email)}`, { headers }).catch(() => null),
      fetch(tenantId ? `/api/payment-settings?tenantId=${tenantId}` : '/api/payment-settings', { headers }).catch(() => null),
    ]);

    if (paymentsResponse?.ok) {
      const paymentsResult = await paymentsResponse.json();
      setPayments(paymentsResult.payments ?? []);
    }
    if (invoicesResponse?.ok) {
      const invoicesResult = await invoicesResponse.json();
      const processed = (invoicesResult.invoices ?? []).map((inv: any) => ({
        ...inv,
        unit: inv.tenants?.units?.unit_number,
        property: inv.tenants?.units?.properties?.name,
      }));
      setInvoices(processed);
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

  const unpaidInvoices = invoices.filter(inv => inv.status === 'sent');
  const waterInvoices = invoices.filter(inv => inv.invoice_type === 'water');
  const otherUtilityInvoices = invoices.filter(inv => ['garbage', 'service_charge', 'parking', 'security', 'other', 'utility'].includes(inv.invoice_type));

  const rentBalance = payments.reduce((sum, p) => sum + Number(p.balance_remaining || 0), 0);
  const utilityBillTotal = unpaidInvoices.reduce((sum, inv) => sum + Number(inv.amount || 0), 0);
  const combinedTotal = rentBalance + utilityBillTotal;

  const renderInvoiceDownload = (inv: Invoice) => {
    const invoiceWindow = window.open('', '_blank');
    if (invoiceWindow) {
      invoiceWindow.document.write(`
        <html>
          <head><title>Invoice ${inv.id.slice(0, 8)}</title>
          <style>body { font-family: system-ui; padding: 24px; } .header { text-align: center; margin-bottom: 24px; } .item { margin: 8px 0; } .total { font-weight: bold; font-size: 18px; border-top: 1px solid #ccc; padding-top: 12px; }</style>
          </head>
          <body>
            <div class="header"><h2>SPRINGFIELD SYSTEMS</h2><p>Property Management Invoice</p></div>
            <div class="item"><strong>Invoice #:</strong> ${inv.id.slice(0, 8)}</div>
            <div class="item"><strong>Date:</strong> ${inv.created_at ? new Date(inv.created_at).toLocaleDateString() : ''}</div>
            <div class="item"><strong>Type:</strong> ${inv.invoice_type}</div>
            <div class="item"><strong>Description:</strong> ${inv.description}</div>
            ${inv.water_consumption ? `<div class="item"><strong>Water Consumption:</strong> ${inv.water_consumption} units</div>` : ''}
            <div class="item total">Amount Due: ${inv.amount.toLocaleString()} KES</div>
            <div class="item"><strong>Due Date:</strong> ${inv.due_date}</div>
          </body>
        </html>
      `);
      invoiceWindow.document.close();
    }
  };

  const renderCombinedInvoice = () => {
    const invoiceWindow = window.open('', '_blank');
    if (invoiceWindow) {
      invoiceWindow.document.write(`
        <html>
          <head><title>Combined Invoice</title>
          <style>body { font-family: system-ui; padding: 24px; } .header { text-align: center; margin-bottom: 24px; } .item { margin: 8px 0; } .total { font-weight: bold; font-size: 20px; border-top: 2px solid #333; padding-top: 12px; margin-top: 16px; }</style>
          </head>
          <body>
            <div class="header"><h2>SPRINGFIELD SYSTEMS</h2><p>Combined Invoice - All Outstanding Bills</p></div>
            <div class="item"><strong>Date:</strong> ${new Date().toLocaleDateString()}</div>
            <hr style="margin: 16px 0;">
            <h3 style="margin-bottom: 8px;">Rent Payments</h3>
            ${payments.filter(p => p.transaction_type === 'rent').length > 0 ? payments.filter(p => p.balance_remaining > 0).map(p => `
              <div class="item">${p.month_due || p.description}: ${formatCurrency(p.balance_remaining)} due</div>
            `).join('') : '<div class="item">No outstanding rent balances</div>'}
            <h3 style="margin: 16px 0 8px 0;">Water Bills</h3>
            ${waterInvoices.length > 0 ? waterInvoices.filter(inv => inv.status === 'sent').map(inv => `
              <div class="item">${inv.description}: ${formatCurrency(inv.amount)} due (${inv.water_consumption} units)</div>
            `).join('') : '<div class="item">No outstanding water bills</div>'}
            <h3 style="margin: 16px 0 8px 0;">Other Utilities</h3>
            ${otherUtilityInvoices.length > 0 ? otherUtilityInvoices.filter(inv => inv.status === 'sent').map(inv => `
              <div class="item">${inv.description}: ${formatCurrency(inv.amount)} due</div>
            `).join('') : '<div class="item">No outstanding utility bills</div>'}
            <div class="total">Total Amount Due: ${formatCurrency(combinedTotal)}</div>
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
        <div><p className="heading">Payment History</p><p className="subheading">View your rent and utility invoices, make payments via M-Pesa.</p></div>
        <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
          <button className={`btn ${activeTab === 'rent' ? 'btn-primary' : 'btn-ghost'}`} onClick={() => setActiveTab('rent')} style={{ fontSize: '13px', padding: '6px 12px' }}>Rent Payments</button>
          <button className={`btn ${activeTab === 'utility' ? 'btn-primary' : 'btn-ghost'}`} onClick={() => setActiveTab('utility')} style={{ fontSize: '13px', padding: '6px 12px' }}>Utility Bills (Water/Electricity) {waterInvoices.length > 0 && waterInvoices.some(inv => inv.status === 'sent') && <span style={{ background: '#dc2626', color: '#fff', borderRadius: '50%', padding: '2px 6px', fontSize: '11px' }}>{waterInvoices.filter(inv => inv.status === 'sent').length}</span>}</button>
          <button className={`btn ${activeTab === 'combined' ? 'btn-primary' : 'btn-ghost'}`} onClick={() => setActiveTab('combined')} style={{ fontSize: '13px', padding: '6px 12px' }}>Combined Invoice {unpaidInvoices.length > 0 && <span style={{ background: '#dc2626', color: '#fff', borderRadius: '50%', padding: '2px 6px', fontSize: '11px' }}>{unpaidInvoices.length}</span>}</button>
        </div>
      </div>

{user && activeTab === 'rent' && (
         <section className="card-grid">
           <article className="card">
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

           {paymentSettings.paybill || paymentSettings.till || paymentSettings.pochi || paymentSettings.mobile ? (
             <article className="card">
               <div className="card-label">Payment Details</div>
               <h3>Manual Payment Instructions</h3>
               <p style={{ fontSize: '13px', color: '#111827', marginBottom: 12 }}>Use these details for manual payments via M-Pesa:</p>
               <div style={{ padding: 12, background: 'var(--surface)', borderRadius: 8, fontSize: '14px', color: '#111827' }}>
                 {paymentSettings.paybill && <div><strong>Paybill:</strong> {paymentSettings.paybill}{paymentSettings.paybillAccount ? ` (Account: ${paymentSettings.paybillAccount})` : ''}</div>}
                 {paymentSettings.till && <div><strong>Till:</strong> {paymentSettings.till}</div>}
                 {paymentSettings.pochi && <div><strong>Pochi la Biashara:</strong> {paymentSettings.pochi}</div>}
                 {paymentSettings.mobile && <div><strong>Mobile:</strong> {paymentSettings.mobile}</div>}
               </div>
             </article>
           ) : null}
         </section>
       )}

      {activeTab === 'rent' && payments.length > 0 && (
        <section className="card" style={{ marginTop: 24 }}>
          <div className="card-label">Rent Payment Records</div>
          <h3 style={{ marginBottom: 16 }}>All Rent Payments</h3>
          <div className="table-shell">
            <table className="landlord-table">
              <thead><tr><th>Date</th><th>Month Due</th><th>Due</th><th>Paid</th><th>Balance</th><th>Trans #</th></tr></thead>
              <tbody>
                {payments.map(p => (
                  <tr key={p.id}>
                    <td>{p.paid_at ? new Date(p.paid_at).toLocaleDateString() : (p.created_at ? new Date(p.created_at).toLocaleDateString() : '')}</td>
                    <td>{p.month_due || p.description}</td>
                    <td>{formatCurrency(p.due_amount ?? p.amount)}</td>
                    <td>{formatCurrency(p.amount)}</td>
                    <td style={{ color: p.balance_remaining > 0 ? '#dc2626' : 'var(--accent)' }}>{formatCurrency(p.balance_remaining)}</td>
                    <td style={{ fontSize: '12px' }}>{p.transaction_number || '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {activeTab === 'utility' && (
        <section className="card" style={{ marginTop: 24 }}>
          <div className="card-label">Utility Bills</div>
          <h3 style={{ marginBottom: 16 }}>Water & Other Utility Invoices</h3>
          {invoices.length === 0 ? (
            <p className="landlord-empty">No utility invoices found.</p>
          ) : (
            <div className="table-shell">
              <table className="landlord-table">
                <thead><tr><th>Issue Date</th><th>Type</th><th>Description</th><th>Consumption</th><th>Amount</th><th>Due Date</th><th>Status</th><th>Action</th></tr></thead>
                <tbody>
                  {invoices.map(inv => (
                    <tr key={inv.id}>
                      <td>{inv.created_at ? new Date(inv.created_at).toLocaleDateString() : ''}</td>
                      <td style={{ textTransform: 'capitalize' }}>{inv.invoice_type}</td>
                      <td>{inv.description}</td>
                      <td>{inv.water_consumption ? `${inv.water_consumption} units` : '—'}</td>
                      <td>{formatCurrency(inv.amount)}</td>
                      <td>{inv.due_date}</td>
                      <td>
                        <span style={{ padding: '3px 9px', borderRadius: '999px', fontSize: '11px', fontWeight: 700, background: inv.status === 'paid' ? 'rgba(16,185,129,0.12)' : 'rgba(245,158,11,0.12)', color: inv.status === 'paid' ? 'var(--accent)' : '#92400e' }}>
                          {inv.status}
                        </span>
                      </td>
                      <td>
                        <button className="btn btn-ghost" style={{ fontSize: '12px', padding: '4px 8px' }} onClick={() => renderInvoiceDownload(inv)}>Download PDF</button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      )}

      {activeTab === 'combined' && (
        <section className="card" style={{ marginTop: 24 }}>
          <div className="card-label">Combined Invoice</div>
          <h3 style={{ marginBottom: 16 }}>Total Outstanding Bills</h3>
          <div style={{ padding: '16px', background: 'var(--line-soft)', borderRadius: '8px', marginBottom: 16 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '18px', fontWeight: 700 }}>
              <span>Total Amount Due:</span>
              <span style={{ color: combinedTotal > 0 ? '#dc2626' : 'var(--accent)' }}>{formatCurrency(combinedTotal)}</span>
            </div>
          </div>
          <button className="btn btn-primary" onClick={renderCombinedInvoice} style={{ fontSize: '14px', padding: '10px 20px' }}>Download Combined Invoice PDF</button>
          
          {combinedTotal > 0 && (
            <div className="table-shell" style={{ marginTop: 16 }}>
              <table className="landlord-table">
                <thead><tr><th>Item</th><th>Amount</th><th>Due Date</th></tr></thead>
                <tbody>
                  {payments.filter(p => p.balance_remaining > 0).map(p => (
                    <tr key={`rent-${p.id}`}><td>Rent - {p.month_due || p.description}</td><td>{formatCurrency(p.balance_remaining)}</td><td>—</td></tr>
                  ))}
                  {invoices.filter(inv => inv.status === 'sent').map(inv => (
                    <tr key={`inv-${inv.id}`}><td>{inv.invoice_type === 'water' ? 'Water' : 'Utility'} - {inv.description}</td><td>{formatCurrency(inv.amount)}</td><td>{inv.due_date}</td></tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      )}

      {activeTab === 'rent' && payments.length === 0 && !message && (
        <p className="landlord-empty" style={{ marginTop: 24 }}>No rent payments recorded yet.</p>
      )}
    </main>
  );
}