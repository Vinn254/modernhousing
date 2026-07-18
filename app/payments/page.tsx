'use client';

import { useEffect, useState, useMemo } from 'react';
import { supabase } from '../../lib/supabaseClient';
import Sparkline from '../components/Sparkline';
import { PDFDocument, StandardFonts, rgb } from 'pdf-lib';

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
  transaction_code?: string;
  source: 'bills' | 'payments';
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
    { value: 'tenancy_agreement', label: 'Tenancy Agreement Fee' },
  ];

  const [paybill, setPaybill] = useState('');
  const [paybillAccount, setPaybillAccount] = useState('');
  const [till, setTill] = useState('');
  const [pochi, setPochi] = useState('');
  const [mobile, setMobile] = useState('');
  const [shortCode, setShortCode] = useState('');
  const [consumerKey, setConsumerKey] = useState('');
  const [consumerSecret, setConsumerSecret] = useState('');
  const [passkey, setPasskey] = useState('');
  const [showSettings, setShowSettings] = useState(false);
  const [selectedMethod, setSelectedMethod] = useState<'paybill' | 'till' | 'pochi' | 'mobile'>('paybill');
  const [hoverMonth, setHoverMonth] = useState<string | null>(null);

  const monthlyRevenue = useMemo(() => {
    const months: Record<string, number> = {};
    payments.forEach(p => {
      const month = p.month_due || (p.created_at ? p.created_at.slice(0, 7) : 'unknown');
      months[month] = (months[month] || 0) + (p.amount || 0);
    });
    const sorted = Object.keys(months).sort().slice(-6);
    return { months, sorted };
  }, [payments]);

  const monthlyLabels = useMemo(() => {
    const labels = monthlyRevenue.sorted.length > 0 ? [...monthlyRevenue.sorted] : [];
    while (labels.length < 6) labels.unshift(`2024-${String(5 - labels.length).padStart(2, '0')}`);
    return labels;
  }, [monthlyRevenue.sorted]);

  const monthlyLabelNames = useMemo(() => {
    const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    return monthlyLabels.map(m => m.length === 7 ? monthNames[parseInt(m.slice(5, 7)) - 1] || m : m);
  }, [monthlyLabels]);

  const monthlyData = useMemo(() => monthlyLabels.map(m => monthlyRevenue.months[m] || 0), [monthlyLabels, monthlyRevenue.months]);

  const [showEditForm, setShowEditForm] = useState(false);
  const [editingBalanceId, setEditingBalanceId] = useState<string | null>(null);
  const [editingBalanceValue, setEditingBalanceValue] = useState('');
  const [editForm, setEditForm] = useState({
    billId: '',
    tenantId: '',
    monthDue: '',
    dueAmount: '',
    paidAmount: '',
    penaltyFee: '',
    balanceRemaining: '',
    description: '',
    paymentDate: '',
    paymentMethod: 'Cash',
    referenceNumber: '',
    transactionCode: '',
    transType: 'rent',
    source: 'bills' as 'bills' | 'payments',
  });

  const paymentMethods = [
    { value: 'paybill', label: 'Paybill' },
    { value: 'till', label: 'Till' },
    { value: 'pochi', label: 'Pochi la Biashara' },
    { value: 'mobile', label: 'Mobile Number' },
  ] as const;

  async function loadPayments() {
    const [billsResponse, paymentsResponse] = await Promise.all([
      fetch('/api/bills', { headers: await getAuthHeaders() }),
      fetch('/api/payments', { headers: await getAuthHeaders() }),
    ]);

    let allPayments: Payment[] = [];

    if (billsResponse.ok) {
      const billsResult = await billsResponse.json();
      const billsPayments = (billsResult.bills ?? [])
        .filter((b: any) => ['rent', 'overdue', 'deposit', 'tenancy_agreement'].includes(b.transaction_type))
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
          transaction_code: b.transaction_code,
          created_at: b.created_at,
          source: 'bills' as const,
        }));
      allPayments = [...allPayments, ...billsPayments];
    }

    if (paymentsResponse.ok) {
      const paymentsResult = await paymentsResponse.json();
      const legacyPayments = (paymentsResult.payments ?? []).map((p: any) => ({
        id: p.id,
        tenant: p.tenant || '—',
        tenant_email: p.tenant_email || '',
        property: p.property || '',
        unit: p.unit || '—',
        description: p.description,
        transaction_type: p.transaction_type || 'rent',
        amount: p.amount || 0,
        due_amount: p.due_amount || 0,
        month_due: p.month_due,
        balance_remaining: p.balance_remaining || 0,
        status: p.status || 'paid',
        transaction_number: p.transaction_number,
        transaction_code: p.transaction_code,
        created_at: p.paid_at || p.created_at,
        source: 'payments' as const,
      }));
      allPayments = [...allPayments, ...legacyPayments];
    }

    allPayments.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
    setPayments(allPayments);
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
      setShortCode(result.shortCode ?? '');
      setPasskey(result.passkey ?? '');
    }
  }

  async function saveSettings(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const response = await fetch('/api/payment-settings', {
      method: 'POST',
      headers: await getAuthHeaders(),
      body: JSON.stringify({
        paybill, paybillAccount, till, pochi, mobile, shortCode, consumerKey, consumerSecret, passkey,
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
        paymentDate: manualDate,
        balanceRemaining: manualBalAmount ? Number(manualBalAmount) : undefined,
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

  async function handleDeletePayment(payment: Payment) {
    if (!confirm('Are you sure you want to delete this payment?')) return;
    
    const endpoint = payment.source === 'payments' ? '/api/payments' : '/api/bills';
    const response = await fetch(endpoint, {
      method: 'DELETE',
      headers: await getAuthHeaders(),
      body: JSON.stringify({ id: payment.id }),
    });

    const result = await response.json();
    if (response.ok) {
      setMessage('Payment deleted.');
      loadPayments();
    } else {
      setError(result.message ?? 'Unable to delete payment.');
    }
  }

  async function handleShowEditForm(payment: Payment) {
    setEditForm({
      billId: payment.id,
      tenantId: tenants.find(t => t.full_name === payment.tenant)?.id || '',
      monthDue: (payment as any).month_due || '',
      dueAmount: String((payment as any).due_amount || payment.amount),
      paidAmount: String(payment.amount),
      penaltyFee: '0',
      balanceRemaining: String(payment.balance_remaining),
      description: payment.description,
      paymentDate: payment.next_payment_date || '',
      paymentMethod: manualPaymentMethod,
      referenceNumber: (payment as any).transaction_number || '',
      transactionCode: (payment as any).transaction_code || '',
      transType: (payment as any).transaction_type || 'rent',
      source: payment.source,
    });
    setShowEditForm(true);
  }

  async function handleUpdatePayment(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setMessage('');
    setError('');

    const endpoint = editForm.source === 'payments' ? '/api/payments' : '/api/bills';
    const response = await fetch(endpoint, {
      method: 'PUT',
      headers: await getAuthHeaders(),
      body: JSON.stringify({
        id: editForm.billId,
        tenantId: editForm.tenantId,
        description: editForm.description || `${editForm.transType} payment`,
        monthDue: editForm.monthDue,
        dueAmount: Number(editForm.dueAmount),
        paidAmount: Number(editForm.paidAmount),
        penaltyFee: Number(editForm.penaltyFee),
        transactionType: editForm.transType,
        paymentDate: editForm.paymentDate,
        paymentMethod: editForm.paymentMethod,
        referenceNumber: editForm.referenceNumber,
        transactionCode: editForm.transactionCode,
        ...(editForm.source === 'payments' ? { balanceRemaining: editForm.balanceRemaining ? Number(editForm.balanceRemaining) : undefined } : { balanceRemaining: editForm.balanceRemaining ? Number(editForm.balanceRemaining) : undefined }),
      }),
    });

    const result = await response.json();
    if (response.ok) {
      setMessage('Payment updated.');
      setShowEditForm(false);
      loadPayments();
    } else {
      setError(result.message ?? 'Unable to update payment.');
    }
  }

  const formatCurrency = (value: number) => new Intl.NumberFormat('en-KE', { style: 'currency', currency: 'KES' }).format(value);

  async function downloadPaymentStatement() {
    if (payments.length === 0) {
      setError('No payments to download.');
      return;
    }

    const pdfDoc = await PDFDocument.create();
    const page = pdfDoc.addPage([595.28, 841.89]);
    const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
    const boldFont = await pdfDoc.embedFont(StandardFonts.HelveticaBold);

    let y = 800;
    const docId = `STMT-${Date.now().toString().slice(-8)}`;
    const dateStr = new Date().toLocaleDateString('en-GB');

    page.drawText('SPRINGFIELD SYSTEMS', { x: 50, y, font: boldFont, size: 24, color: rgb(0.08, 0.08, 0.15) });
    y -= 30;
    page.drawText('OFFICIAL PAYMENT STATEMENT', { x: 50, y, font: boldFont, size: 16, color: rgb(0.16, 0.16, 0.25) });
    y -= 15;
    page.drawText(`Generated: ${dateStr} | Document ID: ${docId}`, { x: 50, y, font, size: 10, color: rgb(0.3, 0.3, 0.3) });
    y -= 40;

    const totalPaid = payments.reduce((sum, p) => sum + (p.amount || 0), 0);
    const totalBal = payments.reduce((sum, p) => sum + (p.balance_remaining || 0), 0);

    const headers = ['Tenant', 'Month Due', 'Trans Code', 'Paid', 'Balance', 'Date'];
    const colX = [50, 150, 260, 340, 420, 500];
    headers.forEach((h, i) => {
      page.drawText(h, { x: colX[i], y, font: boldFont, size: 10, color: rgb(0.25, 0.25, 0.25) });
    });
    y -= 22;
    page.drawLine({ start: { x: 50, y }, end: { x: 550, y }, thickness: 1, color: rgb(0.6, 0.6, 0.6) });
    y -= 18;

    payments.forEach((payment, idx) => {
      if (idx % 2 === 0) {
        page.drawRectangle({ x: 48, y: y - 4, width: 504, height: 16, color: rgb(0.97, 0.97, 0.98), opacity: 0.7 });
      }
      page.drawText(payment.tenant.substring(0, 18), { x: 50, y, font, size: 9, color: rgb(0.1, 0.1, 0.1) });
      page.drawText((payment as any).month_due?.substring(0, 12) || payment.description?.substring(0, 12) || '—', { x: 150, y, font, size: 9, color: rgb(0.2, 0.2, 0.2) });
      page.drawText((payment as any).transaction_code ? String((payment as any).transaction_code).substring(0, 10) : '—', { x: 260, y, font, size: 9, color: rgb(0.1, 0.3, 0.6) });
      page.drawText(formatCurrency(payment.amount).replace('KES', ''), { x: 340, y, font, size: 9, color: rgb(0.1, 0.4, 0.1) });
      page.drawText(formatCurrency(payment.balance_remaining).replace('KES', ''), { x: 420, y, font, size: 9, color: payment.balance_remaining > 0 ? rgb(0.7, 0.1, 0.1) : rgb(0.2, 0.2, 0.2) });
      page.drawText(payment.created_at ? new Date(payment.created_at).toLocaleDateString('en-GB') : '—', { x: 500, y, font, size: 9, color: rgb(0.2, 0.2, 0.2) });
      y -= 16;
    });

    y -= 12;
    page.drawRectangle({ x: 50, y: y - 10, width: 500, height: 12, color: rgb(0.94, 0.94, 0.96) });
    page.drawText(`Total Paid: ${formatCurrency(totalPaid)}`, { x: 50, y, font: boldFont, size: 11, color: rgb(0.1, 0.4, 0.2) });
    page.drawText(`Outstanding: ${formatCurrency(totalBal)}`, { x: 200, y, font: boldFont, size: 11, color: rgb(0.6, 0.2, 0.2) });
    y -= 40;
    page.drawText('This is an official payment record. Verify at springfield-systems.com', { x: 50, y, font, size: 8, color: rgb(0.5, 0.5, 0.5) });

    const pdfBytes = await pdfDoc.save();
    const blob = new Blob([new Uint8Array(pdfBytes)], { type: 'application/pdf' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `payment-statement-${dateStr.replace(/\//g, '-')}.pdf`;
    a.click();
    URL.revokeObjectURL(url);
  }

  async function handleInlineBalanceSave(payment: Payment) {
    if (editingBalanceId !== payment.id) return;
    const newBalance = Number(editingBalanceValue);
    const response = await fetch(payment.source === 'payments' ? '/api/payments' : '/api/bills', {
      method: 'PUT',
      headers: await getAuthHeaders(),
      body: JSON.stringify({
        id: payment.id,
        balanceRemaining: newBalance,
      }),
    });
    if (response.ok) {
      setMessage('Balance updated.');
      setEditingBalanceId(null);
      loadPayments();
    } else {
      const result = await response.json();
      setError(result.message ?? 'Unable to update balance.');
    }
  }

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
            <input type="number" step="0.01" value={manualBalAmount} onChange={(event) => setManualBalAmount(event.target.value)} placeholder="Balance" />
            <select value={manualPaymentMethod} onChange={(event) => setManualPaymentMethod(event.target.value)}>
              <option value="Cash">Cash</option>
              <option value="M-pesa">M-pesa</option>
              <option value="Bank Transfer">Bank Transfer</option>
            </select>
            <input value={manualTransNumber} onChange={(event) => setManualTransNumber(event.target.value)} placeholder="Transaction/Receipt Number (optional)" />
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
              <input value={shortCode} onChange={e => setShortCode(e.target.value)} placeholder="Business ShortCode (e.g. 174347)" />
              <input value={passkey} onChange={e => setPasskey(e.target.value)} placeholder="Passkey (Security Key)" />

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

      {showEditForm && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.5)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div className="card" style={{ maxWidth: 600, width: '90%' }}>
            <div className="card-label">Edit Payment</div>
            <h3 style={{ marginBottom: 16 }}>Update Payment Record</h3>
            <form onSubmit={handleUpdatePayment} className="form-grid">
              <select value={editForm.tenantId} onChange={e => setEditForm(f => ({ ...f, tenantId: e.target.value }))} required>
                <option value="">Select tenant</option>
                {tenants.map(t => <option key={t.id} value={t.id}>{t.full_name} — {t.property} · Unit {t.unit}</option>)}
              </select>
              <select value={editForm.transType} onChange={e => setEditForm(f => ({ ...f, transType: e.target.value }))}>
                {transactionTypes.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
              </select>
              <input type="month" value={editForm.monthDue} onChange={e => setEditForm(f => ({ ...f, monthDue: e.target.value }))} placeholder="Month Due" />
              <input type="number" step="0.01" value={editForm.dueAmount} onChange={e => setEditForm(f => ({ ...f, dueAmount: e.target.value }))} placeholder="Due Amount" />
              <input type="number" step="0.01" value={editForm.paidAmount} onChange={e => setEditForm(f => ({ ...f, paidAmount: e.target.value }))} placeholder="Paid Amount" />
              <input type="number" step="0.01" value={editForm.penaltyFee} onChange={e => setEditForm(f => ({ ...f, penaltyFee: e.target.value }))} placeholder="Penalty Fee" />
              <input type="number" step="0.01" value={editForm.balanceRemaining} onChange={e => setEditForm(f => ({ ...f, balanceRemaining: e.target.value }))} placeholder="Balance" />
              <input value={editForm.description} onChange={e => setEditForm(f => ({ ...f, description: e.target.value }))} placeholder="Description" />
              <input type="date" value={editForm.paymentDate} onChange={e => setEditForm(f => ({ ...f, paymentDate: e.target.value }))} placeholder="Payment Date" />
              <select value={editForm.paymentMethod} onChange={e => setEditForm(f => ({ ...f, paymentMethod: e.target.value }))}>
                <option value="Cash">Cash</option>
                <option value="M-pesa">M-pesa</option>
                <option value="Bank Transfer">Bank Transfer</option>
              </select>
              <input value={editForm.referenceNumber} onChange={e => setEditForm(f => ({ ...f, referenceNumber: e.target.value }))} placeholder="Reference Number" />
              <input value={editForm.transactionCode} onChange={e => setEditForm(f => ({ ...f, transactionCode: e.target.value }))} placeholder="Transaction Code" />
              <div style={{ display: 'flex', gap: 8, marginTop: 16 }}>
                <button type="submit">Update Payment</button>
                <button type="button" onClick={() => setShowEditForm(false)} className="secondary-button">Cancel</button>
              </div>
            </form>
          </div>
        </div>
      )}

      <article className="bento-card" style={{ padding: '14px 16px', display: 'flex', flexDirection: 'column', gap: 8, position: 'relative' }} onMouseLeave={() => setHoverMonth(null)}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, width: '100%' }}>
          <div style={{ width: 48, height: 48, borderRadius: '50%', background: 'rgba(16,185,129,0.12)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="var(--accent)" strokeWidth="2"><path d="M12 1v22"/><path d="M5 5h14"/><path d="M5 19h14"/></svg>
          </div>
          <div style={{ flex: 1 }}>
            <div className="card-label">Revenue Trend</div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <h3 style={{ margin: 0, color: 'var(--ink-1)' }}>KSH {monthlyData.length > 0 ? monthlyData[monthlyData.length - 1].toLocaleString() : '0'}</h3>
              <p style={{ margin: 0, color: 'var(--ink-3)', fontSize: '13px' }}>{monthlyLabels.length > 0 ? (monthlyLabelNames[monthlyLabels.length - 1] || monthlyLabels[monthlyLabels.length - 1]) + ' 2024' : '—'}</p>
            </div>
          </div>
          {monthlyData.length > 1 && (
            <span style={{ fontSize: '10px', fontWeight: 600, padding: '2px 6px', borderRadius: 4, background: 'rgba(16,185,129,0.15)', color: 'var(--accent)' }}>
              {((monthlyData[monthlyData.length - 1] - monthlyData[monthlyData.length - 2]) / monthlyData[monthlyData.length - 2] * 100 >= 0 ? '+' : '')}{((monthlyData[monthlyData.length - 1] - monthlyData[monthlyData.length - 2]) / monthlyData[monthlyData.length - 2] * 100).toFixed(1)}%
            </span>
          )}
        </div>
        <Sparkline data={monthlyData.length > 0 && monthlyData.some(d => d > 0) ? monthlyData : [0, 0, 0]} color="#10b981" w={340} h={40}/>
        <div style={{ display: 'flex', gap: '4px', marginTop: 8, alignItems: 'flex-end', height: 36 }}>
          {monthlyLabels.map((m, i) => {
            const revenue = monthlyRevenue.months[m] || 0;
            const maxVal = Math.max(...monthlyData, 1);
            const pct = maxVal > 0 ? revenue / maxVal : 0;
            const isLatest = i === monthlyLabels.length - 1;
            return (
              <div key={m} onMouseEnter={() => setHoverMonth(m)} onMouseLeave={() => setHoverMonth(null)} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4, cursor: 'pointer', position: 'relative' }}>
                <div style={{ width: '100%', height: 24, display: 'flex', alignItems: 'flex-end' }}>
                  <div style={{ width: '100%', height: `${Math.max(pct * 100, 8)}%`, background: isLatest ? 'var(--accent)' : 'rgba(0,0,0,0.12)', borderRadius: '2px', transition: 'all 0.2s' }} />
                </div>
                <span style={{ fontSize: '9px', color: isLatest ? 'var(--accent)' : 'var(--ink-3)', fontWeight: isLatest ? 600 : 400 }}>{monthlyLabelNames[i] || m}</span>
                {hoverMonth === m && (
                  <div style={{ position: 'absolute', bottom: '100%', left: '50%', transform: 'translateX(-50%) translateY(-4px)', background: 'var(--card)', border: '1px solid var(--border)', borderRadius: '4px', padding: '4px 8px', fontSize: '10px', whiteSpace: 'nowrap', zIndex: 10, boxShadow: '0 2px 8px rgba(0,0,0,0.15)' }}>
                    KSH {(revenue || 0).toLocaleString()}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </article>

      <article className="card" style={{ marginTop: 24 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
          <div className="card-label">Transactions</div>
          {payments.length > 0 && (
            <button onClick={downloadPaymentStatement} className="action-button primary" style={{ padding: '6px 12px', fontSize: '12px' }}>Download PDF</button>
          )}
        </div>
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
                  <th>Trans Code</th>
                  <th>Due</th>
                  <th>Paid</th>
                  <th>Balance</th>
                  <th>Type</th>
                  <th>Trans #</th>
                  <th>Date</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {payments.map((payment) => (
                  <tr key={payment.id}>
                    <td className="landlord-name">{payment.tenant}</td>
                    <td>{(payment as any).month_due || payment.description}</td>
                    <td style={{ fontSize: '12px' }}>{(payment as any).transaction_code || '—'}</td>
                    <td>{formatCurrency((payment as any).due_amount || payment.amount)}</td>
                    <td>{formatCurrency(payment.amount)}</td>
                    <td style={{ color: payment.balance_remaining > 0 ? '#dc2626' : 'var(--accent)' }}>
                      {editingBalanceId === payment.id ? (
                        <input
                          type="number"
                          step="0.01"
                          value={editingBalanceValue}
                          onChange={e => setEditingBalanceValue(e.target.value)}
                          onBlur={() => handleInlineBalanceSave(payment)}
                          onKeyDown={e => e.key === 'Enter' && handleInlineBalanceSave(payment)}
                          style={{ width: '80px', padding: '2px 4px' }}
                          autoFocus
                        />
                      ) : (
                        <span onClick={() => { setEditingBalanceId(payment.id); setEditingBalanceValue(String(payment.balance_remaining)); }} style={{ cursor: 'pointer' }}>
                          {formatCurrency(payment.balance_remaining)}
                        </span>
                      )}
                    </td>
                    <td style={{ textTransform: 'capitalize' }}>{(payment as any).transaction_type || 'rent'}</td>
                    <td style={{ fontSize: '12px' }}>{(payment as any).transaction_number || '—'}</td>
                    <td>{payment.created_at ? new Date(payment.created_at).toLocaleDateString() : '—'}</td>
                    <td>
                      <button className="action-button" style={{ padding: '4px 8px', fontSize: '11px', marginRight: 4, background: '#f59e0b', color: '#fff' }} onClick={() => handleShowEditForm(payment)}>Edit</button>
                      <button className="action-button" style={{ padding: '4px 8px', fontSize: '11px', background: '#dc2626', color: '#fff' }} onClick={() => handleDeletePayment(payment)}>Delete</button>
                    </td>
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