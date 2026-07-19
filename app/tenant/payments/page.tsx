'use client';

import { useEffect, useState } from 'react';
import { PDFDocument, rgb, StandardFonts } from 'pdf-lib';
import { supabase } from '../../../lib/supabaseClient';

interface Bill {
  id: string;
  description: string;
  month_due: string;
  due_amount: number;
  paid_amount: number;
  penalty_fee: number;
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

const MONTH_ORDER: Record<string, number> = {
  january: 1, february: 2, march: 3, april: 4, may: 5, june: 6,
  july: 7, august: 8, september: 9, october: 10, november: 11, december: 12,
};

function getMonthSortValue(month: string): number {
  const normalized = (month || '').toLowerCase();
  return MONTH_ORDER[normalized] || 0;
}

export default function TenantPaymentsPage() {
  const [user, setUser] = useState<any>(null);
  const [bills, setBills] = useState<Bill[]>([]);
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'payments' | 'utilities' | 'invoices'>('payments');
  const [mpesaPhone, setMpesaPhone] = useState('');
  const [mpesaAmount, setMpesaAmount] = useState('');
  const [processing, setProcessing] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [paymentSettings, setPaymentSettings] = useState({ paybill: '', till: '', pochi: '', mobile: '', paybillAccount: '' });
  const [paymentType, setPaymentType] = useState<'rent' | 'tenancy_agreement'>('rent');

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
      allBills = (billsResult.bills ?? []).map((b: any) => ({
        id: b.id,
        description: b.description,
        month_due: b.month_due,
        due_amount: Number(b.due_amount) || 0,
        paid_amount: Number(b.paid_amount) || 0,
        penalty_fee: Number(b.penalty_fee) || 0,
        transaction_type: b.transaction_type,
        payment_date: b.payment_date,
        transaction_number: b.transaction_number,
        created_at: b.created_at,
      }));
    }

    if (paymentsResponse?.ok) {
      const paymentsResult = await paymentsResponse.json();
      const legacyBills = (paymentsResult.payments ?? []).map((p: any) => ({
        id: p.id,
        description: p.description,
        month_due: p.month_due,
        due_amount: Number(p.due_amount) || Number(p.amount) || 0,
        paid_amount: Number(p.amount) || 0,
        penalty_fee: 0,
        transaction_type: p.transaction_type || 'rent',
        payment_date: p.paid_at?.split('T')[0] || null,
        created_at: p.paid_at || p.created_at,
      }));
      allBills = [...allBills, ...legacyBills];
    }

    allBills.sort((a, b) => {
      const aOrder = getMonthSortValue(a.month_due);
      const bOrder = getMonthSortValue(b.month_due);
      if (aOrder !== bOrder) return bOrder - aOrder;
      const isOverdueA = a.transaction_type === 'overdue';
      const isOverdueB = b.transaction_type === 'overdue';
      if (isOverdueA !== isOverdueB) return isOverdueA ? 1 : -1;
      return (b.created_at || '').localeCompare(a.created_at || '');
    });
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
       method: 'POST', headers,
      body: JSON.stringify({
         phone: mpesaPhone,
        amount: Number(mpesaAmount),
         transactionType: activeTab === 'payments' ? paymentType : 'utility',
        accountReference: user?.id || 'SPRINGFIELD',
         transactionDesc: activeTab === 'payments' 
           ? (paymentType === 'tenancy_agreement' ? 'Tenancy Agreement Fee' : 'Rent Payment')
           : 'Utility Payment'
       }),
     });
    const result = await response.json().catch(() => ({}));
    setProcessing(false);
    if (!response.ok) { setError(result.message ?? 'Payment failed - check landlord Daraja settings in Payment Settings'); return; }
    setMessage('M-Pesa prompt sent. Complete payment on your phone.');
    setMpesaPhone(''); setMpesaAmount('');
  }

  const rentBills = bills.filter(b => ['rent', 'overdue', 'deposit', 'tenancy_agreement'].includes(b.transaction_type));
  const utilityBills = bills.filter(b => ['water', 'garbage', 'service_charge', 'parking', 'security', 'internet', 'laundry', 'pet_fees', 'other'].includes(b.transaction_type));

  const calculateWithRunningBalance = (billsList: Bill[]) => {
    let runningBalance = 0;
    return billsList.map(bill => {
      const isOverdue = bill.transaction_type === 'overdue';
      const billBalance = isOverdue ? 0 : bill.due_amount - bill.paid_amount - bill.penalty_fee;
      const contribution = isOverdue
        ? bill.paid_amount
        : bill.paid_amount - bill.due_amount - bill.penalty_fee;
      runningBalance += contribution;
      return { ...bill, bill_balance: billBalance, running_balance: runningBalance };
    });
  };

  const rentWithBalance = calculateWithRunningBalance([...rentBills]);
  const utilityWithBalance = calculateWithRunningBalance([...utilityBills]);

  const totalRentOwed = rentWithBalance.length > 0 ? rentWithBalance[rentWithBalance.length - 1].running_balance : 0;
  const totalUtilityOwed = utilityWithBalance.length > 0 ? utilityWithBalance[utilityWithBalance.length - 1].running_balance : 0;
  const totalTenantOwes = Math.max(0, -totalRentOwed) + Math.max(0, -totalUtilityOwed);

const getTypeLabel = (type: string) => {
    const map: Record<string, string> = {
      rent: 'Rent', overdue: 'Overdue', deposit: 'Deposit', tenancy_agreement: 'Agreement Fee',
      water: 'Water', garbage: 'Garbage', service_charge: 'Service Charge',
      parking: 'Parking', security: 'Security', internet: 'Internet', laundry: 'Laundry', pet_fees: 'Pet Fees', other: 'Other',
    };
    return map[type] || type;
  };

  async function generateStatementPDF(billsList: Bill[], title: string, totalBalance: number) {
    const pdfDoc = await PDFDocument.create();
    let currentPage = pdfDoc.addPage([612, 792]);
    const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
    const boldFont = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
    const { height } = currentPage.getSize();

    let y = height - 60;

    // Header with company branding
    currentPage.drawRectangle({ x: 0, y: y + 10, width: 612, height: 50, color: rgb(0.97, 0.97, 0.99) });
    currentPage.drawText('SPRINGFIELD SYSTEMS', { x: 50, y, size: 18, font: boldFont, color: rgb(0.1, 0.1, 0.5) });
    y -= 25;
    currentPage.drawText(title, { x: 50, y, size: 20, font: boldFont, color: rgb(0.2, 0.2, 0.2) });
    y -= 25;

    // Tenant info
    currentPage.drawText(`Tenant: ${user?.user_metadata?.full_name || user?.email}`, { x: 50, y, size: 11, font });
    y -= 15;
    currentPage.drawText(`Generated: ${new Date().toLocaleDateString()}`, { x: 50, y, size: 11, font });
    y -= 30;

    // Table header with background - all 9 columns
    currentPage.drawRectangle({ x: 35, y: y - 5, width: 540, height: 20, color: rgb(0.92, 0.94, 0.98) });
    y = drawTableHeader(currentPage, font, y);
    y -= 5;

    // Draw horizontal line under header
    currentPage.drawLine({ start: { x: 35, y: y + 10 }, end: { x: 575, y: y + 10 }, thickness: 1, color: rgb(0.7, 0.7, 0.7) });

    // Table rows with all fields
    billsList.forEach((bill, idx) => {
      if (y < 60) {
        currentPage = pdfDoc.addPage([612, 792]);
        y = height - 60;
      }
      const bg = idx % 2 === 0 ? rgb(1, 1, 1) : rgb(0.97, 0.97, 0.98);
      currentPage.drawRectangle({ x: 35, y: y - 5, width: 540, height: 14, color: bg });
      y = drawTableFullRow(currentPage, font, bill, y);
      y -= 14;
    });

    y -= 10;
    currentPage.drawText(`Total Balance:`, { x: 420, y, size: 12, font: boldFont });
    currentPage.drawText(`${formatCurrency(Math.abs(totalBalance))}`, { x: 520, y, size: 14, font: boldFont, color: rgb(0.7, 0.1, 0.1) });

    const pdfBytes = await pdfDoc.save();
    const uint8 = new Uint8Array(pdfBytes);
    const blob = new Blob([uint8], { type: 'application/pdf' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${title.toLowerCase().replace(/\s+/g, '-')}.pdf`;
    a.click();
    URL.revokeObjectURL(url);
  }

  function drawTableHeader(page: any, font: any, y: number) {
    page.drawText('Date', { x: 40, y, size: 9, font });
    page.drawText('Description', { x: 120, y, size: 9, font });
    page.drawText('Type', { x: 200, y, size: 9, font });
    page.drawText('Due', { x: 260, y, size: 9, font });
    page.drawText('Paid', { x: 310, y, size: 9, font });
    page.drawText('Penalty', { x: 360, y, size: 9, font });
    page.drawText('Bal', { x: 410, y, size: 9, font });
    page.drawText('Running', { x: 460, y, size: 9, font });
    return y - 18;
  }

  function drawTableFullRow(page: any, font: any, bill: Bill, y: number) {
    const billWithBal = calculateWithRunningBalance([bill])[0];
    page.drawText(bill.payment_date ? new Date(bill.payment_date).toLocaleDateString() : '-', { x: 40, y, size: 8, font });
    page.drawText(bill.description.substring(0, 20), { x: 120, y, size: 8, font });
    page.drawText(getTypeLabel(bill.transaction_type).substring(0, 10), { x: 200, y, size: 8, font });
    page.drawText(String(bill.due_amount), { x: 260, y, size: 8, font, color: rgb(0.2, 0.2, 0.2) });
    page.drawText(String(bill.paid_amount), { x: 310, y, size: 8, font, color: rgb(0.1, 0.5, 0.1) });
    page.drawText(String(bill.penalty_fee || 0), { x: 360, y, size: 8, font, color: rgb(0.7, 0.1, 0.1) });
    page.drawText(String(billWithBal?.bill_balance ?? 0), { x: 410, y, size: 8, font });
    page.drawText(String(billWithBal?.running_balance ?? 0), { x: 460, y, size: 8, font, color: billWithBal?.running_balance > 0 ? rgb(0.1, 0.5, 0.1) : rgb(0.7, 0.1, 0.1) });
    return y - 14;
  }

  const getInvoiceTypeLabel = (type: string) => {
    const map: Record<string, string> = {
      rent: 'Rent', water: 'Water', utility: 'Utility', other: 'Other', tenancy_agreement: 'Agreement Fee',
      garbage: 'Garbage', service_charge: 'Service Charge', parking: 'Parking', security: 'Security', internet: 'Internet', laundry: 'Laundry', pet_fees: 'Pet Fees',
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
        <div><p className="heading">Tenant Payments</p><p className="subheading">Rent, utility payments, and invoices.</p></div>
      </div>

      {user && (
        <section className="card-grid" style={{ marginBottom: 24 }}>
          <article className="card">
            <div style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
              <button onClick={() => setActiveTab('payments')} className={activeTab === 'payments' ? 'action-button primary' : 'action-button ghost'} style={{ flex: 1 }}>Rent Payments</button>
              <button onClick={() => setActiveTab('utilities')} className={activeTab === 'utilities' ? 'action-button primary' : 'action-button ghost'} style={{ flex: 1 }}>Utilities</button>
              <button onClick={() => setActiveTab('invoices')} className={activeTab === 'invoices' ? 'action-button primary' : 'action-button ghost'} style={{ flex: 1 }}>Invoices</button>
            </div>

            <div className="card-label" style={{ marginBottom: 8 }}>
              {activeTab === 'payments' ? 'Make Rent Payment' : activeTab === 'utilities' ? 'Make Utility Payment' : 'Invoices'}
            </div>
            {activeTab === 'payments' && (
              <form onSubmit={handleStkPush} className="form-grid">
                <select value={paymentType} onChange={e => setPaymentType(e.target.value as any)} style={{ marginBottom: 8 }}>
                  <option value="rent">Rent Payment</option>
                  <option value="tenancy_agreement">Tenancy Agreement Fee</option>
                </select>
                <input type="tel" value={mpesaPhone} onChange={e => setMpesaPhone(e.target.value)} required placeholder="M-Pesa Phone (07XX XXX XXX)" />
                <input type="number" value={mpesaAmount} onChange={e => setMpesaAmount(e.target.value)} required placeholder="Amount (KES)" min="1" />
                <button type="submit" disabled={processing} className="action-button primary">{processing ? 'Processing…' : 'Pay Now'}</button>
              </form>
            )}
            {activeTab === 'utilities' && (
              <form onSubmit={handleStkPush} className="form-grid">
                <input type="tel" value={mpesaPhone} onChange={e => setMpesaPhone(e.target.value)} required placeholder="M-Pesa Phone (07XX XXX XXX)" />
                <input type="number" value={mpesaAmount} onChange={e => setMpesaAmount(e.target.value)} required placeholder="Amount (KES)" min="1" />
                <button type="submit" disabled={processing} className="action-button primary">{processing ? 'Processing…' : 'Pay Now'}</button>
              </form>
            )}
            {activeTab === 'payments' && (
              <div style={{ marginTop: 12, padding: 12, background: 'var(--surface)', borderRadius: 8, fontSize: '13px' }}>
                <strong>Payment Details:</strong>
                {paymentSettings.paybill && <div>Paybill: {paymentSettings.paybill}{paymentSettings.paybillAccount ? ` (Account: ${paymentSettings.paybillAccount})` : ''}</div>}
                {paymentSettings.till && <div>Till: {paymentSettings.till}</div>}
                {paymentSettings.pochi && <div>Pochi: {paymentSettings.pochi}</div>}
                {paymentSettings.mobile && <div>Mobile: {paymentSettings.mobile}</div>}
                {!paymentSettings.paybill && !paymentSettings.till && !paymentSettings.pochi && !paymentSettings.mobile && <div style={{ color: 'var(--ink-3)' }}>Contact landlord for payment details.</div>}
              </div>
            )}
            {message && <p className="landlord-success" style={{ marginTop: 16 }}>{message}</p>}
            {error && <p className="landlord-error" style={{ marginTop: 16 }}>{error}</p>}
          </article>
        </section>
      )}

      <section className="card" style={{ marginTop: 24 }}>
        <div className="card-label">{activeTab === 'payments' ? 'RENT PAYMENT HISTORY' : activeTab === 'utilities' ? 'UTILITY BILL HISTORY' : 'INVOICES'}</div>
        {activeTab === 'invoices' ? (
          invoices.length === 0 ? (
            <p className="landlord-empty">No invoices available.</p>
          ) : (
            <div className="table-shell" style={{ maxHeight: '500px', overflowY: 'auto' }}>
              <table className="landlord-table" style={{ fontSize: '12px' }}>
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
{invoices.sort((a, b) => {
                     const aOrder = getMonthSortValue(a.month_due);
                     const bOrder = getMonthSortValue(b.month_due);
                     return bOrder - aOrder || (b.month_due || '').localeCompare(a.month_due || '');
                   }).map(inv => (
                    <tr key={inv.id}>
                      <td style={{ textTransform: 'capitalize' }}>{inv.month_due || '-'}</td>
                      <td><span style={{ textTransform: 'capitalize', fontSize: '11px' }}>{getInvoiceTypeLabel(inv.invoice_type)}</span></td>
                      <td>{inv.description}</td>
                      <td>{formatCurrency(inv.amount)}</td>
                      <td>{inv.due_date ? new Date(inv.due_date).toLocaleDateString() : '-'}</td>
                      <td><span style={{ textTransform: 'capitalize' }}>{inv.status}</span></td>
                      <td>
                        {inv.file_path ? (
                          <a href={inv.file_path} target="_blank" rel="noopener noreferrer" className="action-button secondary" style={{ padding: '6px 12px', fontSize: '12px' }}>Download</a>
                        ) : (
                          <span style={{ color: '#9ca3af', fontSize: '11px' }}>Not generated</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )
        ) : (
          (activeTab === 'payments' ? rentWithBalance : utilityWithBalance).length === 0 ? (
            <p className="landlord-empty">{activeTab === 'payments' ? 'No rent payments recorded yet.' : 'No utility bills recorded yet.'}</p>
          ) : (
            <div className="table-shell" style={{ maxHeight: '500px', overflowY: 'auto' }}>
              <table className="landlord-table" style={{ fontSize: '12px' }}>
<thead>
                     <tr>
                       <th>Date</th>
                       <th>Description</th>
                       <th>Type</th>
                       <th>Due Amount</th>
                       <th>Paid</th>
                       <th>Penalty</th>
                       <th>Balance</th>
                       <th>Running Balance</th>
                     </tr>
                   </thead>
                   <tbody>
                     {(activeTab === 'payments' ? rentWithBalance : utilityWithBalance).map(bill => (
                       <tr key={bill.id}>
                         <td>{bill.payment_date ? new Date(bill.payment_date).toLocaleDateString() : '-'}</td>
                         <td>{bill.description}</td>
                         <td><span style={{ textTransform: 'capitalize', fontSize: '11px' }}>{getTypeLabel(bill.transaction_type)}</span></td>
                         <td>{formatCurrency(bill.due_amount)}</td>
                         <td>{formatCurrency(bill.paid_amount)}</td>
                         <td>{formatCurrency(bill.penalty_fee || 0)}</td>
                         <td style={{ color: bill.bill_balance > 0 ? '#dc2626' : (bill.bill_balance < 0 ? 'var(--accent)' : 'var(--ink-3)'), fontWeight: bill.bill_balance !== 0 ? 600 : 400 }}>
                           {formatCurrency(bill.bill_balance)}
                         </td>
                         <td style={{ color: bill.running_balance > 0 ? 'var(--accent)' : (bill.running_balance < 0 ? '#dc2626' : 'var(--ink-3)'), fontWeight: 600 }}>
                           {formatCurrency(bill.running_balance)}
                         </td>
                       </tr>
                     ))}
                   </tbody>
              </table>
            </div>
          )
        )}
      </section>

<section className="dashboard-hero-stats" style={{ marginTop: 24 }}>
        <div className="card" style={{ padding: '18px 16px', display: 'flex', alignItems: 'center', gap: 12 }}>
          <div style={{ width: 48, height: 48, borderRadius: '50%', background: totalRentOwed < 0 ? 'var(--accent-soft)' : 'rgba(220,38,38,0.12)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke={totalRentOwed < 0 ? 'var(--accent)' : '#dc2626'} strokeWidth="2"><path d="M3 21h18"/><path d="M5 21V7l8-4v18"/><path d="M19 21V11l-6-4"/></svg>
          </div>
          <div>
            <div className="card-label">Rent Balance</div>
            <h3 style={{ margin: 0, color: totalRentOwed < 0 ? 'var(--accent)' : '#dc2626' }}>{formatCurrency(-totalRentOwed)}</h3>
          </div>
        </div>
        <div className="card" style={{ padding: '18px 16px', display: 'flex', alignItems: 'center', gap: 12 }}>
          <div style={{ width: 48, height: 48, borderRadius: '50%', background: totalUtilityOwed < 0 ? 'rgba(16,185,129,0.12)' : 'rgba(220,38,38,0.12)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke={totalUtilityOwed < 0 ? 'var(--accent)' : '#dc2626'} strokeWidth="2"><path d="M12 2v20"/><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/></svg>
          </div>
          <div>
            <div className="card-label">Utility Balance</div>
            <h3 style={{ margin: 0, color: totalUtilityOwed < 0 ? 'var(--accent)' : '#dc2626' }}>{formatCurrency(-totalUtilityOwed)}</h3>
          </div>
        </div>
        <div className="card" style={{ padding: '18px 16px', display: 'flex', alignItems: 'center', gap: 12 }}>
          <div style={{ width: 48, height: 48, borderRadius: '50%', background: totalTenantOwes > 0 ? 'rgba(220,38,38,0.12)' : 'var(--accent-soft)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke={totalTenantOwes > 0 ? '#dc2626' : 'var(--accent)'} strokeWidth="2"><path d="M22 12h-4l-3 9L9 3l-3 9H2"/></svg>
          </div>
          <div>
            <div className="card-label">Total Outstanding</div>
            <h3 style={{ margin: 0, color: totalTenantOwes > 0 ? '#dc2626' : 'var(--accent)' }}>{formatCurrency(totalTenantOwes)}</h3>
          </div>
        </div>
        <div className="card" style={{ padding: '16px', display: 'flex', flexDirection: 'column', justifyContent: 'center', gap: 8 }}>
          <button
            onClick={async () => {
              await generateStatementPDF(rentBills, 'Rent Payment Statement', totalRentOwed);
            }}
            className="action-button primary" style={{ width: '100%', padding: '8px', fontSize: '13px' }}>Rent Statement (PDF)
          </button>
          <button
            onClick={async () => {
              await generateStatementPDF(utilityBills, 'Utility Payment Statement', totalUtilityOwed);
            }}
            className="action-button secondary" style={{ width: '100%', padding: '8px', fontSize: '13px' }}>Utility Statement (PDF)
          </button>
        </div>
      </section>
    </main>
  );
}