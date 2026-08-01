'use client';
import { useEffect, useState } from 'react';
import { supabase } from '../../lib/supabaseClient';
async function getAuthHeaders() {
    const { data } = await supabase.auth.getSession();
    const headers = { 'Content-Type': 'application/json' };
    if (data.session?.access_token)
        headers.Authorization = `Bearer ${data.session.access_token}`;
    return headers;
}
export default function TenantsPage() {
    const [tenants, setTenants] = useState([]);
    const [properties, setProperties] = useState([]);
    const [fullName, setFullName] = useState('');
    const [email, setEmail] = useState('');
    const [phone, setPhone] = useState('');
    const [propertyId, setPropertyId] = useState('');
    const [unitId, setUnitId] = useState('');
    const [leaseStart, setLeaseStart] = useState('');
    const [leaseEnd, setLeaseEnd] = useState('');
    const [depositAmount, setDepositAmount] = useState('');
    const [message, setMessage] = useState('');
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(true);
    async function loadTenants() {
        const response = await fetch('/api/tenants', {
            headers: { 'Content-Type': 'application/json' },
        });
        const result = await response.json();
        if (!response.ok) {
            setError(result.message ?? 'Unable to load tenants.');
            setLoading(false);
            return;
        }
        setTenants(result.tenants ?? []);
        setLoading(false);
    }
    async function loadProperties() {
        const response = await fetch('/api/properties');
        const result = await response.json();
        if (response.ok)
            setProperties(result.properties ?? []);
    }
    useEffect(() => {
        Promise.all([loadTenants(), loadProperties()]);
    }, []);
    async function handleCreate(event) {
        event.preventDefault();
        setMessage('');
        setError('');
        const response = await fetch('/api/tenants', {
            method: 'POST',
            headers: await getAuthHeaders(),
            body: JSON.stringify({ fullName, email, phone, propertyId, unitId, leaseStart, leaseEnd, depositAmount: Number(depositAmount) }),
        });
        const result = await response.json();
        if (!response.ok) {
            setError(result.message || 'Unable to create tenant.');
            return;
        }
        setMessage('Tenant created successfully.');
        setFullName('');
        setEmail('');
        setPhone('');
        setPropertyId('');
        setUnitId('');
        setLeaseStart('');
        setLeaseEnd('');
        setDepositAmount('');
        await loadTenants();
    }
    async function handleRemove(tenantId) {
        if (!confirm('Mark this tenant as relocated and remove the active record?'))
            return;
        const response = await fetch(`/api/tenants?id=${encodeURIComponent(tenantId)}`, {
            method: 'DELETE',
            headers: await getAuthHeaders(),
        });
        const result = await response.json();
        if (!response.ok) {
            setError(result.message || 'Unable to remove tenant.');
            return;
        }
        setMessage('Tenant removed because they relocated.');
        await loadTenants();
    }
    return (<main className="container">
      <div className="card-admin-header">
        <p className="heading">Tenants</p>
        <p className="subheading">Create tenant records, assign units, and manage active leases.</p>
      </div>

      {message && <p style={{ color: 'var(--accent)', fontWeight: 700, marginBottom: 16 }}>{message}</p>}
      {error && <p style={{ color: '#dc2626', fontWeight: 700, marginBottom: 16 }}>{error}</p>}

      <section className="tenant-page-grid" style={{ display: 'grid', gridTemplateColumns: 'minmax(320px, 420px) 1fr', gap: 20, alignItems: 'start' }}>
        <div className="card">
          <div className="card-label">Tenant Setup</div>
          <h3 style={{ marginBottom: 16 }}>Add Tenant</h3>
          <form onSubmit={handleCreate} className="form-grid">
            <input value={fullName} onChange={(event) => setFullName(event.target.value)} required placeholder="Tenant full name"/>
            <input type="email" value={email} onChange={(event) => setEmail(event.target.value)} required placeholder="Tenant email"/>
            <input value={phone} onChange={(event) => setPhone(event.target.value)} placeholder="Phone"/>
            <select value={propertyId} onChange={(event) => setPropertyId(event.target.value)} required>
              <option value="">Select property</option>
              {properties.map((property) => <option key={property.id} value={property.id}>{property.name}</option>)}
            </select>
            <input value={unitId} onChange={(event) => setUnitId(event.target.value)} required placeholder="Unit name / number"/>
            <input type="date" value={leaseStart} onChange={(event) => setLeaseStart(event.target.value)} required/>
            <input type="date" value={leaseEnd} onChange={(event) => setLeaseEnd(event.target.value)} required/>
            <input type="number" value={depositAmount} onChange={(event) => setDepositAmount(event.target.value)} placeholder="Deposit"/>
            <button type="submit" style={{ gridColumn: 'span 2' }}>Add Tenant</button>
          </form>
        </div>

        <div className="card">
          <div className="card-label">Tenant Records</div>
          <h3 style={{ marginBottom: 16 }}>All Tenants</h3>
          {loading ? <p style={{ color: 'var(--ink-3)' }}>Loading tenants…</p> : tenants.length === 0 ? (<p style={{ color: 'var(--ink-3)' }}>No tenants found.</p>) : (<div className="table-shell">
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '14px' }}>
                <thead>
                  <tr style={{ borderBottom: '1px solid var(--line)' }}>
                    <th style={{ textAlign: 'left', padding: '12px', fontWeight: 700 }}>Tenant</th>
                    <th style={{ textAlign: 'left', padding: '12px', fontWeight: 700 }}>Unit</th>
                    <th style={{ textAlign: 'left', padding: '12px', fontWeight: 700 }}>Lease</th>
                    <th style={{ textAlign: 'left', padding: '12px', fontWeight: 700 }}>Deposit</th>
                    <th style={{ textAlign: 'left', padding: '12px', fontWeight: 700 }}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {tenants.map((tenant) => (<tr key={tenant.id} style={{ borderBottom: '1px solid var(--line-soft)' }}>
                      <td style={{ padding: '14px 12px' }}>
                        <strong>{tenant.full_name}</strong>
                        <div style={{ color: 'var(--ink-3)', fontSize: '13px' }}>{tenant.email}</div>
                        <div style={{ color: 'var(--ink-3)', fontSize: '13px' }}>{tenant.property}</div>
                      </td>
                      <td style={{ padding: '14px 12px', color: 'var(--ink-3)' }}>{tenant.unit}</td>
                      <td style={{ padding: '14px 12px', color: 'var(--ink-3)' }}>{tenant.lease_start} → {tenant.lease_end}</td>
                      <td style={{ padding: '14px 12px', color: 'var(--ink-3)' }}>{tenant.deposit_amount}</td>
                      <td style={{ padding: '14px 12px' }}>
                        <button className="btn btn-ghost" style={{ fontSize: '12px', padding: '6px 12px', background: 'rgba(220,38,38,0.1)', color: '#7f1212' }} onClick={() => handleRemove(tenant.id)}>Mark Relocated</button>
                      </td>
                    </tr>))}
                </tbody>
              </table>
            </div>)}
        </div>
      </section>
    </main>);
}
