'use client';

import { useEffect, useRef, useState } from 'react';
import { supabase } from '../../../lib/supabaseClient';

interface Property {
  id: string;
  name: string;
  address: string;
}

interface Tenant {
  id: string;
  full_name: string;
  email: string;
  phone?: string;
  unit: string;
  unit_id?: string;
  property: string;
  property_id?: string;
  address?: string;
  lease_start: string;
  lease_end: string;
  status?: string;
  deposit_amount?: number;
  national_id?: string;
  kra_pin?: string;
  next_of_kin_id?: string;
}

async function getAuthHeaders() {
  const { data } = await supabase.auth.getSession();
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (data.session?.access_token) headers.Authorization = `Bearer ${data.session.access_token}`;
  return headers;
}

export default function TenantsPage() {
  const [tenants, setTenants] = useState<Tenant[]>([]);
  const [properties, setProperties] = useState<Property[]>([]);
  const [units, setUnits] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [form, setForm] = useState({
    fullName: '',
    email: '',
    phone: '',
    unitId: '',
    leaseStart: '',
    leaseEnd: '',
    depositAmount: '',
    nationalId: '',
    kraPin: '',
    nextOfKinId: '',
  });
  const [editingTenant, setEditingTenant] = useState<Tenant | null>(null);
  const formRef = useRef<HTMLDivElement>(null);

  async function loadData() {
    setLoading(true);
    setError('');

    try {
      const [tenantsResponse, propertiesResponse, unitsResponse] = await Promise.all([
        fetch('/api/tenants', { headers: await getAuthHeaders() }),
        fetch('/api/properties', { headers: await getAuthHeaders() }),
        fetch('/api/units', { headers: await getAuthHeaders() }),
      ]);

      const tenantsResult = await tenantsResponse.json();
      const propertiesResult = await propertiesResponse.json();
      const unitsResult = await unitsResponse.json();

      setTenants(tenantsResult.tenants ?? []);
      setProperties(propertiesResult.properties ?? []);
      setUnits(unitsResult.units ?? []);
    } catch (err: any) {
      setError(err.message ?? 'Unable to load data.');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadData();
  }, []);

  function scrollToForm() {
    formRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setMessage('');
    setError('');

    // Derive propertyId from selected unit
    const selectedUnit = units.find(u => u.id === form.unitId);
    const propertyId = selectedUnit?.property_id;

    const url = editingTenant ? `/api/tenants?id=${editingTenant.id}` : '/api/tenants';
    const method = editingTenant ? 'PATCH' : 'POST';

const body = editingTenant
       ? {
           id: editingTenant.id,
           fullName: form.fullName,
           email: form.email,
           phone: form.phone,
           leaseStart: form.leaseStart,
           leaseEnd: form.leaseEnd,
         }
       : { ...form, propertyId, depositAmount: Number(form.depositAmount) || 0, nationalId: form.nationalId || null, kraPin: form.kraPin || null, nextOfKinId: form.nextOfKinId || null };

    const response = await fetch(url, {
      method,
      headers: await getAuthHeaders(),
      body: JSON.stringify(body),
    });

    const result = await response.json();

    if (!response.ok) {
      setError(result.message ?? (editingTenant ? 'Unable to update tenant.' : 'Unable to create tenant.'));
      return;
    }

setMessage(editingTenant ? 'Tenant updated.' : 'Tenant registered.');
     setForm({ fullName: '', email: '', phone: '', unitId: '', leaseStart: '', leaseEnd: '', depositAmount: '', nationalId: '', kraPin: '', nextOfKinId: '' });
     setEditingTenant(null);
    await loadData();
  }

  async function handleRemove(tenantId: string) {
    if (!confirm('Remove this tenant? They will be marked as relocated.')) return;
    const response = await fetch(`/api/tenants?id=${encodeURIComponent(tenantId)}`, { method: 'DELETE', headers: await getAuthHeaders() });
    const result = await response.json();
    if (!response.ok) {
      setError(result.message ?? 'Unable to remove tenant.');
      return;
    }
    setTenants(tenants.filter(t => t.id !== tenantId));
    setMessage('Tenant removed.');
  }

function handleEdit(tenant: Tenant) {
     setEditingTenant(tenant);
     setForm({
       fullName: tenant.full_name,
       email: tenant.email,
       phone: tenant.phone ?? '',
       unitId: tenant.unit_id ?? '',
       leaseStart: tenant.lease_start ?? '',
       leaseEnd: tenant.lease_end ?? '',
       depositAmount: String(tenant.deposit_amount ?? ''),
       nationalId: tenant.national_id ?? '',
       kraPin: tenant.kra_pin ?? '',
       nextOfKinId: tenant.next_of_kin_id ?? '',
     });
     scrollToForm();
   }

  function resetForm() {
    setForm({ fullName: '', email: '', phone: '', unitId: '', leaseStart: '', leaseEnd: '', depositAmount: '', nationalId: '', kraPin: '', nextOfKinId: '' });
    setEditingTenant(null);
    setMessage('');
    setError('');
  }

  return (
    <>
      <main className="container admin-no-hero">
        <div className="card-admin-header">
          <div>
            <p className="heading">Tenant Management</p>
            <p className="subheading">Register tenants, update lease info, and manage occupancy.</p>
          </div>
        </div>

<section className="card-grid">
          <article className="card" style={{ gridColumn: 'span 2' }}>
            <div className="card-label">
              <span className="badge badge-pm">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13 a4 0 0 1 0 7.75"/></svg>
              </span>{editingTenant ? 'Edit Tenant' : 'Add Tenant'}
            </div>
            <h3>{editingTenant ? 'Update Tenant Details' : 'Register New Tenant'}</h3>
            <form onSubmit={handleSubmit} className="form-grid">
              <input value={form.fullName} onChange={e => setForm(f => ({ ...f, fullName: e.target.value }))} required placeholder="Full name" />
              <input type="email" value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))} required placeholder="Email" />
              <input value={form.phone} onChange={e => setForm(f => ({ ...f, phone: e.target.value }))} placeholder="Phone" />
              {!editingTenant && (
                <select value={form.unitId} onChange={e => setForm(f => ({ ...f, unitId: e.target.value }))} required>
                  <option value="">Select unit</option>
                  {units.filter(u => u.occupancy_status === 'vacant').map(u => (
                    <option key={u.id} value={u.id}>{u.unit_number} - {properties.find(p => p.id === (u as any).property_id)?.name ?? '—'}</option>
                  ))}
                </select>
              )}
              <input type="date" value={form.leaseStart} onChange={e => setForm(f => ({ ...f, leaseStart: e.target.value }))} required />
              <input type="date" value={form.leaseEnd} onChange={e => setForm(f => ({ ...f, leaseEnd: e.target.value }))} required />
{!editingTenant && <input type="number" value={form.depositAmount} onChange={e => setForm(f => ({ ...f, depositAmount: e.target.value }))} placeholder="Deposit amount" />}
               <input value={form.nationalId} onChange={e => setForm(f => ({ ...f, nationalId: e.target.value }))} placeholder="National ID (Optional)" />
               <input value={form.kraPin} onChange={e => setForm(f => ({ ...f, kraPin: e.target.value }))} placeholder="KRA PIN (Optional)" />
               <input value={form.nextOfKinId} onChange={e => setForm(f => ({ ...f, nextOfKinId: e.target.value }))} placeholder="Next of Kin ID (Optional)" />
               <button type="submit">{editingTenant ? 'Update Tenant' : 'Add Tenant'}</button>
              {editingTenant && <button type="button" className="secondary-button" onClick={resetForm}>Cancel Edit</button>}
            </form>
            {message && <p className="landlord-success" style={{ marginTop: 16 }}>{message}</p>}
            {error && <p className="landlord-error" style={{ marginTop: 16 }}>{error}</p>}
          </article>
        </section>

        <section className="card-grid-item">
          <article className="card">
            <div className="card-label">
              <span className="badge badge-agent">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><rect x="1" y="4" width="22" height="16" rx="2"/><line x1="1" y1="10" x2="23" y2="10"/></svg>
              </span>All Tenants
            </div>
            <h3 style={{ marginBottom: 16 }}>Tenant Records</h3>

            {loading && <p className="landlord-muted">Loading tenants...</p>}
            {!loading && tenants.length === 0 && <p className="landlord-empty">No tenants registered yet.</p>}

            {!loading && tenants.length > 0 && (
              <div className="table-shell">
                <table className="landlord-table" style={{ minWidth: '100%', fontSize: '13px' }}>
                  <thead>
                    <tr>
                      <th>Name</th>
                      <th>Email</th>
                      <th>Unit</th>
                      <th>Property</th>
                      <th>Lease</th>
                      <th>Status</th>
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
                        <td>{tenant.lease_start} → {tenant.lease_end}</td>
                        <td>
                          <span className={`status-pill ${tenant.status === 'active' || !tenant.status ? 'status-active' : 'status-pending'}`}>
                            {tenant.status ?? 'Active'}
                          </span>
                        </td>
                        <td>
                          <div className="landlord-actions">
                            <button className="action-button primary" onClick={() => handleEdit(tenant)}>Edit</button>
                            <button className="action-button danger" onClick={() => handleRemove(tenant.id)}>Remove</button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </article>
        </section>
      </main>

      <footer>
        <div className="footer-inner">
          <div className="footer-brand"><span className="logo-mark" style={{ width: 26, height: 26, borderRadius: 7 }}><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M3 21h18"/><path d="M5 21V7l8-4v18"/><path d="M19 21V11l-6-4"/></svg></span>Springfield Systems</div>
          <div className="footer-links"><a href="/">Home</a><a href="/dashboard">Dashboard</a></div>
          <div className="footer-copy">© 2026 Springfield Systems. All rights reserved.</div>
        </div>
      </footer>
    </>
  );
}