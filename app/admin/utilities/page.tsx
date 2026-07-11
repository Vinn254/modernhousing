'use client';

import { useEffect, useRef, useState } from 'react';
import { supabase } from '../../../lib/supabaseClient';
import DonutChart from '../../components/DonutChart';

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

interface Bill {
  id: string;
  tenant_id: string;
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

interface Unit {
  id: string;
  unit_number: string;
  current_water_reading?: number;
  previous_water_reading?: number;
  property_id: string;
  tenant?: { id: string; full_name: string };
}

export default function UtilitiesPage() {
  const [properties, setProperties] = useState<Property[]>([]);
  const [tenants, setTenants] = useState<Tenant[]>([]);
  const [units, setUnits] = useState<Unit[]>([]);
  const [bills, setBills] = useState<Bill[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingBills, setLoadingBills] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [utilityForm, setUtilityForm] = useState({
    tenantId: '',
    propertyId: '',
    utilityType: '',
    amount: '',
    description: '',
  });
  const [selectedTenant, setSelectedTenant] = useState<Tenant | null>(null);
  const [billForm, setBillForm] = useState({
    description: '',
    monthDue: '',
    dueAmount: '',
    paidAmount: '',
    penaltyFee: '0',
    transactionType: 'rent',
    paymentMethod: '',
    referenceNumber: '',
  });
  const [waterMeterReadings, setWaterMeterReadings] = useState<{[unitId: string]: string}>({});
  const [waterMonthDue, setWaterMonthDue] = useState('');
  const [waterForm, setWaterForm] = useState({
    tenantId: '',
    amount: '',
    description: '',
  });
  const formRef = useRef<HTMLDivElement>(null);

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
      const [propsResponse, tenantsResponse, unitsResponse] = await Promise.all([
        fetch('/api/properties', { headers: await getAuthHeaders() }),
        fetch('/api/tenants', { headers: await getAuthHeaders() }),
        fetch('/api/units', { headers: await getAuthHeaders() }),
      ]);

      const propsResult = await propsResponse.json();
      const tenantsResult = await tenantsResponse.json();
      const unitsResult = await unitsResponse.json();

      setProperties(propsResult.properties ?? []);
      setTenants(tenantsResult.tenants ?? []);
      setUnits(unitsResult.units ?? []);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  async function loadBills(tenantId: string) {
    setLoadingBills(true);
    try {
      const headers = await getAuthHeaders();
      const response = await fetch(`/api/bills?tenantId=${tenantId}`, { headers });
      const result = await response.json();
      setBills(result.bills ?? []);
    } catch (err: any) {
      console.error('Unable to load bills:', err.message);
    } finally {
      setLoadingBills(false);
    }
  }

  useEffect(() => {
    loadData();
  }, []);

  async function handleAddUtility(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setMessage('');
    setError('');

    if (!utilityForm.tenantId || !utilityForm.utilityType || !utilityForm.amount) {
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
        monthDue: utilityForm.description || '',
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
    setUtilityForm({ tenantId: '', propertyId: '', utilityType: '', amount: '', description: '' });
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
    const reading = waterMeterReadings[unitId];
    if (!reading) return;

    const propertyId = units.find(u => u.id === unitId)?.property_id;
    const response = await fetch('/api/water', {
      method: 'POST',
      headers: await getAuthHeaders(),
      body: JSON.stringify({ unitId, currentReading: Number(reading), monthDue: waterMonthDue, propertyId }),
    });

    const result = await response.json();
    if (response.ok) {
      setMessage(`Water bill: ${result.consumption} units × ${result.waterRate} = ${result.amount.toLocaleString()} KES`);
      setWaterMeterReadings((prev) => ({ ...prev, [unitId]: '' }));
      loadData();
    } else {
      setError(result.message ?? 'Failed to record meter reading.');
    }
  }

  function handleViewBills(tenant: Tenant) {
    setSelectedTenant(tenant);
    setBillForm({
      description: `Rent for ${tenant.full_name}`,
      monthDue: '',
      dueAmount: '',
      paidAmount: '',
      penaltyFee: '0',
      transactionType: 'rent',
      paymentMethod: '',
      referenceNumber: '',
    });
    loadBills(tenant.id);
    formRef.current?.scrollIntoView({ behavior: 'smooth' });
  }

  async function handleAddBill(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!selectedTenant) return;
    
    setError('');
    
    const selectedUnit = units.find(u => u.id === selectedTenant.unit_id);
    
    const response = await fetch('/api/bills', {
      method: 'POST',
      headers: await getAuthHeaders(),
      body: JSON.stringify({
        tenantId: selectedTenant.id,
        unitId: selectedUnit?.id,
        propertyId: selectedUnit?.property_id,
        description: billForm.description,
        monthDue: billForm.monthDue,
        dueAmount: Number(billForm.dueAmount) || 0,
        paidAmount: Number(billForm.paidAmount) || 0,
        penaltyFee: Number(billForm.penaltyFee) || 0,
        transactionType: billForm.transactionType,
        paymentMethod: billForm.paymentMethod,
        referenceNumber: billForm.referenceNumber,
      }),
    });

    const result = await response.json();

    if (!response.ok) {
      setError(result.message ?? 'Unable to record bill.');
      return;
    }

    setMessage('Bill recorded.');
    loadBills(selectedTenant.id);
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
          <article className="card" style={{ textAlign: 'center' }}>
            <div className="card-label"><span className="badge badge-pm">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><rect x="1" y="4" width="22" height="16" rx="2"/><line x1="1" y1="10" x2="23" y2="10"/></svg>
            </span>Utility Summary</div>
            <DonutChart
              data={[
                { label: 'Water', value: bills.filter((b: any) => b.transaction_type === 'water').length, color: '#0ea5e9' },
                { label: 'Garbage', value: bills.filter((b: any) => b.transaction_type === 'garbage').length, color: '#10b981' },
                { label: 'Service', value: bills.filter((b: any) => b.transaction_type === 'service_charge').length, color: '#8b5cf6' },
                { label: 'Parking', value: bills.filter((b: any) => b.transaction_type === 'parking').length, color: '#f59e0b' },
              ]}
            />
            <p style={{ color: 'var(--ink-3)', marginTop: 8, fontSize: '13px' }}>Total utility bills</p>
          </article>

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
              <input value={utilityForm.amount} onChange={e => setUtilityForm(f => ({ ...f, amount: e.target.value }))} type="number" required placeholder="Amount (KSH)" />
              <input value={utilityForm.description} onChange={e => setUtilityForm(f => ({ ...f, description: e.target.value }))} placeholder="Description (optional)" />
              <button type="submit">Record Utility Bill</button>
            </form>
            <p style={{ fontSize: '11px', color: 'var(--ink-3)', marginTop: 8 }}>Creates bill record - tenants see this in Utility Bills tab</p>
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
              <input value={waterForm.amount} onChange={e => setWaterForm(f => ({ ...f, amount: e.target.value }))} type="number" required placeholder="Amount (KSH)" />
              <input value={waterForm.description} onChange={e => setWaterForm(f => ({ ...f, description: e.target.value }))} placeholder="Description (optional)" />
              <button type="submit">Record Water Bill</button>
            </form>
          </article>

          <article className="card">
            <div className="card-label"><span className="badge badge-agent">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><rect x="1" y="4" width="22" height="16" rx="2"/><line x1="1" y1="10" x2="23" y2="10"/></svg>
            </span>Water Meter Billing</div>
            <h3 style={{ marginBottom: 16 }}>Record Water Reading</h3>
            <p style={{ fontSize: '13px', color: 'var(--ink-3)', marginBottom: 12 }}>Water is billed at KES 150/unit. Consumption = Current - Previous.</p>
            <input type="month" value={waterMonthDue} onChange={(event) => setWaterMonthDue(event.target.value)} placeholder="Billing month" style={{ marginBottom: 12 }} />
            {units.length === 0 ? (
              <p style={{ color: 'var(--ink-3)', fontSize: '13px' }}>No units available.</p>
            ) : (
              <div style={{ maxHeight: '240px', overflow: 'auto', marginBottom: 12, border: '1px solid var(--line)', borderRadius: '8px', padding: '8px' }}>
                {units.map((unit) => (
                  <div key={unit.id} style={{ display: 'flex', gap: 8, alignItems: 'center', padding: '8px 0', borderBottom: '1px solid var(--line-soft)' }}>
                    <span style={{ width: 120, fontSize: '13px' }}>{properties.find(p => p.id === unit.property_id)?.name ?? '—'} — Unit {unit.unit_number}</span>
                    <span style={{ width: 80, fontSize: '12px', color: 'var(--ink-3)' }}>{unit.previous_water_reading ?? 0} →</span>
                    <input type="number" value={waterMeterReadings[unit.id] || ''} onChange={(e) => setWaterMeterReadings((prev) => ({ ...prev, [unit.id]: e.target.value }))} placeholder="Current" style={{ flex: 1, padding: '6px' }} />
                    <button type="button" onClick={() => handleWaterMeterReading(unit.id)} disabled={!waterMeterReadings[unit.id]} style={{ padding: '6px 12px', fontSize: '12px' }}>Bill</button>
                  </div>
                ))}
              </div>
            )}
            {message && <p className="landlord-success" style={{ marginTop: 16 }}>{message}</p>}
            {error && <p className="landlord-error" style={{ marginTop: 16 }}>{error}</p>}
          </article>
        </section>

        <section className="card-grid-item" style={{ marginTop: 24 }}>
          <article className="card">
            <div className="card-label"><span className="badge badge-agent">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><rect x="1" y="4" width="22" height="16" rx="2"/><line x1="1" y1="10" x2="23" y2="10"/></svg>
            </span>All Tenants</div>
            <h3 style={{ marginBottom: 16 }}>Select Tenant to View Bills</h3>

            {loading && <p className="landlord-muted">Loading tenants...</p>}
            {!loading && tenants.length === 0 && <p className="landlord-empty">No tenants registered.</p>}

            {!loading && tenants.length > 0 && (
              <div className="table-shell">
                <table className="landlord-table" style={{ minWidth: '100%', fontSize: '13px' }}>
                  <thead>
                    <tr>
                      <th>Name</th>
                      <th>Email</th>
                      <th>Unit</th>
                      <th>Property</th>
                      <th>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {tenants.map(tenant => (
                      <tr key={tenant.id}>
                        <td className="landlord-name">{tenant.full_name}</td>
                        <td>{tenant.email}</td>
                        <td>{tenant.unit}</td>
                        <td>{tenant.property}</td>
                        <td>
                          <button 
                            type="button" 
                            className="action-button primary"
                            style={{ padding: '6px 12px', fontSize: '12px' }}
                            onClick={() => handleViewBills(tenant)}
                          >
                            View Bills
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </article>
        </section>

        {selectedTenant && (
          <section className="card-grid-item" style={{ marginTop: 24 }} ref={formRef}>
            <article className="card" style={{ gridColumn: 'span 2' }}>
              <div className="card-label">
                <span className="badge badge-pm" style={{ background: 'var(--accent)' }}>
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>
                </span>Record Bill Payment - {selectedTenant.full_name}
              </div>
              <h3>Add Rent/Utility Payment</h3>
              <form onSubmit={handleAddBill} className="form-grid">
                <div className="field-group">
                  <label>Description</label>
                  <input value={billForm.description} onChange={e => setBillForm(f => ({ ...f, description: e.target.value }))} required placeholder="e.g., Rent, Water, Service Charge" />
                </div>
                <div className="field-group">
                  <label>Month Due</label>
                  <input value={billForm.monthDue} onChange={e => setBillForm(f => ({ ...f, monthDue: e.target.value }))} placeholder="e.g., August 2024" />
                </div>
                <div className="field-group">
                  <label>Due Amount (KSH)</label>
                  <input type="number" value={billForm.dueAmount} onChange={e => setBillForm(f => ({ ...f, dueAmount: e.target.value }))} required placeholder="e.g., 5000" />
                </div>
                <div className="field-group">
                  <label>Paid Amount (KSH)</label>
                  <input type="number" value={billForm.paidAmount} onChange={e => setBillForm(f => ({ ...f, paidAmount: e.target.value }))} placeholder="e.g., 3000" />
                </div>
                <div className="field-group">
                  <label>Penalty Fee (KSH)</label>
                  <input type="number" value={billForm.penaltyFee} onChange={e => setBillForm(f => ({ ...f, penaltyFee: e.target.value }))} placeholder="e.g., 500" />
                </div>
                <div className="field-group">
                  <label>Transaction Type</label>
                  <select value={billForm.transactionType} onChange={e => setBillForm(f => ({ ...f, transactionType: e.target.value }))}>
                    <option value="rent">Rent</option>
                    <option value="water">Water</option>
                    <option value="service_charge">Service Charge</option>
                    <option value="utility">Utility</option>
                    <option value="deposit">Deposit</option>
                  </select>
                </div>
                <div className="field-group">
                  <label>Payment Method</label>
                  <select value={billForm.paymentMethod} onChange={e => setBillForm(f => ({ ...f, paymentMethod: e.target.value }))}>
                    <option value="">Select method</option>
                    <option value="M-pesa">M-pesa</option>
                    <option value="Cash">Cash</option>
                    <option value="Bank">Bank Transfer</option>
                  </select>
                </div>
                <div className="field-group">
                  <label>Reference Number</label>
                  <input value={billForm.referenceNumber} onChange={e => setBillForm(f => ({ ...f, referenceNumber: e.target.value }))} placeholder="e.g., SH31T8MAYN" />
                </div>
                <button type="submit">Record Payment</button>
                <button type="button" className="secondary-button" onClick={() => setSelectedTenant(null)}>Back to Tenants</button>
              </form>
            </article>

            <article className="card" style={{ gridColumn: 'span 2', marginTop: 24 }}>
              <div className="card-label">
                <span className="badge badge-agent">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><rect x="1" y="4" width="22" height="16" rx="2"/><line x1="1" y1="10" x2="23" y2="10"/></svg>
                </span>Bills & Payments - {selectedTenant.full_name}
              </div>
              <h3 style={{ marginBottom: 16 }}>Transaction Statement</h3>
              {loadingBills && <p className="landlord-muted">Loading bills...</p>}
              {!loadingBills && bills.length === 0 && <p className="landlord-empty">No bills recorded yet.</p>}

              {!loadingBills && bills.length > 0 && (
                <div className="table-shell" style={{ maxHeight: '400px', overflowY: 'auto' }}>
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
                          <td style={{ color: bill.balance > 0 ? 'var(--error)' : 'var(--accent)' }}>{bill.balance.toLocaleString()}</td>
                          <td>{bill.transaction_type}</td>
                          <td>{bill.transaction_number}</td>
                          <td>{bill.transaction_code || '-'}</td>
                          <td>{bill.payment_date || '-'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </article>
          </section>
        )}
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