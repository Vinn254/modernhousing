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
    leaseStart: '',
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
      const [tenantsResponse, unitsResponse] = await Promise.all([
        fetch(`/api/tenants?propertyId=${storedPropertyId}`),
        fetch(`/api/units?propertyId=${storedPropertyId}`),
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
    setForm({ fullName: '', email: '', phone: '', unitNumber: '', leaseStart: '', leaseEnd: '', depositAmount: '' });
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

  return (
    <main className="container admin-no-hero" style={{ padding: '34px 0 80px' }}>
      <div className="card-admin-header">
        <div>
          <p className="heading">Tenant Management</p>
          <p className="subheading">Manage tenants for your assigned property.</p>
        </div>
      </div>

      <section className="bento-section">
        <div className="bento">

          <article className="card" style={{ gridColumn: 'span 12' }}>
            <div className="card-label">
              <span className="badge badge-pm" style={{ background: 'var(--accent)' }}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"/><line x="12" y="8" x2="12" y2="16"/><line x="8" y="12" x2="16" y2="12"/></svg>
              </span>Add Tenant
            </div>
            <h3>Register New Tenant</h3>
            <form onSubmit={handleAddTenant} className="form-grid">
              <input value={form.fullName} onChange={e => setForm(f => ({ ...f, fullName: e.target.value }))} required placeholder="Tenant name" />
              <input type="email" value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))} required placeholder="Tenant email" />
              <input value={form.phone} onChange={e => setForm(f => ({ ...f, phone: e.target.value }))} placeholder="Phone" />
              <select value={form.unitNumber} onChange={e => setForm(f => ({ ...f, unitNumber: e.target.value }))} required>
                <option value="">Select unit</option>
                {units.map(u => (
                  <option key={u.id} value={u.unit_number}>{u.unit_number} ({u.unit_type || 'unit'})</option>
                ))}
              </select>
              <input type="date" value={form.leaseStart} onChange={e => setForm(f => ({ ...f, leaseStart: e.target.value }))} required />
              <input type="date" value={form.leaseEnd} onChange={e => setForm(f => ({ ...f, leaseEnd: e.target.value }))} required />
              <input type="number" value={form.depositAmount} onChange={e => setForm(f => ({ ...f, depositAmount: e.target.value }))} placeholder="Deposit" />
              <button type="submit">Add Tenant</button>
            </form>
            {message && <p className="landlord-success" style={{ marginTop: 16 }}>{message}</p>}
            {error && <p className="landlord-error" style={{ marginTop: 16 }}>{error}</p>}
          </article>

          <article className="card" style={{ gridColumn: 'span 12' }}>
            <div className="card-label">
              <span className="badge badge-agent">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><rect x="1" y="4" width="22" height="16" rx="2"/><line x="1" y="10" x2="23" y2="10"/></svg>
              </span>Create New Unit
            </div>
            <h3>Add Unit</h3>
            <form onSubmit={handleAddUnit} className="form-grid">
              <input value={unitForm.unitNumber} onChange={e => setUnitForm(f => ({ ...f, unitNumber: e.target.value }))} required placeholder="Unit number (e.g., A1)" />
              <input type="number" value={unitForm.rentAmount} onChange={e => setUnitForm(f => ({ ...f, rentAmount: e.target.value }))} placeholder="Rent amount (KSH)" />
              <select value={unitForm.unitType} onChange={e => setUnitForm(f => ({ ...f, unitType: e.target.value }))}>
                <option value="">Unit Type (optional)</option>
                <option value="single-room">Single Room</option>
                <option value="bedsitter">Bedsitter</option>
                <option value="one-bedroom">One Bedroom</option>
                <option value="two-bedroom">Two Bedroom</option>
                <option value="three-bedroom">Three Bedroom</option>
              </select>
              <button type="submit">Add Unit</button>
            </form>
          </article>

          <article className="card" style={{ gridColumn: 'span 12' }}>
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
                      <th>Email</th>
                      <th>Unit</th>
                      <th>Lease Start</th>
                      <th>Lease End</th>
                    </tr>
                  </thead>
                  <tbody>
                    {tenants.map(tenant => (
                      <tr key={tenant.id}>
                        <td className="landlord-name">{tenant.full_name}</td>
                        <td>{tenant.email}</td>
                        <td>{tenant.unit}</td>
                        <td>{tenant.lease_start}</td>
                        <td>{tenant.lease_end}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </article>
        </div>
      </section>
    </main>
  );
}