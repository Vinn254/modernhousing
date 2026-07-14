'use client';

import { useEffect, useRef, useState } from 'react';
import { supabase } from '../../../lib/supabaseClient';

interface Tenant {
  id: string;
  full_name: string;
  email: string;
  phone?: string;
  unit: string;
  unit_id?: string;
  lease_start: string;
  lease_end: string;
  status?: string;
  deposit_amount?: number;
  national_id?: string;
  kra_pin?: string;
  next_of_kin_name?: string;
  next_of_kin_id?: string;
  next_of_kin_phone?: string;
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

const transactionTypes = ['rent', 'water', 'garbage', 'service_charge', 'parking', 'security', 'other', 'deposit'];

async function getAuthHeaders() {
  const { data } = await supabase.auth.getSession();
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (data.session?.access_token) headers.Authorization = `Bearer ${data.session.access_token}`;
  return headers;
}

export default function AgentTenantsPage() {
  const [tenants, setTenants] = useState<Tenant[]>([]);
  const [units, setUnits] = useState<any[]>([]);
  const [bills, setBills] = useState<Bill[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingBills, setLoadingBills] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
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
  const [form, setForm] = useState({
    fullName: '',
    email: '',
    phone: '',
    unitNumber: '',
    leaseStart: new Date().toISOString().split('T')[0],
    leaseEnd: '',
    depositAmount: '',
    nationalId: '',
    kraPin: '',
    nextOfKinName: '',
    nextOfKinId: '',
    nextOfKinPhone: '',
  });
  const [unitForm, setUnitForm] = useState({
    unitNumber: '',
    rentAmount: '',
    unitType: '',
  });
  const [showPayForm, setShowPayForm] = useState(false);
  const [showDirectPayment, setShowDirectPayment] = useState(false);
  const [payForm, setPayForm] = useState({
    billId: '',
    amount: '',
    paymentMethod: 'Cash',
    referenceNumber: '',
  });
  const [directPaymentForm, setDirectPaymentForm] = useState({
    tenantId: '',
    transactionType: 'rent',
    monthDue: '',
    amount: '',
    paymentMethod: 'Cash',
    referenceNumber: '',
  });
  const formRef = useRef<HTMLDivElement>(null);

  async function loadData() {
    setLoading(true);
    setError('');

    try {
      const storedPropertyId = localStorage.getItem('agentPropertyId');
      const headers = await getAuthHeaders();
      const [tenantsResponse, unitsResponse] = await Promise.all([
        fetch(`/api/tenants?propertyId=${storedPropertyId}`, { headers }),
        fetch(`/api/units?propertyId=${storedPropertyId}`, { headers }),
      ]);

      const tenantsResult = await tenantsResponse.json();
      const unitsResult = await unitsResponse.json();

      setTenants(tenantsResult.tenants ?? []);
      setUnits((unitsResult.units ?? []).filter((u: any) => u.property_id === storedPropertyId));
    } catch (err: any) {
      setError(err.message ?? 'Unable to load data.');
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

  async function handleAddTenant(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setMessage('');
    setError('');

    const storedPropertyId = localStorage.getItem('agentPropertyId');
    const selectedUnit = units.find(u => u.unit_number === form.unitNumber);

    const response = await fetch('/api/tenants', {
      method: 'POST',
      headers: await getAuthHeaders(),
      body: JSON.stringify({
        fullName: form.fullName,
        email: form.email,
        phone: form.phone,
        unitId: selectedUnit?.id,
        propertyId: storedPropertyId,
        leaseStart: form.leaseStart,
        leaseEnd: form.leaseEnd,
        depositAmount: Number(form.depositAmount) || 0,
        nationalId: form.nationalId,
        kraPin: form.kraPin,
        nextOfKinName: form.nextOfKinName,
        nextOfKinId: form.nextOfKinId,
        nextOfKinPhone: form.nextOfKinPhone,
      }),
    });

    const result = await response.json();

    if (!response.ok) {
      setError(result.message ?? 'Unable to create tenant.');
      return;
    }

    setMessage('Tenant registered.');
    setForm({ ...form, fullName: '', email: '', phone: '', unitNumber: '', leaseEnd: '', depositAmount: '', nationalId: '', kraPin: '', nextOfKinName: '', nextOfKinId: '', nextOfKinPhone: '' });
    await loadData();
  }

  async function handleAddUnit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError('');

    const storedPropertyId = localStorage.getItem('agentPropertyId');
    const response = await fetch('/api/units', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        propertyId: storedPropertyId,
        unitNumber: unitForm.unitNumber,
        rentAmount: Number(unitForm.rentAmount) || 0,
        unitType: unitForm.unitType,
      }),
    });

    const result = await response.json();

    if (!response.ok) {
      setError(result.message ?? 'Unable to add unit.');
      return;
    }

    setUnitForm({ unitNumber: '', rentAmount: '', unitType: '' });
    await loadData();
  }

  async function handleMarkRelocated(unitId: string) {
    if (!confirm('Mark this tenant as relocated? This will free the unit.')) return;
    
    const response = await fetch('/api/units', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        id: unitId,
        occupancyStatus: 'vacant'
      }),
    });
    
    if (response.ok) {
      setMessage('Unit marked as vacant after tenant relocation.');
      await loadData();
    } else {
      const result = await response.json();
      setError(result.message ?? 'Failed to update unit status.');
    }
  }

  async function handleViewBills(tenant: Tenant) {
    setSelectedTenant(tenant);
    setBillForm({
      description: `Rent for ${tenant.full_name}`,
      monthDue: '',
      dueAmount: String(tenant.deposit_amount || 0),
      paidAmount: '',
      penaltyFee: '0',
      transactionType: 'rent',
      paymentMethod: '',
      referenceNumber: '',
    });
    setShowPayForm(false);
    setShowDirectPayment(false);
    await loadBills(tenant.id);
    formRef.current?.scrollIntoView({ behavior: 'smooth' });
  }

  async function handleShowPayForm(billId: string, balance: number) {
    setPayForm({
      billId,
      amount: String(balance),
      paymentMethod: 'Cash',
      referenceNumber: '',
    });
    setShowPayForm(true);
  }

  async function handleRecordPayment(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setMessage('');
    setError('');

    if (!payForm.billId || !payForm.amount) {
      setError('Select a bill and enter amount.');
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
      }),
    });

    const result = await response.json();
    if (!response.ok) {
      setError(result.message ?? 'Unable to record payment.');
      return;
    }
    setMessage('Payment recorded.');
    setShowPayForm(false);
    await loadBills(selectedTenant!.id);
  }

  async function handleDirectPayment(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setMessage('');
    setError('');

    if (!directPaymentForm.tenantId || !directPaymentForm.transactionType || !directPaymentForm.amount) {
      setError('All fields required.');
      return;
    }

    const response = await fetch('/api/bills', {
      method: 'POST',
      headers: await getAuthHeaders(),
      body: JSON.stringify({
        tenantId: directPaymentForm.tenantId,
        unitId: tenants.find(t => t.id === directPaymentForm.tenantId)?.unit_id,
        propertyId: localStorage.getItem('agentPropertyId'),
        description: `${directPaymentForm.transactionType.replace('_', ' ')} payment`,
        monthDue: directPaymentForm.monthDue || null,
        dueAmount: Number(directPaymentForm.amount),
        paidAmount: Number(directPaymentForm.amount),
        penaltyFee: 0,
        transactionType: directPaymentForm.transactionType,
        paymentMethod: directPaymentForm.paymentMethod,
        referenceNumber: directPaymentForm.referenceNumber,
      }),
    });

    const result = await response.json();
    if (!response.ok) {
      setError(result.message ?? 'Unable to record payment.');
      return;
    }
    setMessage('Direct payment recorded.');
    setDirectPaymentForm({ tenantId: '', transactionType: 'rent', monthDue: '', amount: '', paymentMethod: 'Cash', referenceNumber: '' });
    if (selectedTenant) await loadBills(selectedTenant.id);
  }

  async function handleAddBill(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!selectedTenant) return;
    
    setError('');
    
    const storedPropertyId = localStorage.getItem('agentPropertyId');
    const unit = units.find(u => u.id === selectedTenant.unit_id);
    
    const response = await fetch('/api/bills', {
      method: 'POST',
      headers: await getAuthHeaders(),
      body: JSON.stringify({
        tenantId: selectedTenant.id,
        unitId: unit?.id,
        propertyId: storedPropertyId,
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
    await loadBills(selectedTenant.id);
  }

  return (
    <main className="container admin-no-hero">
      <div className="card-admin-header">
        <div>
          <p className="heading">Tenant Management</p>
          <p className="subheading">Manage tenants for your assigned property.</p>
        </div>
      </div>

      <section className="dashboard-hero-stats">
        <div className="card" style={{ padding: '18px 16px', display: 'flex', alignItems: 'center', gap: 12 }}>
          <div style={{ width: 48, height: 48, borderRadius: '50%', background: 'var(--accent-soft)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="var(--accent)" strokeWidth="2"><path d="M3 21h18"/><path d="M5 21V7l8-4v18"/><path d="M19 21V11l-6-4"/></svg>
          </div>
          <div>
            <div className="card-label">Total Units</div>
            <h3 style={{ margin: 0 }}>{units.length}</h3>
          </div>
        </div>
        <div className="card" style={{ padding: '18px 16px', display: 'flex', alignItems: 'center', gap: 12 }}>
          <div style={{ width: 48, height: 48, borderRadius: '50%', background: 'rgba(16,185,129,0.12)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="var(--accent)" strokeWidth="2"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 8 10.01"/></svg>
          </div>
          <div>
            <div className="card-label">Occupied</div>
            <h3 style={{ margin: 0 }}>{units.filter(u => u.occupancy_status === 'occupied').length}</h3>
          </div>
        </div>
        <div className="card" style={{ padding: '18px 16px', display: 'flex', alignItems: 'center', gap: 12 }}>
          <div style={{ width: 48, height: 48, borderRadius: '50%', background: 'rgba(14,165,233,0.12)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#0ea5e9" strokeWidth="2"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
          </div>
          <div>
            <div className="card-label">Vacant</div>
            <h3 style={{ margin: 0 }}>{units.filter(u => u.occupancy_status === 'vacant').length}</h3>
          </div>
        </div>
        <div className="card" style={{ padding: '18px 16px', display: 'flex', alignItems: 'center', gap: 12 }}>
          <div style={{ width: 48, height: 48, borderRadius: '50%', background: 'rgba(245,158,11,0.12)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="var(--amber)" strokeWidth="2"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/></svg>
          </div>
          <div>
            <div className="card-label">Active Tenants</div>
            <h3 style={{ margin: 0 }}>{tenants.length}</h3>
          </div>
        </div>
      </section>

      <section className="card-grid">
        <article className="card">
          <div className="card-label">
            <span className="badge badge-pm" style={{ background: 'var(--accent)' }}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>
            </span>Add Tenant
          </div>
          <h3>Register New Tenant</h3>
          <form onSubmit={handleAddTenant} className="form-grid">
            <div className="field-group">
              <label>Full name</label>
              <input value={form.fullName} onChange={e => setForm(f => ({ ...f, fullName: e.target.value }))} required placeholder="Tenant name" />
            </div>
            <div className="field-group">
              <label>Email</label>
              <input type="email" value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))} required placeholder="Tenant email" />
            </div>
            <div className="field-group">
              <label>Phone</label>
              <input value={form.phone} onChange={e => setForm(f => ({ ...f, phone: e.target.value }))} placeholder="Phone number" />
            </div>
            <div className="field-group">
              <label>National ID Number</label>
              <input value={form.nationalId} onChange={e => setForm(f => ({ ...f, nationalId: e.target.value }))} placeholder="Optional" />
            </div>
            <div className="field-group">
              <label>KRA PIN Number</label>
              <input value={form.kraPin} onChange={e => setForm(f => ({ ...f, kraPin: e.target.value }))} placeholder="Optional" />
            </div>
            <div className="field-group">
              <label>Next of Kin Name</label>
              <input value={form.nextOfKinName} onChange={e => setForm(f => ({ ...f, nextOfKinName: e.target.value }))} placeholder="Optional" />
            </div>
            <div className="field-group">
              <label>Next of Kin ID Number</label>
              <input value={form.nextOfKinId} onChange={e => setForm(f => ({ ...f, nextOfKinId: e.target.value }))} placeholder="Optional" />
            </div>
            <div className="field-group">
              <label>Next of Kin Phone</label>
              <input value={form.nextOfKinPhone} onChange={e => setForm(f => ({ ...f, nextOfKinPhone: e.target.value }))} placeholder="Optional" />
            </div>
            <div className="field-group">
              <label>Select unit</label>
              <select value={form.unitNumber} onChange={e => setForm(f => ({ ...f, unitNumber: e.target.value }))} required>
                <option value="">Choose vacant unit</option>
                {units.filter(u => u.occupancy_status === 'vacant').map(u => (
                  <option key={u.id} value={u.unit_number}>{u.unit_number} ({u.unit_type || 'unit'})</option>
                ))}
              </select>
            </div>
            <div className="field-group">
              <label>Lease Start Date</label>
              <input type="date" value={form.leaseStart} onChange={e => setForm(f => ({ ...f, leaseStart: e.target.value }))} required />
            </div>
            <div className="field-group">
              <label>Payment Due Date</label>
              <input type="date" value={form.leaseEnd} onChange={e => setForm(f => ({ ...f, leaseEnd: e.target.value }))} required />
              <small style={{ color: 'var(--ink-3)', fontSize: '12px' }}>When tenant is expected to make rent payment</small>
            </div>
            <div className="field-group">
              <label>Deposit Amount (KSH)</label>
              <input type="number" value={form.depositAmount} onChange={e => setForm(f => ({ ...f, depositAmount: e.target.value }))} placeholder="e.g., 5000" />
            </div>
            <button type="submit">Add Tenant</button>
          </form>
          {message && <p className="landlord-success" style={{ marginTop: 16 }}>{message}</p>}
          {error && <p className="landlord-error" style={{ marginTop: 16 }}>{error}</p>}
        </article>

        <article className="card">
          <div className="card-label">
            <span className="badge badge-agent">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><rect x="1" y="4" width="22" height="16" rx="2"/><line x1="1" y1="10" x2="23" y2="10"/></svg>
            </span>Create New Unit
          </div>
          <h3>Add Unit</h3>
          <form onSubmit={handleAddUnit} className="form-grid">
            <div className="field-group">
              <label>Unit number</label>
              <input value={unitForm.unitNumber} onChange={e => setUnitForm(f => ({ ...f, unitNumber: e.target.value }))} required placeholder="e.g., A1" />
            </div>
            <div className="field-group">
              <label>Rent amount (KSH)</label>
              <input type="number" value={unitForm.rentAmount} onChange={e => setUnitForm(f => ({ ...f, rentAmount: e.target.value }))} placeholder="e.g., 6000" />
            </div>
            <div className="field-group">
              <label>Unit Type</label>
              <select value={unitForm.unitType} onChange={e => setUnitForm(f => ({ ...f, unitType: e.target.value }))}>
                <option value="">Choose type (optional)</option>
                <option value="single-room">Single Room</option>
                <option value="bedsitter">Bedsitter</option>
                <option value="one-bedroom">One Bedroom</option>
                <option value="two-bedroom">Two Bedroom</option>
                <option value="three-bedroom">Three Bedroom</option>
              </select>
            </div>
            <button type="submit">Add Unit</button>
          </form>
        </article>
      </section>

      <section className="card-grid-item" style={{ marginTop: 24 }}>
        <article className="card">
          <div className="card-label">
            <span className="badge badge-agent">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/></svg>
            </span>Tenants in My Property
          </div>
          <h3 style={{ marginBottom: 16 }}>All Tenants</h3>
          {loading && <p className="landlord-muted">Loading tenants...</p>}
          {!loading && tenants.length === 0 && <p className="landlord-empty">No tenants added yet.</p>}

          {!loading && tenants.length > 0 && (
            <div className="table-shell">
              <table className="landlord-table" style={{ fontSize: '13px' }}>
                <thead>
                  <tr>
                    <th>Name</th>
                    <th>Email / Unit</th>
                    <th>Lease Start</th>
                    <th>Payment Due</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {tenants.map(tenant => {
                    const unit = units.find(u => u.id === tenant.unit_id);
                    return (
                      <tr key={tenant.id}>
                        <td className="landlord-name">{tenant.full_name}</td>
                        <td>{tenant.email} · Unit {tenant.unit}</td>
                        <td>{tenant.lease_start}</td>
                        <td>{tenant.lease_end}</td>
                        <td>
                          <div className="landlord-actions">
                            <button 
                              type="button" 
                              className="action-button" 
                              style={{ padding: '6px 12px', fontSize: '12px' }}
                              onClick={() => unit && handleMarkRelocated(unit.id)}
                            >
                              Mark Relocated
                            </button>
                            <button 
                              type="button" 
                              className="action-button primary" 
                              style={{ padding: '6px 12px', fontSize: '12px', marginLeft: 8 }}
                              onClick={() => handleViewBills(tenant)}
                            >
                              View Bills
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
          {message && <p className="landlord-success" style={{ marginTop: 16 }}>{message}</p>}
          {error && <p className="landlord-error" style={{ marginTop: 16 }}>{error}</p>}
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
            
            <div style={{ marginBottom: 16 }}>
              <button className="secondary-button" onClick={() => setShowDirectPayment(!showDirectPayment)}>Record Direct Payment</button>
            </div>

            {showDirectPayment && (
              <div className="card" style={{ marginBottom: 16, background: 'var(--surface)' }}>
                <h3>Record Direct Payment</h3>
                <form onSubmit={handleDirectPayment} className="form-grid">
                  <div className="field-group">
                    <label>Transaction Type</label>
                    <select value={directPaymentForm.transactionType} onChange={e => setDirectPaymentForm(f => ({ ...f, transactionType: e.target.value }))}>
                      {transactionTypes.map(t => <option key={t} value={t}>{t.replace('_', ' ')}</option>)}
                    </select>
                  </div>
                  <div className="field-group">
                    <label>Month Due</label>
                    <input type="month" value={directPaymentForm.monthDue} onChange={e => setDirectPaymentForm(f => ({ ...f, monthDue: e.target.value }))} />
                  </div>
                  <div className="field-group">
                    <label>Amount (KSH)</label>
                    <input type="number" value={directPaymentForm.amount} onChange={e => setDirectPaymentForm(f => ({ ...f, amount: e.target.value }))} required placeholder="Amount" />
                  </div>
                  <div className="field-group">
                    <label>Payment Method</label>
                    <select value={directPaymentForm.paymentMethod} onChange={e => setDirectPaymentForm(f => ({ ...f, paymentMethod: e.target.value }))}>
                      <option value="Cash">Cash</option>
                      <option value="M-pesa">M-pesa</option>
                      <option value="Bank Transfer">Bank Transfer</option>
                    </select>
                  </div>
                  <div className="field-group">
                    <label>Reference Number</label>
                    <input value={directPaymentForm.referenceNumber} onChange={e => setDirectPaymentForm(f => ({ ...f, referenceNumber: e.target.value }))} placeholder="e.g., SH31T8MAYN" />
                  </div>
                  <button type="submit">Record Payment</button>
                </form>
              </div>
            )}

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
                  <button type="submit">Record Payment</button>
                  <button type="button" className="secondary-button" onClick={() => setShowPayForm(false)}>Cancel</button>
                </form>
              </div>
            )}

            <h3 style={{ marginBottom: 16 }}>Transaction Statement</h3>
            {loadingBills && <p className="landlord-muted">Loading bills...</p>}
            {!loadingBills && bills.length === 0 && <p className="landlord-empty">No bills recorded yet.</p>}

            {!loadingBills && bills.length > 0 && (
              <div className="table-shell" style={{ maxHeight: '400px', overflowY: 'auto' }}>
                <table className="landlord-table" style={{ fontSize: '12px' }}>
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
                      <th>Action</th>
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
                        <td>
                          {bill.balance > 0 && (
                            <button className="action-button primary" style={{ padding: '4px 8px', fontSize: '11px' }} onClick={() => handleShowPayForm(bill.id, bill.balance)}>Pay</button>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
            <button type="button" className="secondary-button" onClick={() => setSelectedTenant(null)} style={{ marginTop: 16 }}>Back to Tenants</button>
          </article>
        </section>
      )}
    </main>
  );
}