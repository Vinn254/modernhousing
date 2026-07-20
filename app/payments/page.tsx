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
  paid_at?: string;
  payment_date?: string;
  paid_amount?: number;
  source?: 'bills' | 'payments';
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
  const [selectedTenantKey, setSelectedTenantKey] = useState<string | null>(null);
  const [selectedTenantName, setSelectedTenantName] = useState('');

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
    const monthNames = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
    payments.forEach(p => {
      if (['complaint', 'notification'].includes(p.transaction_type)) return;
      const paidAmt = Number(p.paid_amount ?? p.amount ?? 0);
      if (p.month_due) {
        const monthParts = p.month_due?.split(' ');
        if (monthParts?.length >= 2) {
          const monthName = monthParts[0];
          let year = monthParts[1];
          const monthIdx = monthNames.indexOf(monthName);
          if (monthIdx >= 0) {
            if (!year || isNaN(Number(year))) {
              year = String(new Date().getFullYear());
            }
            const key = `${year}-${String(monthIdx + 1).padStart(2, '0')}`;
            months[key] = (months[key] || 0) + paidAmt;
            return;
          }
        } else if (monthParts?.length === 1 && monthNames.includes(monthParts[0])) {
          const monthIdx = monthNames.indexOf(monthParts[0]);
          const year = String(new Date().getFullYear());
          const key = `${year}-${String(monthIdx + 1).padStart(2, '0')}`;
          months[key] = (months[key] || 0) + paidAmt;
          return;
        }
      }
      const d = p.paid_at ? new Date(p.paid_at) : (p.payment_date ? new Date(p.payment_date) : (p.created_at ? new Date(p.created_at) : new Date()));
      const month = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
      months[month] = (months[month] || 0) + paidAmt;
    });
    return { months };
  }, [payments]);

  const monthlyLabels = useMemo(() => {
    const now = new Date();
    const currentYear = now.getFullYear();
    return Array(12).fill(0).map((_, i) => {
      const month = i + 1;
      return `${currentYear}-${String(month).padStart(2, '0')}`;
    });
  }, []);

  const currentMonthLabel = `${new Date().getFullYear()}-${String(new Date().getMonth() + 1).padStart(2, '0')}`;

  const monthlyLabelNames = useMemo(() => {
    const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    return monthlyLabels.map(m => monthNames[parseInt(m.slice(5, 7)) - 1] || m);
  }, [monthlyLabels]);

  const currentMonthRevenue = useMemo(() => {
    return monthlyRevenue.months[currentMonthLabel] || 0;
  }, [monthlyRevenue.months, currentMonthLabel]);

  const prevMonthLabel = useMemo(() => {
    const now = new Date();
    const prevMonth = now.getMonth() === 0 ? 11 : now.getMonth() - 1;
    const prevYear = now.getMonth() === 0 ? now.getFullYear() - 1 : now.getFullYear();
    return `${prevYear}-${String(prevMonth + 1).padStart(2, '0')}`;
  }, []);

  const prevMonthRevenue = useMemo(() => {
    return monthlyRevenue.months[prevMonthLabel] || 0;
  }, [monthlyRevenue.months, prevMonthLabel]);

  const monthlyData = useMemo(() => monthlyLabels.map(m => monthlyRevenue.months[m] || 0), [monthlyLabels, monthlyRevenue.months]);

  const percentageChange = useMemo(() => {
    const currentIdx = monthlyLabels.indexOf(currentMonthLabel);
    const prevIdx = currentIdx > 0 ? currentIdx - 1 : 11;
    const currentData = currentIdx >= 0 ? monthlyData[currentIdx] : 0;
    const prevData = prevIdx >= 0 ? monthlyData[prevIdx] : 0;
    if (prevData > 0) {
      const change = (currentData - prevData) / prevData * 100;
      return { sign: change >= 0 ? '+' : '', value: change.toFixed(1) };
    }
    if (prevMonthRevenue > 0) {
      const change = (currentMonthRevenue - prevMonthRevenue) / prevMonthRevenue * 100;
      return { sign: change >= 0 ? '+' : '', value: change.toFixed(1) };
    }
    return { sign: '+', value: '0' };
  }, [monthlyData, currentMonthRevenue, prevMonthRevenue, currentMonthLabel, monthlyLabels]);

  const tenantPaymentGroups = useMemo(() => {
    const groups = new Map<string, { key: string; name: string; count: number; balance: number }>();
    payments.forEach((payment) => {
      const key = payment.tenant_email || payment.tenant || 'unknown';
      const existing = groups.get(key);
      if (existing) {
        existing.count += 1;
        existing.balance += payment.balance_remaining || 0;
      } else {
        groups.set(key, { key, name: payment.tenant || 'Unknown tenant', count: 1, balance: payment.balance_remaining || 0 });
      }
    });
    return Array.from(groups.values()).sort((a, b) => a.name.localeCompare(b.name));
  }, [payments]);

  const visiblePayments = useMemo(() => {
    if (!selectedTenantKey) return payments;
    return payments.filter((payment) => {
      const tenantKey = payment.tenant_email || payment.tenant || 'unknown';
      return tenantKey.toLowerCase() === selectedTenantKey.toLowerCase();
    });
  }, [payments, selectedTenantKey]);

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
          tenant_email: b.tenant_email || '',
          property: b.property_name || '',
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
          payment_date: b.payment_date,
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

    allPayments.sort((a, b) => {
      const monthNames = ['january', 'february', 'march', 'april', 'may', 'june', 'july', 'august', 'september', 'october', 'november', 'december'];
      const aMonth = a.month_due ? monthNames.indexOf(a.month_due.split(' ')[0]?.toLowerCase() || '') + 1 : 0;
      const bMonth = b.month_due ? monthNames.indexOf(b.month_due.split(' ')[0]?.toLowerCase() || '') + 1 : 0;
      if (aMonth !== bMonth) return bMonth - aMonth;
      if (a.month_due !== b.month_due) return (b.month_due || '').localeCompare(a.month_due || '');
      return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
    });
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

    const year = manualDate ? new Date(manualDate).getFullYear() : new Date().getFullYear();
    const monthDueWithYear = manualMonth ? `${manualMonth} ${year}` : `${new Date().toLocaleString('en-US', { month: 'long' })} ${year}`;

    const response = await fetch('/api/bills', {
      method: 'POST',
      headers: await getAuthHeaders(),
      body: JSON.stringify({
        tenantId,
        description: `${manualMonth || 'Rent'} payment`,
        monthDue: monthDueWithYear,
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
    const monthDueRaw = (payment as any).month_due || '';
    let monthDueValue = monthDueRaw;
    if (monthDueRaw && monthDueRaw.includes(' ')) {
      const [monthName, year] = monthDueRaw.split(' ');
      const monthNames = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
      const monthIdx = monthNames.indexOf(monthName);
      if (monthIdx >= 0) {
        monthDueValue = `${year}-${String(monthIdx + 1).padStart(2, '0')}`;
      }
    }
    
    setEditForm({
      billId: payment.id,
      tenantId: tenants.find(t => t.full_name === payment.tenant)?.id || '',
      monthDue: monthDueValue,
      dueAmount: String((payment as any).due_amount || payment.amount),
      paidAmount: String(payment.amount),
      penaltyFee: '0',
      balanceRemaining: String(payment.balance_remaining),
      description: payment.description,
      paymentDate: (payment as any).payment_date || payment.next_payment_date || '',
      paymentMethod: manualPaymentMethod,
      referenceNumber: (payment as any).transaction_number || '',
      transactionCode: (payment as any).transaction_code || '',
      transType: (payment as any).transaction_type || 'rent',
      source: payment.source ?? 'bills',
    });
    setShowEditForm(true);
  }

  async function handleUpdatePayment(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setMessage('');
    setError('');

    let monthDueValue = editForm.monthDue;
    if (editForm.monthDue && editForm.monthDue.includes('-')) {
      const [year, month] = editForm.monthDue.split('-');
      const monthNames = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
      monthDueValue = `${monthNames[parseInt(month) - 1]} ${year}`;
    }

    const endpoint = editForm.source === 'payments' ? '/api/payments' : '/api/bills';
    const response = await fetch(endpoint, {
      method: 'PUT',
      headers: await getAuthHeaders(),
      body: JSON.stringify({
        id: editForm.billId,
        tenantId: editForm.tenantId,
        description: editForm.description || `${editForm.transType} payment`,
        monthDue: monthDueValue,
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

  const MONTH_ORDER: Record<string, number> = {
    january: 1, february: 2, march: 3, april: 4, may: 5, june: 6,
    july: 7, august: 8, september: 9, october: 10, november: 11, december: 12,
  };

  async function downloadPaymentStatement() {
    const recordsToDownload = [...(visiblePayments.length > 0 ? visiblePayments : payments)];
    recordsToDownload.sort((a, b) => {
      const aMonth = a.month_due ? (MONTH_ORDER[a.month_due.split(' ')[0]?.toLowerCase()] || 0) : 0;
      const bMonth = b.month_due ? (MONTH_ORDER[b.month_due.split(' ')[0]?.toLowerCase()] || 0) : 0;
      if (aMonth !== bMonth) return bMonth - aMonth;
      return (b.month_due || '').localeCompare(a.month_due || '');
    });
    if (recordsToDownload.length === 0) {
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

    const totalPaid = recordsToDownload.reduce((sum, p) => sum + (p.amount || 0), 0);
    const totalBal = recordsToDownload.reduce((sum, p) => sum + (p.balance_remaining || 0), 0);

    const headers = ['Tenant', 'Month Due', 'Trans Code', 'Due', 'Paid', 'Balance', 'Date'];
    const colX = [50, 130, 230, 320, 400, 470, 530];
    headers.forEach((h, i) => {
      page.drawText(h, { x: colX[i], y, font: boldFont, size: 10, color: rgb(0.25, 0.25, 0.25) });
    });
    y -= 22;
    page.drawLine({ start: { x: 50, y }, end: { x: 580, y }, thickness: 1, color: rgb(0.6, 0.6, 0.6) });
    y -= 18;

    recordsToDownload.forEach((payment, idx) => {
      if (idx % 2 === 0) {
        page.drawRectangle({ x: 48, y: y - 4, width: 532, height: 16, color: rgb(0.97, 0.97, 0.98), opacity: 0.7 });
      }
      page.drawText(payment.tenant.substring(0, 18), { x: 50, y, font, size: 9, color: rgb(0.1, 0.1, 0.1) });
      page.drawText((payment as any).month_due || payment.description || '—', { x: 130, y, font, size: 9, color: rgb(0.2, 0.2, 0.2) });
      page.drawText((payment as any).transaction_code ? String((payment as any).transaction_code).substring(0, 10) : '—', { x: 230, y, font, size: 9, color: rgb(0.1, 0.3, 0.6) });
      page.drawText(formatCurrency((payment as any).due_amount || payment.amount).replace('KES', ''), { x: 320, y, font, size: 9, color: rgb(0.2, 0.2, 0.2) });
      page.drawText(formatCurrency(payment.amount).replace('KES', ''), { x: 400, y, font, size: 9, color: rgb(0.1, 0.4, 0.1) });
      page.drawText(formatCurrency(payment.balance_remaining).replace('KES', ''), { x: 460, y, font, size: 9, color: payment.balance_remaining > 0 ? rgb(0.7, 0.1, 0.1) : rgb(0.2, 0.2, 0.2) });
      page.drawText((payment as any).source === 'bills'
        ? ((payment as any).payment_date ? new Date((payment as any).payment_date).toLocaleDateString('en-GB') : '—')
        : (payment.created_at ? new Date(payment.created_at).toLocaleDateString('en-GB') : '—'), { x: 530, y, font, size: 9, color: rgb(0.2, 0.2, 0.2) });
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
    <>
      <style jsx global>{`
        @media (max-width: 600px) {
          th, td {
            padding: 8px 6px !important;
            font-size: 12px !important;
          }
          .table-shell {
            overflow-x: auto;
          }
          .landlord-name > div {
            flex-wrap: wrap;
          }
          .landlord-name span {
            font-size: 12px !important;
          }
          .landlord-name div[style*="width: 28"] {
            width: 24px !important;
            height: 24px !important;
            font-size: 10px !important;
          }
        }
      `}</style>
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

        <article className="bento-card" style={{ padding: '14px 16px', display: 'flex', flexDirection: 'column', gap: 8, position: 'relative', marginBottom: 32 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, width: '100%' }}>
            <div style={{ width: 48, height: 48, borderRadius: '50%', background: 'rgba(16,185,129,0.12)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="var(--accent)" strokeWidth="2"><path d="M12 1v22"/><path d="M5 5h14"/><path d="M5 19h14"/></svg>
            </div>
            <div style={{ flex: 1 }}>
              <div className="card-label">Revenue Trend</div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <h3 style={{ margin: 0, fontSize: '24px', fontWeight: 700 }}>KSH {currentMonthRevenue.toLocaleString()}</h3>
                <p style={{ margin: 0, color: 'var(--ink-3)', fontSize: '13px' }}>{new Date().toLocaleString('en-US', { month: 'long' })}</p>
              </div>
            </div>
            <span style={{ fontSize: '10px', fontWeight: 600, padding: '2px 6px', borderRadius: 999, background: 'rgba(16,185,129,0.15)', color: 'var(--accent)', flexShrink: 0 }}>
              {percentageChange.sign}{percentageChange.value}%
            </span>
          </div>
          <Sparkline data={monthlyData.length > 0 && monthlyData.some(d => d > 0) ? monthlyData : [0, 0, 0]} color="#10b981" w={340} h={40}/>
          <div style={{ display: 'flex', gap: '4px', marginTop: 8, flexWrap: 'wrap' }}>
            {monthlyLabels.map((m, i) => {
              const revenue = monthlyRevenue.months[m] || 0;
              const label = monthlyLabelNames[i] || m;
              const isLatest = m === currentMonthLabel;
              const colors = ['#10b981', '#0d9488', '#0f766e', '#115e59', '#144e59', '#144e59', '#0ea5e9', '#0284c7', '#0369a1', '#07598c', '#0c4a6e', '#0b3a56'];
              const monthColor = colors[i % colors.length];
              return (
                <div key={m} onMouseEnter={() => setHoverMonth(m)} onMouseLeave={() => setHoverMonth(null)} style={{ flex: '1 0 30px', minWidth: 36, padding: '4px 6px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2, borderRadius: 6, background: isLatest ? 'rgba(16,185,129,0.15)' : 'var(--card)', cursor: 'pointer', position: 'relative', border: `1px solid ${monthColor}30` }}>
                  <div style={{ width: '100%', height: 16, display: 'flex', alignItems: 'flex-end' }}>
                    <div style={{ width: '100%', height: '100%', background: monthColor, borderRadius: '2px', opacity: isLatest ? 1 : 0.3 }} />
                  </div>
                  <span style={{ fontSize: '10px', color: monthColor, fontWeight: isLatest ? 600 : 400 }}>{label}</span>
                  {hoverMonth === m && (
                    <div style={{ position: 'absolute', bottom: '100%', left: '50%', transform: 'translateX(-50%) translateY(-4px)', background: 'var(--card)', border: `1px solid ${monthColor}`, borderRadius: '4px', padding: '4px 8px', fontSize: '10px', whiteSpace: 'nowrap', zIndex: 10 }}>
                      KSH {(revenue || 0).toLocaleString()}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </article>

        <article
          className="card"
          style={{
            marginTop: 24,
            border: '1px solid rgba(16, 185, 129, 0.35)',
            boxShadow: '0 0 0 1px rgba(16, 185, 129, 0.12), 0 0 22px rgba(16, 185, 129, 0.18)',
            background: 'linear-gradient(135deg, rgba(255,255,255,0.98), rgba(240,253,244,0.95))',
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
            <div className="card-label">Transactions</div>
            {payments.length > 0 && (
              <button onClick={downloadPaymentStatement} className="action-button primary" style={{ padding: '6px 12px', fontSize: '12px' }}>Download PDF</button>
            )}
          </div>
          <h3 style={{ marginBottom: 16 }}>{selectedTenantName ? `Payment History for ${selectedTenantName}` : 'Payment History'}</h3>
          {loading ? <p style={{ color: '#111827' }}>Loading payments…</p> : payments.length === 0 ? (
            <p style={{ color: '#111827' }}>No payments recorded yet.</p>
          ) : (
            <>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16, flexWrap: 'wrap' }}>
                <label htmlFor="tenant-filter" style={{ fontSize: '13px', fontWeight: 600, color: '#374151' }}>
                  Filter by tenant
                </label>
                <select
                  id="tenant-filter"
                  value={selectedTenantKey ?? ''}
                  onChange={(event) => {
                    const value = event.target.value;
                    if (!value) {
                      setSelectedTenantKey(null);
                      setSelectedTenantName('');
                      return;
                    }
                    const selectedGroup = tenantPaymentGroups.find((group) => group.key === value);
                    setSelectedTenantKey(value);
                    setSelectedTenantName(selectedGroup?.name ?? '');
                  }}
                  style={{
                    minWidth: 220,
                    padding: '8px 12px',
                    borderRadius: 999,
                    border: '1px solid #c7d2fe',
                    background: 'linear-gradient(135deg, #eff6ff 0%, #eef2ff 100%)',
                    color: '#1e3a8a',
                    fontWeight: 700,
                    boxShadow: '0 4px 12px rgba(37, 99, 235, 0.12)',
                    outline: 'none',
                  }}
                >
                  <option value="">All tenants</option>
                  {tenantPaymentGroups.map((group) => (
                    <option key={group.key} value={group.key}>
                      {group.name} ({group.count})
                    </option>
                  ))}
                </select>
              </div>
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
                    {visiblePayments.map((payment) => {
                      const initials = (payment.tenant || '').split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2) || '?';
                      const colors = ['#f59e0b', '#10b981', '#0ea5e9', '#8b5cf6', '#ec4899', '#ef4444', '#f97316', '#14b8a6'];
                      const colorIndex = payment.tenant ? payment.tenant.charCodeAt(0) % colors.length : 0;
                      const avatarColor = colors[colorIndex];
                      const tenantEmail = payment.tenant_email || '';
                      return (
                        <tr key={payment.id}>
                          <td className="landlord-name" style={{ minWidth: 140, maxWidth: 180, padding: '8px 6px' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 0, overflow: 'hidden' }}>
                              <div style={{ width: 24, height: 24, borderRadius: '50%', background: avatarColor, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontSize: '10px', fontWeight: 700, flexShrink: 0 }}>{initials}</div>
                              <span
                                style={{ cursor: 'pointer', color: '#1e3a8a', fontSize: '12px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', minWidth: 0 }}
                                onClick={() => {
                                  setSelectedTenantKey(tenantEmail || payment.tenant);
                                  setSelectedTenantName(payment.tenant);
                                }}
                              >
                                {payment.tenant}
                              </span>
                            </div>
                          </td>
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
                          <td>{(payment as any).payment_date ? new Date((payment as any).payment_date).toLocaleDateString() : (payment.created_at ? new Date(payment.created_at).toLocaleDateString() : '—')}</td>
                          <td>
                            <button className="action-button" style={{ padding: '4px 8px', fontSize: '11px', marginRight: 4, background: '#f59e0b', color: '#fff' }} onClick={() => handleShowEditForm(payment)}>Edit</button>
                            <button className="action-button" style={{ padding: '4px 8px', fontSize: '11px', background: '#dc2626', color: '#fff' }} onClick={() => handleDeletePayment(payment)}>Delete</button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </>
          )}
        </article>
      </main>
    </>
  );
}