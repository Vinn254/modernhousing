'use client';

import { useEffect, useRef, useState } from 'react';
import { supabase } from '../../../lib/supabaseClient';

interface Property {
  id: string;
  name: string;
  address: string;
}

interface Unit {
  id: string;
  property_id: string;
  unit_number: string;
  rent_amount: number;
  occupancy_status: string;
  tenant?: string | null;
  size?: string;
  agent_email?: string;
}

export default function UnitsPage() {
  const [units, setUnits] = useState<Unit[]>([]);
  const [properties, setProperties] = useState<Property[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [form, setForm] = useState({ propertyId: '', unitNumber: '', rentAmount: '', size: '', agentEmail: '' });
  const [editingUnit, setEditingUnit] = useState<Unit | null>(null);
  const formRef = useRef<HTMLDivElement>(null);

  async function getAuthHeaders() {
    const { data } = await supabase.auth.getSession();
    const headers: Record<string, string> = { 'Content-Type': 'application/json' };
    if (data.session?.access_token) headers.Authorization = `Bearer ${data.session.access_token}`;
    return headers;
  }

  async function loadUnits() {
    setLoading(true);
    setError('');
    const response = await fetch('/api/units', { headers: await getAuthHeaders() });
    const result = await response.json();

    if (!response.ok) {
      setError(result.message ?? 'Unable to load units.');
      setLoading(false);
      return;
    }

    setUnits(result.units ?? []);
    setLoading(false);
  }

  async function loadProperties() {
    const response = await fetch('/api/properties', { headers: await getAuthHeaders() });
    const result = await response.json();
    if (response.ok) setProperties(result.properties ?? []);
  }

  useEffect(() => {
    loadUnits();
    loadProperties();
  }, []);

  function scrollToForm() {
    formRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setMessage('');
    setError('');

    const url = editingUnit ? `/api/units?id=${editingUnit.id}` : '/api/units';
    const method = editingUnit ? 'PATCH' : 'POST';

    const body = editingUnit
      ? { id: editingUnit.id, ...form, rentAmount: Number(form.rentAmount) || editingUnit.rent_amount }
      : { ...form, rentAmount: Number(form.rentAmount) || 0 };

    const response = await fetch(url, {
      method,
      headers: await getAuthHeaders(),
      body: JSON.stringify(body),
    });

    const result = await response.json();

    if (!response.ok) {
      setError(result.message ?? (editingUnit ? 'Unable to update unit.' : 'Unable to create unit.'));
      return;
    }

    setMessage(editingUnit ? 'Unit updated.' : 'Unit added.');
    setForm({ propertyId: '', unitNumber: '', rentAmount: '', size: '', agentEmail: '' });
    setEditingUnit(null);
    await loadUnits();
  }

  async function handleRemove(unitId: string) {
    if (!confirm('Remove this unit? Units with tenants cannot be removed.')) return;
    const response = await fetch(`/api/units?id=${encodeURIComponent(unitId)}`, { method: 'DELETE', headers: await getAuthHeaders() });
    const result = await response.json();
    if (!response.ok) {
      setError(result.message ?? 'Unable to remove unit.');
      return;
    }
    setUnits(units.filter(u => u.id !== unitId));
  }

  function handleEdit(unit: Unit) {
    setEditingUnit(unit);
    setForm({ propertyId: unit.property_id, unitNumber: unit.unit_number, rentAmount: String(unit.rent_amount), size: unit.size ?? '', agentEmail: unit.agent_email ?? '' });
    scrollToForm();
  }

  function resetForm() {
    setForm({ propertyId: '', unitNumber: '', rentAmount: '', size: '', agentEmail: '' });
    setEditingUnit(null);
    setMessage('');
    setError('');
  }

  return (
    <>
      <main className="container admin-no-hero" style={{ padding: '34px 0 80px' }}>
        <div className="card-admin-header">
          <div>
            <p className="heading">Units Management</p>
            <p className="subheading">Add units to properties and assign agents to manage them.</p>
          </div>
        </div>

        <section className="bento-section">
          <div className="bento">
            <article className="card">
              <div ref={formRef} className="card-label"><span className="badge badge-pm">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><rect x="1" y="4" width="22" height="16" rx="2"/><line x1="1" y1="10" x2="23" y2="10"/></svg>
              </span>{editingUnit ? 'Edit Unit' : 'Add Unit'}</div>
              <h3>{editingUnit ? 'Update Unit Details' : 'Create New Unit'}</h3>
              <form onSubmit={handleSubmit} className="form-grid">
                <select value={form.propertyId} onChange={e => setForm(f => ({ ...f, propertyId: e.target.value }))} required>
                  <option value="">Select property</option>
                  {properties.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                </select>
                <input value={form.unitNumber} onChange={e => setForm(f => ({ ...f, unitNumber: e.target.value }))} required placeholder="Unit number" />
                <input type="number" value={form.rentAmount} onChange={e => setForm(f => ({ ...f, rentAmount: e.target.value }))} placeholder="Rent amount" />
                <input value={form.size} onChange={e => setForm(f => ({ ...f, size: e.target.value }))} placeholder="Size / description" />
                <input value={form.agentEmail} onChange={e => setForm(f => ({ ...f, agentEmail: e.target.value }))} placeholder="Agent email" />
                <button type="submit">{editingUnit ? 'Update Unit' : 'Add Unit'}</button>
                {editingUnit && <button type="button" className="secondary-button" onClick={resetForm}>Cancel Edit</button>}
              </form>
              {message && <p className="landlord-success" style={{ marginTop: 16 }}>{message}</p>}
              {error && <p className="landlord-error" style={{ marginTop: 16 }}>{error}</p>}
            </article>

            <article className="card">
              <div className="card-label"><span className="badge badge-agent">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/></svg>
              </span>All Units</div>
              <h3 style={{ marginBottom: 16 }}>Unit Records</h3>

              {loading && <p className="landlord-muted">Loading units...</p>}
              {!loading && units.length === 0 && <p className="landlord-empty">No units added yet. Add your first unit above.</p>}

              {!loading && units.length > 0 && (
                <div className="table-shell">
                  <table className="landlord-table">
                    <thead>
                      <tr>
                        <th>Property</th>
                        <th>Unit</th>
                        <th>Rent</th>
                        <th>Occupancy</th>
                        <th>Agent</th>
                        <th>Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {units.map(unit => (
                        <tr key={unit.id}>
                          <td>{properties.find(p => p.id === unit.property_id)?.name ?? '—'}</td>
                          <td>{unit.unit_number}</td>
                          <td>KSH {unit.rent_amount.toLocaleString()}</td>
                          <td>
                            <span className={`status-pill ${unit.occupancy_status === 'occupied' ? 'status-active' : 'status-pending'}`}>
                              {unit.occupancy_status}
                            </span>
                          </td>
                          <td>{unit.agent_email ?? '—'}</td>
                          <td>
                            <div className="landlord-actions">
                              <button className="action-button primary" onClick={() => handleEdit(unit)}>Edit</button>
                              <button className="action-button danger" onClick={() => handleRemove(unit.id)}>Remove</button>
                            </div>
                          </td>
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