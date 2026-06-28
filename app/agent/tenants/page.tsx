'use client';

import { useEffect, useState } from 'react';
import { supabase } from '../../../lib/supabaseClient';

interface Tenant {
  id: string;
  full_name: string;
  email: string;
  unit: string;
  property: string;
  unit_id?: string;
  lease_start: string;
  lease_end: string;
}

export default function AgentTenantsPage() {
  const [tenants, setTenants] = useState<Tenant[]>([]);
  const [units, setUnits] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [agentPropertyId, setAgentPropertyId] = useState<string | null>(null);
  const [notifLoading, setNotifLoading] = useState<string | null>(null);
  const [agentTenantName, setAgentTenantName] = useState('');
  const [agentTenantEmail, setAgentTenantEmail] = useState('');
  const [agentTenantPhone, setAgentTenantPhone] = useState('');
  const [agentTenantUnit, setAgentTenantUnit] = useState('');
  const [agentLeaseStart, setAgentLeaseStart] = useState('');
  const [agentLeaseEnd, setAgentLeaseEnd] = useState('');
  const [agentDeposit, setAgentDeposit] = useState('');
  const [agentLoading, setAgentLoading] = useState(false);
  const [unitForm, setUnitForm] = useState({ unitNumber: '', rentAmount: '', unitType: '' });
  const [unitLoading, setUnitLoading] = useState(false);

  async function loadData() {
    setLoading(true);
    setError('');
    const storedPropertyId = localStorage.getItem('agentPropertyId');
    setAgentPropertyId(storedPropertyId);

    try {
      const [tenantsResponse, unitsResponse] = await Promise.all([
        fetch(`/api/tenants?propertyId=${storedPropertyId}`),
        fetch(`/api/units?propertyId=${storedPropertyId}`),
      ]);
      const tenantsResult = await tenantsResponse.json();
      const unitsResult = await unitsResponse.json();

      if (tenantsResponse.ok) {
        setTenants(tenantsResult.tenants ?? []);
      }
      if (unitsResponse.ok) {
        setUnits(unitsResult.units?.filter((u: any) => u.property_id === storedPropertyId) ?? []);
      }
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { loadData(); }, []);

  async function handleAddTenant(event: React.FormEvent) {
    event.preventDefault();
    setAgentLoading(true);

    const selectedUnit = units.find(u => u.unit_number === agentTenantUnit);
    const storedPropertyId = localStorage.getItem('agentPropertyId');

    const response = await fetch('/api/tenants', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        fullName: agentTenantName, email: agentTenantEmail, phone: agentTenantPhone,
        unitId: selectedUnit?.id || null, propertyId: storedPropertyId,
        leaseStart: agentLeaseStart, leaseEnd: agentLeaseEnd,
        depositAmount: Number(agentDeposit),
      }),
    });

    const result = await response.json();

    if (!response.ok) {
      setError(result.message ?? 'Unable to add tenant.');
      setAgentLoading(false);
      return;
    }

    setAgentTenantName('');
    setAgentTenantEmail('');
    setAgentTenantPhone('');
    setAgentTenantUnit('');
    setAgentLeaseStart('');
    setAgentLeaseEnd('');
    setAgentDeposit('');
    loadData();
    setAgentLoading(false);
  }

  async function handleSendOverdueNotification(tenantId: string, tenantName: string) {
    setNotifLoading(tenantId);
    setError('');

    const response = await fetch('/api/notifications', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        tenantId,
        propertyId: agentPropertyId,
        recipient: 'tenant',
        type: 'overdue',
        message: `Overdue payment reminder for ${tenantName}`,
      }),
    });

    const result = await response.json();

    if (!response.ok) {
      setError(result.message ?? 'Unable to send notification.');
    }
    setNotifLoading(null);
  }

  async function handleAddUnit(event: React.FormEvent) {
    event.preventDefault();
    setUnitLoading(true);
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
      setUnitLoading(false);
      return;
    }

    setUnitForm({ unitNumber: '', rentAmount: '', unitType: '' });
    loadData();
    setUnitLoading(false);
  }

  return (
    <main className="container admin-no-hero" style={{ padding: '34px 0 80px' }}>
      <div className="card-admin-header">
        <div><p className="heading">Tenant Management</p><p className="subheading">Add tenants and view tenant records for your assigned property.</p></div>
      </div>

      <section className="bento-section">
        <div className="bento">

          <article className="card">
            <div className="card-label">Add Tenant</div>
            <h3>Create New Tenant Record</h3>
            <form onSubmit={handleAddTenant} className="form-grid">
              <input value={agentTenantName} onChange={(event) => setAgentTenantName(event.target.value)} required placeholder="Tenant name" />
              <input type="email" value={agentTenantEmail} onChange={(event) => setAgentTenantEmail(event.target.value)} required placeholder="Tenant email" />
              <input value={agentTenantPhone} onChange={(event) => setAgentTenantPhone(event.target.value)} placeholder="Phone" />
              <select value={agentTenantUnit} onChange={(event) => setAgentTenantUnit(event.target.value)} required>
                <option value="">Select unit</option>
                {units.map(u => (
                  <option key={u.id} value={u.unit_number}>{u.unit_number}</option>
                ))}
              </select>
              <input type="date" value={agentLeaseStart} onChange={(event) => setAgentLeaseStart(event.target.value)} required />
              <input type="date" value={agentLeaseEnd} onChange={(event) => setAgentLeaseEnd(event.target.value)} required />
              <input type="number" value={agentDeposit} onChange={(event) => setAgentDeposit(event.target.value)} placeholder="Deposit" />
              <button type="submit" disabled={agentLoading}>{agentLoading ? 'Adding…' : 'Add Tenant'}</button>
            </form>
            {error && <p className="landlord-error" style={{ marginTop: 16 }}>{error}</p>}
          </article>

          <article className="card">
            <div className="card-label">Create New Unit</div>
            <h3>Add Unit</h3>
            <form onSubmit={handleAddUnit} className="form-grid">
              <input value={unitForm.unitNumber} onChange={(e) => setUnitForm(f => ({ ...f, unitNumber: e.target.value }))} required placeholder="Unit number (e.g., A1)" />
              <input type="number" value={unitForm.rentAmount} onChange={(e) => setUnitForm(f => ({ ...f, rentAmount: e.target.value }))} placeholder="Rent amount (KSH)" />
              <select value={unitForm.unitType} onChange={(e) => setUnitForm(f => ({ ...f, unitType: e.target.value }))}>
                <option value="">Unit Type (optional)</option>
                <option value="single-room">Single Room</option>
                <option value="bedsitter">Bedsitter</option>
                <option value="one-bedroom">One Bedroom</option>
                <option value="two-bedroom">Two Bedroom</option>
                <option value="three-bedroom">Three Bedroom</option>
              </select>
              <button type="submit" disabled={unitLoading}>{unitLoading ? 'Adding…' : 'Add Unit'}</button>
            </form>
          </article>

          <article className="card">
            <div className="card-label">Tenants in My Property</div>
            <h3 style={{ marginBottom: 16 }}>All Tenants</h3>
            {loading && <p className="landlord-muted">Loading tenants...</p>}
            {!loading && tenants.length === 0 && <p className="landlord-empty">No tenants added yet.</p>}
            {!loading && tenants.length > 0 && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                {tenants.map(tenant => (
                  <div key={tenant.id} className="card" style={{ padding: 16, marginBottom: 0, display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12 }}>
                    <div style={{ flex: 1, minWidth: 200 }}>
                      <div style={{ fontWeight: 600 }}>{tenant.full_name}</div>
                      <div style={{ color: 'var(--ink-3)', fontSize: 13 }}>{tenant.email} · Unit {tenant.unit}</div>
                    </div>
                    <button
                      onClick={() => handleSendOverdueNotification(tenant.id, tenant.full_name)}
                      disabled={notifLoading === tenant.id}
                      className="btn btn-ghost"
                      style={{ fontSize: 12, padding: '6px 12px' }}
                    >
                      {notifLoading === tenant.id ? 'Sending…' : 'Send Overdue'}
                    </button>
                  </div>
                ))}
              </div>
            )}
          </article>
        </div>
      </section>
    </main>
  );
}