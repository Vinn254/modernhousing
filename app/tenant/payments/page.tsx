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
  const [activeTab, setActiveTab] = useState<'payments' | 'utilities'>('payments');
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

    allBills.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
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

  // Separate bills by type
  const rentBills = bills.filter(b => ['rent', 'overdue', 'deposit'].includes(b.transaction_type));
  const utilityBills = bills.filter(b => ['water', 'garbage', 'service_charge', 'parking', 'security', 'other'].includes(b.transaction_type));
  
  // Calculate running balance for proper payment application
  const calculateRunningBalance = (billsList: Bill[]) => {
    let runningBalance = 0;
    return billsList.map(bill => {
      runningBalance += bill.balance;
      return { ...bill, running_balance: runningBalance > 0 ? runningBalance : 0 };
    });
  };

  const rentWithBalance = calculateRunningBalance([...rentBills].sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime()));
  const utilityWithBalance = calculateRunningBalance([...utilityBills].sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime()));

  const totalRentBalance = rentWithBalance.reduce((sum, b) => sum + (b.running_balance || 0), 0);
  const totalUtilityBalance = utilityWithBalance.reduce((sum, b) => sum + (b.running_balance || 0), 0);
  const totalOutstanding = totalRentBalance + totalUtilityBalance;

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
        <div><p className="heading">Tenant Payments</p><p className="subheading">Rent and utility payments.</p></div>
      </div>

      {user && (
        <section className="card-grid" style={{ marginBottom: 24 }}>
          <article className="card">
            <div style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
              <button 
                onClick={() => setActiveTab('payments')} 
                className={activeTab === 'payments' ? 'action-button primary' : 'secondary-button'}
                style={{ flex: 1 }}>
                Rent Payments
              </button>
              <button 
                onClick={() => setActiveTab('utilities')} 
                className={activeTab === 'utilities' ? 'action-button primary' : 'secondary-button'}
                style={{ flex: 1 }}>
                Utilities
              </button>
            </div>

            <div className="card-label" style={{ marginBottom: 8 }}>
              {activeTab === 'payments' ? 'Make Rent Payment' : 'Make Utility Payment'}
            </div>
            
            <form onSubmit={handleStkPush} className="form-grid">
              <input type="tel" value={mpesaPhone} onChange={e => setMpesaPhone(e.target.value)} required placeholder="M-Pesa Phone (07XX XXX XXX)" />
              <input type="number" value={mpesaAmount} onChange={e => setMpesaAmount(e.target.value)} required placeholder="Amount (KES)" min="1" />
              <button type="submit" disabled={processing}>{processing ? 'Processing…' : 'Pay Now'}</button>
            </form>
            
            <div style={{ marginTop: 12, padding: 12, background: 'var(--surface)', borderRadius: 8, fontSize: '13px' }}>
              <strong>Payment Details:</strong>
              {paymentSettings.paybill && <div>Paybill: {paymentSettings.paybill}{paymentSettings.paybillAccount ? ` (Account: ${paymentSettings.paybillAccount})` : ''}</div>}
              {paymentSettings.till && <div>Till: {paymentSettings.till}</div>}
              {paymentSettings.pochi && <div>Pochi: {paymentSettings.pochi}</div>}
              {paymentSettings.mobile && <div>Mobile: {paymentSettings.mobile}</div>}
              {!paymentSettings.paybill && !paymentSettings.till && !paymentSettings.pochi && !paymentSettings.mobile && <div style={{ color: 'var(--ink-3)' }}>Contact landlord for payment details.</div>}
            </div>
            
            {message && <p className="landlord-success" style={{ marginTop: 16 }}>{message}</p>}
            {error && <p className="landlord-error" style={{ marginTop: 16 }}>{error}</p>}
          </article>
        </section>
      )}

      <section className="card" style={{ marginTop: 24 }}>
        <div className="card-label">{activeTab === 'payments' ? 'RENT PAYMENT HISTORY' : 'UTILITY BILL HISTORY'}</div>
        
        {activeTab === 'payments' ? (
          rentBills.length === 0 ? (
            <p className="landlord-empty">No rent payments recorded yet.</p>
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
                  {rentWithBalance.map(bill => (
                    <tr key={bill.id}>
                      <td style={{ textTransform: 'capitalize' }}>{bill.month_due || '-'}</td>
                      <td>{bill.description}</td>
                      <td><span style={{ textTransform: 'capitalize', fontSize: '11px' }}>{getTypeLabel(bill.transaction_type)}</span></td>
                      <td>{formatCurrency(bill.due_amount)}</td>
                      <td>{formatCurrency(bill.paid_amount)}</td>
                      <td>{formatCurrency(bill.penalty_fee || 0)}</td>
                      <td style={{ color: (bill.running_balance || 0) > 0 ? '#dc2626' : 'var(--accent)', fontWeight: 600 }}>
                        {formatCurrency(bill.running_balance || 0)}
                      </td>
                      <td>{bill.payment_date ? new Date(bill.payment_date).toLocaleDateString() : '-'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )
        ) : (
          utilityBills.length === 0 ? (
            <p className="landlord-empty">No utility bills recorded yet.</p>
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
                  {utilityWithBalance.map(bill => (
                    <tr key={bill.id}>
                      <td style={{ textTransform: 'capitalize' }}>{bill.month_due || '-'}</td>
                      <td>{bill.description}</td>
                      <td><span style={{ textTransform: 'capitalize', fontSize: '11px' }}>{getTypeLabel(bill.transaction_type)}</span></td>
                      <td>{formatCurrency(bill.due_amount)}</td>
                      <td>{formatCurrency(bill.paid_amount)}</td>
                      <td>{formatCurrency(bill.penalty_fee || 0)}</td>
                      <td style={{ color: (bill.running_balance || 0) > 0 ? '#dc2626' : 'var(--accent)', fontWeight: 600 }}>
                        {formatCurrency(bill.running_balance || 0)}
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
            <span style={{ color: totalRentBalance > 0 ? '#dc2626' : 'var(--accent)' }}>{formatCurrency(totalRentBalance)}</span>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
            <span>Utility Balance:</span>
            <span style={{ color: totalUtilityBalance > 0 ? '#dc2626' : 'var(--accent)' }}>{formatCurrency(totalUtilityBalance)}</span>
          </div>
          <hr style={{ margin: '12px 0', borderColor: 'var(--line)' }} />
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '18px', fontWeight: 700 }}>
            <span>Total Outstanding:</span>
            <span style={{ color: totalOutstanding > 0 ? '#dc2626' : 'var(--accent)' }}>{formatCurrency(totalOutstanding)}</span>
          </div>
        </div>
      </section>
    </main>
  );
}