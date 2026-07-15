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
      if (aOrder !== bOrder) return aOrder - bOrder;
      const isOverdueA = a.transaction_type === 'overdue';
      const isOverdueB = b.transaction_type === 'overdue';
      if (isOverdueA !== isOverdueB) return isOverdueA ? 1 : -1;
      return (a.created_at || '').localeCompare(b.created_at || '');
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

  const rentBills = bills.filter(b => ['rent', 'overdue', 'deposit'].includes(b.transaction_type));
  const utilityBills = bills.filter(b => ['water', 'garbage', 'service_charge', 'parking', 'security', 'other'].includes(b.transaction_type));

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
      rent: 'Rent', overdue: 'Overdue', deposit: 'Deposit',
      water: 'Water', garbage: 'Garbage', service_charge: 'Service Charge',
      parking: 'Parking', security: 'Security', other: 'Other',
    };
    return map[type] || type;
  };

  async function generateStatementPDF(billsList: Bill[], title: string, totalBalance: number) {
    const pdfDoc = await PDFDocument.create();
    const page = pdfDoc.addPage([612, 792]);
    const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
    const boldFont = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
    const { height } = page.getSize();

    let y = height - 50;

    page.drawText(title, { x: 50, y, size: 20, font: boldFont });
    y -= 30;
    page.drawText(`Tenant: ${user?.user_metadata?.full_name || user?.email}`, { x: 50, y, size: 12, font });
    y -= 15;
    page.drawText(`Generated: ${new Date().toLocaleDateString()}`, { x: 50, y, size: 12, font });
    y -= 25;

    y = drawTableRow(page, font, 'Month', 'Description', 'Type', 'Due', 'Paid', y);
    y -= 5;

    billsList.forEach(bill => {
      y = drawTableRow(page, font, bill.month_due || '-', bill.description.substring(0, 20), bill.transaction_type, String(bill.due_amount), String(bill.paid_amount), y);
      y -= 5;
    });

    y -= 10;
    page.drawText(`Total Balance: ${formatCurrency(Math.abs(totalBalance))}`, { x: 50, y, size: 14, font: boldFont, color: rgb(0.5, 0.1, 0.1) });

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

  function drawTableRow(page: any, font: any, c1: string, c2: string, c3: string, c4: string, c5: string, y: number) {
    page.drawText(c1, { x: 50, y, size: 10, font });
    page.drawText(c2, { x: 110, y, size: 10, font });
    page.drawText(c3, { x: 210, y, size: 10, font });
    page.drawText(c4, { x: 280, y, size: 10, font });
    page.drawText(c5, { x: 350, y, size: 10, font });
    return y - 15;
  }

  const getInvoiceTypeLabel = (type: string) => {
    const map: Record<string, string> = {
      rent: 'Rent', water: 'Water', utility: 'Utility', other: 'Other',
      garbage: 'Garbage', service_charge: 'Service Charge', parking: 'Parking', security: 'Security',
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
              <button onClick={() => setActiveTab('payments')} className={activeTab === 'payments' ? 'action-button primary' : 'secondary-button'} style={{ flex: 1 }}>Rent Payments</button>
              <button onClick={() => setActiveTab('utilities')} className={activeTab === 'utilities' ? 'action-button primary' : 'secondary-button'} style={{ flex: 1 }}>Utilities</button>
              <button onClick={() => setActiveTab('invoices')} className={activeTab === 'invoices' ? 'action-button primary' : 'secondary-button'} style={{ flex: 1 }}>Invoices</button>
            </div>

            <div className="card-label" style={{ marginBottom: 8 }}>
              {activeTab === 'payments' ? 'Make Rent Payment' : activeTab === 'utilities' ? 'Make Utility Payment' : 'Invoices'}
            </div>
            {activeTab !== 'invoices' && (
              <form onSubmit={handleStkPush} className="form-grid">
                <input type="tel" value={mpesaPhone} onChange={e => setMpesaPhone(e.target.value)} required placeholder="M-Pesa Phone (07XX XXX XXX)" />
                <input type="number" value={mpesaAmount} onChange={e => setMpesaAmount(e.target.value)} required placeholder="Amount (KES)" min="1" />
                <button type="submit" disabled={processing}>{processing ? 'Processing…' : 'Pay Now'}</button>
              </form>
            )}
            {activeTab !== 'invoices' && (
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
                    return aOrder - bOrder || (a.month_due || '').localeCompare(b.month_due || '');
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
                          <a href={inv.file_path} target="_blank" rel="noopener noreferrer" className="action-button" style={{ padding: '4px 8px', fontSize: '11px' }}>Download</a>
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
                    <th>Month</th>
                    <th>Description</th>
                    <th>Type</th>
                    <th>Due Amount</th>
                    <th>Paid</th>
                    <th>Penalty</th>
                    <th>Balance</th>
                    <th>Running Balance</th>
                    <th>Payment Date</th>
                  </tr>
                </thead>
                <tbody>
                  {(activeTab === 'payments' ? rentWithBalance : utilityWithBalance).map(bill => (
                    <tr key={bill.id}>
                      <td style={{ textTransform: 'capitalize' }}>{bill.month_due || '-'}</td>
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
                      <td>{bill.payment_date ? new Date(bill.payment_date).toLocaleDateString() : '-'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )
        )}
      </section>

<section className="card" style={{ marginTop: 24 }}>
        <div className="card-label">BALANCE SUMMARY</div>
        <div style={{ padding: '16px', background: 'var(--line-soft)', borderRadius: '8px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
            <span>Rent Balance:</span>
            <span style={{ color: totalRentOwed < 0 ? 'var(--accent)' : '#dc2626' }}>{formatCurrency(-totalRentOwed)}</span>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
            <span>Utility Balance:</span>
            <span style={{ color: totalUtilityOwed < 0 ? 'var(--accent)' : '#dc2626' }}>{formatCurrency(-totalUtilityOwed)}</span>
          </div>
          <hr style={{ margin: '12px 0', borderColor: 'var(--line)' }} />
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '18px', fontWeight: 700, marginBottom: 12 }}>
            <span>Total Outstanding:</span>
            <span style={{ color: totalTenantOwes > 0 ? '#dc2626' : 'var(--accent)' }}>{formatCurrency(totalTenantOwes)}</span>
          </div>
          <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
            <button
              onClick={async () => {
                await generateStatementPDF(rentBills, 'Rent Payment Statement', totalRentOwed);
              }}
              className="action-button"
              style={{ flex: 1, padding: '8px', fontSize: '13px' }}
            >
              Download Rent Statement (PDF)
            </button>
            <button
              onClick={async () => {
                await generateStatementPDF(utilityBills, 'Utility Payment Statement', totalUtilityOwed);
              }}
              className="secondary-button"
              style={{ flex: 1, padding: '8px', fontSize: '13px' }}
            >
              Download Utility Statement (PDF)
            </button>
          </div>
        </div>
      </section>
    </main>
  );
}
