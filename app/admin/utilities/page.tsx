'use client';

import { useEffect, useState } from 'react';
import { supabase } from '../../../lib/supabaseClient';

interface Property {
  id: string;
  name: string;
  address: string;
  unit_count?: number;
}

interface Tenant {
  id: string;
  full_name: string;
  email: string;
  unit: string;
  unit_id?: string;
  property: string;
  property_id?: string;
}

interface Unit {
  id: string;
  unit_number: string;
  current_water_reading?: number;
  previous_water_reading?: number;
  property_id: string;
  tenant?: { id: string; full_name: string };
}

interface Bill {
  id: string;
  tenant_id: string;
  tenant_name?: string;
  description: string;
  month_due: string;
  due_amount: number;
  paid_amount: number;
  penalty_fee: number;
  balance: number;
  transaction_type: string;
  payment_date: string;
  transaction_number?: string;
  transaction_code?: string;
  payment_method?: string;
  created_at: string;
}

export default function UtilitiesPage() {
  const [properties, setProperties] = useState<Property[]>([]);
  const [tenants, setTenants] = useState<Tenant[]>([]);
  const [units, setUnits] = useState<Unit[]>([]);
  const [bills, setBills] = useState<Bill[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [utilityForm, setUtilityForm] = useState({
    tenantId: '',
    propertyId: '',
    utilityType: '',
    monthDue: '',
    amount: '',
    description: '',
  });

const [waterMeterReadings, setWaterMeterReadings] = useState<{[unitId: string]: string}>({});
  const [waterMonthDue, setWaterMonthDue] = useState('');
  const [waterForm, setWaterForm] = useState({
    tenantId: '',
    amount: '',
    description: '',
  });

  const [payForm, setPayForm] = useState({
    billId: '',
    amount: '',
    paymentMethod: 'Cash',
    referenceNumber: '',
    transactionCode: '',
  });
  const [showPayForm, setShowPayForm] = useState(false);

  const [editForm, setEditForm] = useState({
    billId: '',
    tenantId: '',
    utilityType: '',
    monthDue: '',
    amount: '',
    paidAmount: '',
    penaltyFee: '',
    description: '',
    paymentDate: '',
    paymentMethod: 'Cash',
    referenceNumber: '',
    transactionCode: '',
  });
  const [showEditForm, setShowEditForm] = useState(false);

  function calculateWaterBill(consumption: number): number {
    if (consumption <= 0) return 0;
    if (consumption <= 6) return 88;
    if (consumption <= 20) return 132;
    if (consumption <= 50) return 137;
    if (consumption <= 100) return 148;
    if (consumption <= 300) return 165;
    return 0;
  }

  const utilityTypes = [
    { value: 'garbage', label: 'Garbage Collection' },
    { value: 'service_charge', label: 'Service Charge' },
    { value: 'parking', label: 'Parking Fee' },
    { value: 'security', label: 'Security Fee' },
    { value: 'other', label: 'Other' },
  ];

  async function getAuthHeaders() {
    const { data } = await supabase.auth.getSession();
    const headers: Record<string, string> = { 'Content-Type': 'application/json' };
    if (data.session?.access_token) headers.Authorization = `Bearer ${data.session.access_token}`;
    return headers;
  }

  async function loadData() {
    setLoading(true);
    setError('');

    try {
      const [propsResponse, tenantsResponse, unitsResponse, billsResponse] = await Promise.all([
        fetch('/api/properties', { headers: await getAuthHeaders() }),
        fetch('/api/tenants', { headers: await getAuthHeaders() }),
        fetch('/api/units', { headers: await getAuthHeaders() }),
        fetch('/api/bills', { headers: await getAuthHeaders() }),
      ]);

      const propsResult = await propsResponse.json();
      const tenantsResult = await tenantsResponse.json();
      const unitsResult = await unitsResponse.json();
      const billsResult = await billsResponse.json();

setProperties(propsResult.properties ?? []);
      setTenants(tenantsResult.tenants ?? []);
      setUnits(unitsResult.units ?? []);
      // Only show utility bills - not rent/overdue/deposit
      const utilityBills = (billsResult.bills ?? []).filter((b: any) => 
        b.transaction_type === 'water' || 
        b.transaction_type === 'garbage' || 
        b.transaction_type === 'service_charge' ||
        b.transaction_type === 'parking' ||
        b.transaction_type === 'security' ||
        b.transaction_type === 'other'
      );
      setBills(utilityBills);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadData();
  }, []);

  async function handleAddUtility(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setMessage('');
    setError('');

    if (!utilityForm.tenantId || !utilityForm.utilityType || !utilityForm.amount || !utilityForm.monthDue) {
      setError('All fields are required.');
      return;
    }

    const selectedTenant = tenants.find(t => t.id === utilityForm.tenantId);
    const tenantPropertyId = selectedTenant?.property_id || utilityForm.propertyId;

    const response = await fetch('/api/bills', {
      method: 'POST',
      headers: await getAuthHeaders(),
      body: JSON.stringify({
        tenantId: utilityForm.tenantId,
        propertyId: tenantPropertyId,
        description: utilityForm.description || `${utilityForm.utilityType} invoice`,
        monthDue: utilityForm.monthDue,
        dueAmount: Number(utilityForm.amount),
        paidAmount: 0,
        penaltyFee: 0,
        transactionType: utilityForm.utilityType,
        paymentMethod: '',
        referenceNumber: '',
      }),
    });

    const result = await response.json();

    if (!response.ok) {
      setError(result.message ?? 'Unable to record utility bill.');
      return;
    }

    setMessage('Utility bill recorded.');
    setUtilityForm({ tenantId: '', propertyId: '', utilityType: '', monthDue: '', amount: '', description: '' });
    loadData();
  }

  async function handleAddWaterBill(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setMessage('');
    setError('');

    if (!waterForm.tenantId || !waterForm.amount) {
      setError('All fields are required.');
      return;
    }

    const selectedTenant = tenants.find(t => t.id === waterForm.tenantId);
    const tenantPropertyId = selectedTenant?.property_id || '';

    const response = await fetch('/api/bills', {
      method: 'POST',
      headers: await getAuthHeaders(),
      body: JSON.stringify({
        tenantId: waterForm.tenantId,
        propertyId: tenantPropertyId,
        description: waterForm.description || 'Water bill',
        monthDue: waterMonthDue || '',
        dueAmount: Number(waterForm.amount),
        paidAmount: 0,
        penaltyFee: 0,
        transactionType: 'water',
        paymentMethod: '',
        referenceNumber: '',
      }),
    });

    const result = await response.json();

    if (!response.ok) {
      setError(result.message ?? 'Unable to record water bill.');
      return;
    }

    setMessage('Water bill recorded.');
    setWaterForm({ tenantId: '', amount: '', description: '' });
    loadData();
  }

async function handleWaterMeterReading(unitId: string) {
    const consumption = waterMeterReadings[unitId];
    if (!consumption) return;

    const propertyId = units.find(u => u.id === unitId)?.property_id;
    const response = await fetch('/api/water', {
      method: 'POST',
      headers: await getAuthHeaders(),
      body: JSON.stringify({ unitId, consumption: Number(consumption), monthDue: waterMonthDue, propertyId }),
    });

    const result = await response.json();
    if (response.ok) {
      setMessage(`Water bill: ${consumption} units = ${calculateWaterBill(Number(consumption)).toLocaleString()} KES`);
      setWaterMeterReadings((prev) => ({ ...prev, [unitId]: '' }));
      loadData();
    } else {
      setError(result.message ?? 'Failed to record meter reading.');
    }
  }

  async function handleShowPayForm(billId: string, balance: number) {
    setPayForm({ billId, amount: String(balance), paymentMethod: 'Cash', referenceNumber: '', transactionCode: '' });
    setShowPayForm(true);
  }

  async function handleDeleteBill(billId: string) {
    if (!confirm('Are you sure you want to delete this bill?')) return;
    
    const response = await fetch('/api/bills', {
      method: 'DELETE',
      headers: await getAuthHeaders(),
      body: JSON.stringify({ id: billId }),
    });

    const result = await response.json();
    if (response.ok) {
      setMessage('Bill deleted.');
      loadData();
    } else {
      setError(result.message ?? 'Unable to delete bill.');
    }
  }

  async function handleShowEditForm(bill: Bill) {
    setEditForm({
      billId: bill.id,
      tenantId: bill.tenant_id,
      utilityType: bill.transaction_type,
      monthDue: bill.month_due,
      amount: String(bill.due_amount),
      paidAmount: String(bill.paid_amount),
      penaltyFee: String(bill.penalty_fee || 0),
      description: bill.description,
      paymentDate: bill.payment_date || '',
      paymentMethod: bill.payment_method || 'Cash',
      referenceNumber: bill.transaction_number || '',
      transactionCode: bill.transaction_code || '',
    });
    setShowEditForm(true);
  }

  async function handleUpdateBill(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setMessage('');
    setError('');

    const response = await fetch('/api/bills', {
      method: 'PUT',
      headers: await getAuthHeaders(),
      body: JSON.stringify({
        id: editForm.billId,
        tenantId: editForm.tenantId,
        description: editForm.description || `${editForm.utilityType} invoice`,
        monthDue: editForm.monthDue,
        dueAmount: Number(editForm.amount),
        paidAmount: Number(editForm.paidAmount),
        penaltyFee: Number(editForm.penaltyFee),
        transactionType: editForm.utilityType,
        paymentDate: editForm.paymentDate,
        paymentMethod: editForm.paymentMethod,
        referenceNumber: editForm.referenceNumber,
        transactionCode: editForm.transactionCode,
      }),
    });

    const result = await response.json();
    if (response.ok) {
      setMessage('Bill updated.');
      setShowEditForm(false);
      loadData();
    } else {
      setError(result.message ?? 'Unable to update bill.');
    }
  }

  async function handleRecordPayment(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setMessage('');
    setError('');

    if (!payForm.billId || !payForm.amount) {
      setError('Enter payment amount.');
      return;
    }

    const response = await fetch('/api/bills', {
      method: 'PATCH',
      headers: await getAuthHeaders(),
      body: JSON.stringify({
        id: payForm.billId,
        paidAmount: Number(payForm.amount),
        paymentMethod: payForm.paymentMethod,
        referenceNumber: payForm.referenceNumber,
        transactionCode: payForm.transactionCode,
      }),
    });

    const result = await response.json();
    if (!response.ok) {
      setError(result.message ?? 'Unable to record payment.');
      return;
    }
    setMessage('Payment recorded.');
    setShowPayForm(false);
    loadData();
  }

  return (
    <>
      <main className="container admin-no-hero">
        <div className="card-admin-header">
          <div>
            <p className="heading">Utilities Management</p>
            <p className="subheading">Water meter readings and utility billing management.</p>
          </div>
        </div>

        <section className="card-grid">
          <article className="card">
            <div className="card-label"><span className="badge badge-pm">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>
            </span>Record Other Utilities</div>
            <h3>Utility Billing</h3>
            <form onSubmit={handleAddUtility} className="form-grid">
              <select value={utilityForm.tenantId} onChange={e => setUtilityForm(f => ({ ...f, tenantId: e.target.value }))} required>
                <option value="">Select tenant</option>
                {tenants.map(t => <option key={t.id} value={t.id}>{t.full_name} - {t.property}</option>)}
              </select>
              <select value={utilityForm.utilityType} onChange={e => setUtilityForm(f => ({ ...f, utilityType: e.target.value }))} required>
                <option value="">Utility type</option>
                {utilityTypes.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
              </select>
              <input type="month" value={utilityForm.monthDue} onChange={e => setUtilityForm(f => ({ ...f, monthDue: e.target.value }))} required />
              <input value={utilityForm.amount} onChange={e => setUtilityForm(f => ({ ...f, amount: e.target.value }))} type="number" required placeholder="Amount (KSH)" />
              <input value={utilityForm.description} onChange={e => setUtilityForm(f => ({ ...f, description: e.target.value }))} placeholder="Description (optional)" />
              <button type="submit">Record Utility Bill</button>
            </form>
            <p style={{ fontSize: '11px', color: 'var(--ink-3)', marginTop: 8 }}>Creates bill record - tenants see this in Payment History</p>
          </article>

          <article className="card">
            <div className="card-label"><span className="badge badge-agent">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>
            </span>Add Water Bill</div>
            <h3>Simple Water Billing</h3>
            <form onSubmit={handleAddWaterBill} className="form-grid">
              <select value={waterForm.tenantId} onChange={e => setWaterForm(f => ({ ...f, tenantId: e.target.value }))} required>
                <option value="">Select tenant</option>
                {tenants.map(t => <option key={t.id} value={t.id}>{t.full_name} - {t.property}</option>)}
              </select>
              <input type="month" value={waterMonthDue} onChange={e => setWaterMonthDue(e.target.value)} required />
              <input value={waterForm.amount} onChange={e => setWaterForm(f => ({ ...f, amount: e.target.value }))} type="number" required placeholder="Amount (KSH)" />
              <input value={waterForm.description} onChange={e => setWaterForm(f => ({ ...f, description: e.target.value }))} placeholder="Description (optional)" />
              <button type="submit">Record Water Bill</button>
            </form>
          </article>

          <article className="card">
            <div className="card-label"><span className="badge badge-agent">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><rect x="1" y="4" width="22" height="16" rx="2"/><line x1="1" y1="10" x2="23" y2="10"/></svg>
            </span>Water Meter Billing</div>
            <h3 style={{ marginBottom: 16 }}>Record Water Consumption</h3>
            <p style={{ fontSize: '13px', color: 'var(--ink-3)', marginBottom: 12 }}>Water rates: 1-6 units = 88 KSH, 7-20 units = 132 KSH, 21-50 units = 137 KSH, 51-100 units = 148 KSH, 101-300 units = 165 KSH.</p>
            <input type="month" value={waterMonthDue} onChange={(event) => setWaterMonthDue(event.target.value)} placeholder="Billing month" style={{ marginBottom: 12 }} />
            {units.length === 0 ? (
              <p style={{ color: 'var(--ink-3)', fontSize: '13px' }}>No units available.</p>
            ) : (
              <div style={{ maxHeight: '240px', overflow: 'auto', marginBottom: 12, border: '1px solid var(--line)', borderRadius: '8px', padding: '8px' }}>
                {units.map((unit) => {
                  const consumption = Number(waterMeterReadings[unit.id] || 0);
                  const billAmount = calculateWaterBill(consumption);
                  return (
                    <div key={unit.id} style={{ display: 'flex', gap: 8, alignItems: 'center', padding: '8px 0', borderBottom: '1px solid var(--line-soft)' }}>
                      <span style={{ width: 120, fontSize: '13px' }}>{properties.find(p => p.id === unit.property_id)?.name ?? '—'} — Unit {unit.unit_number}</span>
                      <input type="number" value={waterMeterReadings[unit.id] || ''} onChange={(e) => setWaterMeterReadings((prev) => ({ ...prev, [unit.id]: e.target.value }))} placeholder="Consumption (units)" style={{ flex: 1, padding: '6px' }} min="0" />
                      <span style={{ width: 100, fontSize: '12px', color: consumption > 0 ? 'var(--accent)' : 'var(--ink-3)' }}>{consumption > 0 ? `${consumption} units = ${billAmount.toLocaleString()} KSH` : '-'}</span>
                      <button type="button" onClick={() => handleWaterMeterReading(unit.id)} disabled={!waterMeterReadings[unit.id] || Number(waterMeterReadings[unit.id]) <= 0} style={{ padding: '6px 12px', fontSize: '12px' }}>Bill</button>
                    </div>
                  );
                })}
              </div>
            )}
          </article>
        </section>

        {showEditForm && (
          <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.5)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <div className="card" style={{ maxWidth: 600, width: '90%' }}>
              <div className="card-label">Edit Bill</div>
              <h3 style={{ marginBottom: 16 }}>Update Utility Bill</h3>
              <form onSubmit={handleUpdateBill} className="form-grid">
                <select value={editForm.tenantId} onChange={e => setEditForm(f => ({ ...f, tenantId: e.target.value }))} required>
                  <option value="">Select tenant</option>
                  {tenants.map(t => <option key={t.id} value={t.id}>{t.full_name} - {t.property}</option>)}
                </select>
                <select value={editForm.utilityType} onChange={e => setEditForm(f => ({ ...f, utilityType: e.target.value }))} required>
                  <option value="">Utility type</option>
                  {utilityTypes.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
                </select>
                <input type="month" value={editForm.monthDue} onChange={e => setEditForm(f => ({ ...f, monthDue: e.target.value }))} required />
                <input type="number" value={editForm.amount} onChange={e => setEditForm(f => ({ ...f, amount: e.target.value }))} required placeholder="Due Amount (KSH)" />
                <input type="number" value={editForm.paidAmount} onChange={e => setEditForm(f => ({ ...f, paidAmount: e.target.value }))} placeholder="Paid Amount (KSH)" />
                <input type="number" value={editForm.penaltyFee} onChange={e => setEditForm(f => ({ ...f, penaltyFee: e.target.value }))} placeholder="Penalty Fee" />
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
                  <button type="submit">Update Bill</button>
                  <button type="button" onClick={() => setShowEditForm(false)} className="secondary-button">Cancel</button>
                </div>
              </form>
            </div>
          </div>
        )}

        <section className="card" style={{ marginTop: 24 }}>
          {showPayForm && (
            <div className="card" style={{ marginBottom: 16, background: 'var(--surface)' }}>
              <h3>Make Payment</h3>
              <form onSubmit={handleRecordPayment} className="form-grid">
                <div className="field-group">
                  <label>Amount (KSH)</label>
                  <input type="number" value={payForm.amount} onChange={e => setPayForm(f => ({ ...f, amount: e.target.value }))} required placeholder="Amount" />
                </div>
                <div className="field-group">
                  <label>Payment Method</label>
                  <select value={payForm.paymentMethod} onChange={e => setPayForm(f => ({ ...f, paymentMethod: e.target.value }))}>
                    <option value="Cash">Cash</option>
                    <option value="M-pesa">M-pesa</option>
                    <option value="Bank Transfer">Bank Transfer</option>
                  </select>
                </div>
                <div className="field-group">
                  <label>Reference Number</label>
                  <input value={payForm.referenceNumber} onChange={e => setPayForm(f => ({ ...f, referenceNumber: e.target.value }))} placeholder="e.g., SH31T8MAYN" />
                </div>
                <div className="field-group">
                  <label>Transaction Code</label>
                  <input value={payForm.transactionCode} onChange={e => setPayForm(f => ({ ...f, transactionCode: e.target.value }))} placeholder="MPESA transaction code" />
                </div>
                <button type="submit">Record Payment</button>
                <button type="button" className="secondary-button" onClick={() => setShowPayForm(false)}>Cancel</button>
              </form>
            </div>
          )}
          <div className="card-label"><span className="badge badge-agent">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><rect x="1" y="4" width="22" height="16" rx="2"/><line x1="1" y1="10" x2="23" y2="10"/></svg>
          </span>Recorded Bills</div>
          <h3 style={{ marginBottom: 16 }}>All Utility Records</h3>

          {loading && <p className="landlord-muted">Loading bills...</p>}
          {!loading && bills.length === 0 && <p className="landlord-empty">No bills recorded yet.</p>}

          {!loading && bills.length > 0 && (
            <div className="table-shell" style={{ maxHeight: '500px', overflowY: 'auto' }}>
              <table className="landlord-table" style={{ fontSize: '12px' }}>
                <thead>
                  <tr>
                    <th>Month</th>
                    <th>Tenant</th>
                    <th>Description</th>
                    <th>Type</th>
                    <th>Due Amount</th>
                    <th>Paid</th>
                    <th>Penalty</th>
                    <th>Balance</th>
                    <th>Payment Date</th>
                    <th>Trans #</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {bills.map(bill => (
                    <tr key={bill.id}>
                      <td style={{ textTransform: 'capitalize' }}>{bill.month_due || '-'}</td>
                      <td>{bill.tenant_name || tenants.find(t => t.id === bill.tenant_id)?.full_name || '-'}</td>
                      <td>{bill.description}</td>
                      <td><span style={{ textTransform: 'capitalize', fontSize: '11px' }}>{bill.transaction_type}</span></td>
                      <td>{bill.due_amount.toLocaleString()}</td>
                      <td>{bill.paid_amount.toLocaleString() || '-'}</td>
                      <td>{(bill.penalty_fee || 0).toLocaleString()}</td>
                      <td style={{ color: bill.balance > 0 ? '#dc2626' : 'var(--accent)' }}>{bill.balance.toLocaleString()}</td>
                      <td>{bill.payment_date || '-'}</td>
                      <td style={{ fontSize: '11px' }}>{bill.transaction_number || '-'}</td>
                      <td>
                        {bill.balance > 0 && (
                          <button className="action-button primary" style={{ padding: '4px 8px', fontSize: '11px', marginRight: 4 }} onClick={() => handleShowPayForm(bill.id, bill.balance)}>Pay</button>
                        )}
                        <button className="action-button" style={{ padding: '4px 8px', fontSize: '11px', marginRight: 4, background: '#f59e0b', color: '#fff' }} onClick={() => handleShowEditForm(bill)}>Edit</button>
                        <button className="action-button" style={{ padding: '4px 8px', fontSize: '11px', background: '#dc2626', color: '#fff' }} onClick={() => handleDeleteBill(bill.id)}>Delete</button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {error && <p className="landlord-error" style={{ marginTop: 12 }}>{error}</p>}
          {message && <p className="landlord-success" style={{ marginTop: 12 }}>{message}</p>}
        </section>
      </main>

      <footer>
        <div className="footer-inner">
          <div className="footer-brand"><span className="logo-mark" style={{ width: 26, height: 26, borderRadius: 7 }}><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M3 21h18"/><path d="M5 21V7l8-4v18"/><path d="M19 21V11l-6-4"/></svg></span>Springfield Systems</div>
          <div className="footer-links"><a href="/">Home</a><a href="/admin">Dashboard</a></div>
          <div className="footer-copy">© 2026 Springfield Systems. All rights reserved.</div>
        </div>
      </footer>
    </>
  );
}



