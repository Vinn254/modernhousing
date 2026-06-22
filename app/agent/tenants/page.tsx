'use client';

import { useEffect, useState } from 'react';
import { supabase } from '../../../lib/supabaseClient';

interface Property { id: string; name: string; address: string; }
interface Tenant {
  id: string; full_name: string; email: string; unit: string; property: string;
  lease_start: string; lease_end: string;
}

export default function AgentTenantsPage() {
  const [tenants, setTenants] = useState<Tenant[]>([]);
  const [properties, setProperties] = useState<Property[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [agentTenantName, setAgentTenantName] = useState('');
  const [agentTenantEmail, setAgentTenantEmail] = useState('');
  const [agentTenantPhone, setAgentTenantPhone] = useState('');
  const [selectedPropertyId, setSelectedPropertyId] = useState('');
  const [agentTenantUnit, setAgentTenantUnit] = useState('');
  const [agentLeaseStart, setAgentLeaseStart] = useState('');
  const [agentLeaseEnd, setAgentLeaseEnd] = useState('');
  const [agentDeposit, setAgentDeposit] = useState('');
  const [agentLoading, setAgentLoading] = useState(false);

  async function loadData() {
    setLoading(true);
    try {
      const [propertiesResponse, tenantsResponse] = await Promise.all([
        fetch('/api/properties'),
        fetch('/api/tenants'),
      ]);
      const propertiesResult = await propertiesResponse.json();
      const tenantsResult = await tenantsResponse.json();
      if (propertiesResponse.ok) setProperties(propertiesResult.properties ?? []);

      const storedPropertyId = localStorage.getItem('agentPropertyId');
      if (storedPropertyId && tenantsResult.tenants) {
        setTenants(tenantsResult.tenants.filter((t: any) => t.property_id === storedPropertyId));
      } else {
        setTenants(tenantsResult.tenants ?? []);
      }

      if (storedPropertyId) setSelectedPropertyId(storedPropertyId);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadData();
  }, []);

  async function handleAddTenant(event: React.FormEvent) {
    event.preventDefault();
    setAgentLoading(true);

    const response = await fetch('/api/tenants', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        fullName: agentTenantName, email: agentTenantEmail, phone: agentTenantPhone,
        unitId: agentTenantUnit, propertyId: selectedPropertyId,
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
              <select value={selectedPropertyId} onChange={(event) => setSelectedPropertyId(event.target.value)} required>
                <option value="">Select property</option>
                {properties.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
              </select>
              <input value={agentTenantUnit} onChange={(event) => setAgentTenantUnit(event.target.value)} required placeholder="Unit name / number" />
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
                <table className="landlord-table">
                  <thead><tr><th>Name</th><th>Property</th><th>Unit</th><th>Lease</th></tr></thead>
                  <tbody>
                    {tenants.map(tenant => (
                      <tr key={tenant.id}>
                        <td className="landlord-name">{tenant.full_name}</td>
                        <td>{tenant.property}</td>
                        <td>{tenant.unit}</td>
                        <td>{tenant.lease_start} → {tenant.lease_end}</td>
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