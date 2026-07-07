'use client';

import { useEffect, useRef, useState } from 'react';
import { supabase } from '../../../lib/supabaseClient';
import DonutChart from '../../components/DonutChart';

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
}

async function getAuthHeaders() {
  const { data } = await supabase.auth.getSession();
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (data.session?.access_token) headers.Authorization = `Bearer ${data.session.access_token}`;
  return headers;
}

export default function AgentTenantsPage() {
  const [tenants, setTenants] = useState<Tenant[]>([]);
  const [units, setUnits] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [form, setForm] = useState({
    fullName: '',
    email: '',
    phone: '',
    unitNumber: '',
    leaseStart: new Date().toISOString().split('T')[0],
    leaseEnd: '',
    depositAmount: '',
  });
  const [unitForm, setUnitForm] = useState({
    unitNumber: '',
    rentAmount: '',
    unitType: '',
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
      }),
    });

    const result = await response.json();

    if (!response.ok) {
      setError(result.message ?? 'Unable to create tenant.');
      return;
    }

    setMessage('Tenant registered.');
    setForm({ ...form, fullName: '', email: '', phone: '', unitNumber: '', leaseEnd: '', depositAmount: '' });
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
              <table className="landlord-table" style={{ minWidth: '100%', fontSize: '13px' }}>
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
                          <button 
                            type="button" 
                            className="action-button" 
                            style={{ padding: '6px 12px', fontSize: '12px' }}
                            onClick={() => unit && handleMarkRelocated(unit.id)}
                          >
                            Mark Relocated
                          </button>
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
    </main>
  );
}