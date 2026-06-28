'use client';

import { useEffect, useState } from 'react';
import { supabase } from '../../../lib/supabaseClient';

interface Property { id: string; name: string; address: string; }
interface Tenant {
  id: string; full_name: string; email: string; unit: string; property: string; unit_id?: string;
  lease_start: string; lease_end: string;
}

export default function AgentTenantsPage() {
  const [tenants, setTenants] = useState<Tenant[]>([]);
  const [units, setUnits] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [agentTenantName, setAgentTenantName] = useState('');
  const [agentTenantEmail, setAgentTenantEmail] = useState('');
  const [agentTenantPhone, setAgentTenantPhone] = useState('');
  const [agentTenantUnit, setAgentTenantUnit] = useState('');
  const [agentLeaseStart, setAgentLeaseStart] = useState('');
  const [agentLeaseEnd, setAgentLeaseEnd] = useState('');
  const [agentDeposit, setAgentDeposit] = useState('');
  const [agentLoading, setAgentLoading] = useState(false);

  async function loadData() {
    setLoading(true);
    setError('');

    try {
      const storedPropertyId = localStorage.getItem('agentPropertyId');
      const [tenantsResponse, unitsResponse] = await Promise.all([
        fetch('/api/tenants'),
        fetch('/api/units'),
      ]);
      const tenantsResult = await tenantsResponse.json();
      const unitsResult = await unitsResponse.json();

      if (tenantsResponse.ok) {
        if (storedPropertyId) {
          setTenants(tenantsResult.tenants.filter((t: any) => (t.property_id || t.units?.property_id) === storedPropertyId));
        } else {
          setTenants(tenantsResult.tenants ?? []);
        }
      }
      if (unitsResponse.ok) setUnits(unitsResult.units ?? []);
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
        unitId: selectedUnit?.id || agentTenantUnit, propertyId: storedPropertyId,
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

    setAgentTenantName(''); setAgentTenantEmail(''); setAgentTenantPhone('');
    setAgentTenantUnit(''); setAgentLeaseStart(''); setAgentLeaseEnd(''); setAgentDeposit('');
    loadData();
    setAgentLoading(false);
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
                {units.filter(u => u.occupancy_status === 'vacant').map(u => (
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
            <div className="card-label">Tenant Records</div>
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