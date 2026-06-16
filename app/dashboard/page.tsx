'use client';

import { useEffect, useState } from 'react';
import { supabase } from '../../lib/supabaseClient';

interface DashboardStats {
  properties: number;
  agents: number;
  tenants: number;
  total_payments: number;
  total_balance: number;
  tenants_with_analytics: Array<{ id: string; payment_count: number; due_date: string }>;
}

interface Tenant {
  id: string;
  full_name: string;
  email: string;
  unit: string;
  property: string;
  lease_start: string;
  lease_end: string;
}

interface Payment {
  id: string;
  tenant: string;
  tenant_email: string;
  property: string;
  amount: number;
  balance_remaining: number;
  created_at: string;
}

interface Agent {
  id: string;
  full_name: string;
  email: string;
  status: string;
  property_name: string;
}

interface Property {
  id: string;
  name: string;
  address: string;
}

interface Notification {
  id: string;
  tenant: string;
  tenant_email: string;
  message: string;
  status: string;
  created_at: string;
}

interface Comment {
  id: string;
  tenant: string;
  tenant_email: string;
  message: string;
  status: string;
  created_at: string;
}

export default function DashboardPage() {
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [tenants, setTenants] = useState<Tenant[]>([]);
  const [payments, setPayments] = useState<Payment[]>([]);
  const [agents, setAgents] = useState<Agent[]>([]);
  const [properties, setProperties] = useState<Property[]>([]);
  const [agentEmail, setAgentEmail] = useState('');
  const [agentPassword, setAgentPassword] = useState('');
  const [agentName, setAgentName] = useState('');
  const [agentPropertyId, setAgentPropertyId] = useState('');
  const [propertyName, setPropertyName] = useState('');
  const [propertyAddress, setPropertyAddress] = useState('');
  const [propertySize, setPropertySize] = useState('');
  const [selectedPropertyId, setSelectedPropertyId] = useState('');
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [comments, setComments] = useState<Comment[]>([]);
  const [notificationTenantId, setNotificationTenantId] = useState('');
  const [notificationMessage, setNotificationMessage] = useState('');
  const [agentTenantName, setAgentTenantName] = useState('');
  const [agentTenantEmail, setAgentTenantEmail] = useState('');
  const [agentTenantPhone, setAgentTenantPhone] = useState('');
  const [agentTenantUnit, setAgentTenantUnit] = useState('');
  const [agentLeaseStart, setAgentLeaseStart] = useState('');
  const [agentLeaseEnd, setAgentLeaseEnd] = useState('');
  const [agentDeposit, setAgentDeposit] = useState('');
  const [propertyLoading, setPropertyLoading] = useState(false);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const [agentLoading, setAgentLoading] = useState(false);
  const [error, setError] = useState('');
  const [landlordId, setLandlordId] = useState('');
  const [userRole, setUserRole] = useState('');
  const [roleLoaded, setRoleLoaded] = useState(false);
  const [message, setMessage] = useState('');
  const [assignedPropertyParam, setAssignedPropertyParam] = useState('');

  async function loadDashboard(refresh = false) {
    if (refresh) setRefreshing(true); else setLoading(true);
    setError('');

    try {
      const [statsResponse, tenantsResponse, paymentsResponse, agentsResponse, propertiesResponse] = await Promise.all([
        fetch('/api/dashboard' + (selectedPropertyId ? `?propertyId=${encodeURIComponent(selectedPropertyId)}` : '')),
        fetch('/api/tenants'),
        fetch('/api/payments'),
        fetch('/api/agents'),
        fetch('/api/properties'),
      ]);

      const statsResult = await statsResponse.json();
      const tenantsResult = await tenantsResponse.json();
      const paymentsResult = await paymentsResponse.json();
      const agentsResult = await agentsResponse.json();
      const propertiesResult = await propertiesResponse.json();

      if (!statsResponse.ok) throw new Error(statsResult.message ?? 'Unable to load dashboard analytics.');
      if (!tenantsResponse.ok) throw new Error(tenantsResult.message ?? 'Unable to load tenants.');
      if (!paymentsResponse.ok) throw new Error(paymentsResult.message ?? 'Unable to load payments.');
      if (!agentsResponse.ok) throw new Error(agentsResult.message ?? 'Unable to load agents.');
      if (!propertiesResponse.ok) throw new Error(propertiesResult.message ?? 'Unable to load properties.');

      setStats(statsResult);
      setTenants(tenantsResult.tenants ?? []);
      setPayments(paymentsResult.payments ?? []);
      setAgents(agentsResult.agents ?? []);
      setProperties(propertiesResult.properties ?? []);

      if (userRole === 'agent') {
        const assignedProperty = selectedPropertyId || assignedPropertyParam || localStorage.getItem('agentPropertyId') || '';
        const [notificationsResponse, commentsResponse] = await Promise.all([
          fetch(`/api/notifications?propertyId=${encodeURIComponent(assignedProperty)}`),
          fetch(`/api/comments?propertyId=${encodeURIComponent(assignedProperty)}`),
        ]);
        const notificationsResult = await notificationsResponse.json();
        const commentsResult = await commentsResponse.json();
        if (notificationsResponse.ok) setNotifications(notificationsResult.notifications ?? []);
        if (commentsResponse.ok) setComments(commentsResult.comments ?? []);
      }
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLastUpdated(new Date());
      if (refresh) setRefreshing(false); else setLoading(false);
    }
  }

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      if (data.user) {
        setLandlordId(data.user.id);
        setUserRole(data.user.user_metadata?.role || '');
      }
      setRoleLoaded(true);
    });
  }, []);

  useEffect(() => {
    const assignedProperty = new URLSearchParams(window.location.search).get('property') || localStorage.getItem('agentPropertyId') || '';
    setAssignedPropertyParam(assignedProperty);
    if (assignedProperty) setSelectedPropertyId(assignedProperty);
  }, []);

  useEffect(() => {
    if (roleLoaded) loadDashboard();
    const interval = window.setInterval(() => loadDashboard(true), 15000);
    return () => window.clearInterval(interval);
  }, [roleLoaded, selectedPropertyId, userRole]);

  async function handleAddProperty(event: React.FormEvent) {
    event.preventDefault();
    setMessage('');
    setError('');
    setPropertyLoading(true);

    const response = await fetch('/api/properties', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: propertyName, address: propertyAddress, size: propertySize }),
    });

    const result = await response.json();

    if (!response.ok) {
      setError(result.message ?? 'Unable to add property.');
      setPropertyLoading(false);
      return;
    }

    setProperties((current) => [result.property, ...current]);
    setPropertyName('');
    setPropertyAddress('');
    setPropertySize('');
    setMessage('Property added successfully. You can now assign an agent to it.');
    setPropertyLoading(false);
  }

  async function handleAddAgent(event: React.FormEvent) {
    event.preventDefault();
    setMessage('');
    setError('');
    setAgentLoading(true);

    const selectedProperty = properties.find((property) => property.id === agentPropertyId);
    const response = await fetch('/api/agents', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: agentEmail, password: agentPassword, fullName: agentName, propertyId: agentPropertyId, propertyName: selectedProperty?.name ?? '', landlordId }),
    });

    const result = await response.json();

    if (!response.ok) {
      setError(result.message ?? 'Unable to add agent.');
      setAgentLoading(false);
      return;
    }

    setAgents((current) => [result.agent, ...current]);
    setAgentEmail('');
    setAgentPassword('');
    setAgentName('');
    setAgentPropertyId('');
    setMessage('Agent added and assigned successfully.');
    setAgentLoading(false);
  }

  async function handleRemoveAgent(agentId: string) {
    if (!confirm('Remove this agent from active property access?')) return;

    const response = await fetch(`/api/agents?id=${encodeURIComponent(agentId)}`, { method: 'DELETE' });
    const result = await response.json();

    if (!response.ok) {
      setError(result.message ?? 'Unable to remove agent.');
      return;
    }

    setAgents((current) => current.map((agent) => (agent.id === agentId ? { ...agent, status: 'inactive' } : agent)));
    setMessage('Agent removed from active access.');
  }

  async function handleAgentTenantCreate(event: React.FormEvent) {
    event.preventDefault();
    setMessage('');
    setError('');
    setAgentLoading(true);

    const response = await fetch('/api/tenants', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ propertyId: selectedPropertyId, fullName: agentTenantName, email: agentTenantEmail, phone: agentTenantPhone, unitId: agentTenantUnit, leaseStart: agentLeaseStart, leaseEnd: agentLeaseEnd, depositAmount: Number(agentDeposit) }),
    });

    const result = await response.json();

    if (!response.ok) {
      setError(result.message ?? 'Unable to add tenant.');
      setAgentLoading(false);
      return;
    }

    setTenants((current) => [result.tenant, ...current]);
    setAgentTenantName('');
    setAgentTenantEmail('');
    setAgentTenantPhone('');
    setAgentTenantUnit('');
    setAgentLeaseStart('');
    setAgentLeaseEnd('');
    setAgentDeposit('');
    setMessage('Tenant added successfully.');
    await loadDashboard(true);
    setAgentLoading(false);
  }

  async function handleAgentTenantRemove(tenantId: string) {
    if (!confirm('Remove this tenant because they relocated?')) return;

    const response = await fetch(`/api/tenants?id=${encodeURIComponent(tenantId)}`, { method: 'DELETE' });
    const result = await response.json();

    if (!response.ok) {
      setError(result.message ?? 'Unable to remove tenant.');
      return;
    }

    setTenants((current) => current.filter((tenant) => tenant.id !== tenantId));
    setMessage('Tenant removed because they relocated.');
    await loadDashboard(true);
  }

  async function handleSendNotification(event: React.FormEvent) {
    event.preventDefault();
    if (!selectedPropertyId) {
      setError('Agent property is not assigned.');
      return;
    }

    setError('');
    const response = await fetch('/api/notifications', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ tenantId: notificationTenantId, propertyId: selectedPropertyId, message: notificationMessage }),
    });

    const result = await response.json();

    if (!response.ok) {
      setError(result.message ?? 'Unable to send notification.');
      return;
    }

    setMessage('Overdue notification sent.');
    setNotificationTenantId('');
    setNotificationMessage('');
  }

  const formatCurrency = (value: number) => new Intl.NumberFormat('en-KE', { style: 'currency', currency: 'KES' }).format(value);
  const isAgent = roleLoaded && userRole === 'agent';

  return (
    <main className="container" style={{ padding: '34px 0 80px' }}>
      <div className="card-admin-header">
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 16 }}>
          <div>
            <p className="heading">{isAgent ? 'Agent Dashboard' : 'Landlord Dashboard'}</p>
            <p className="subheading">Overview of properties, agents, tenants, payments, balances, and due dates.</p>
          </div>
          <button type="button" className="btn btn-ghost" style={{ color: '#fff', border: '1px solid rgba(255,255,255,0.2)', background: 'rgba(255,255,255,0.08)' }} onClick={() => loadDashboard(true)} disabled={refreshing}>{refreshing ? 'Refreshing…' : 'Refresh'}</button>
        </div>
      </div>

      {loading && <p style={{ color: 'var(--ink-3)' }}>Loading dashboard…</p>}
      {!loading && lastUpdated && <p style={{ color: 'var(--ink-3)', fontSize: '13px', marginBottom: 16 }}>Last updated: {lastUpdated.toLocaleTimeString()}</p>}
      {error && <p style={{ color: '#dc2626' }}>{error}</p>}
      {message && <p style={{ color: 'var(--accent)' }}>{message}</p>}

      {isAgent && (
        <section style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 18, marginTop: 24 }}>
          <div className="card">
            <div className="card-label">Agent Tenant Management</div>
            <h3 style={{ marginBottom: 16 }}>Add Tenant</h3>
            <form onSubmit={handleAgentTenantCreate} className="form-grid">
              <input value={agentTenantName} onChange={(event) => setAgentTenantName(event.target.value)} required placeholder="Tenant name" />
              <input type="email" value={agentTenantEmail} onChange={(event) => setAgentTenantEmail(event.target.value)} required placeholder="Tenant email" />
              <input value={agentTenantPhone} onChange={(event) => setAgentTenantPhone(event.target.value)} placeholder="Phone" />
              <input value={agentTenantUnit} onChange={(event) => setAgentTenantUnit(event.target.value)} required placeholder="Unit name / number" />
              <input type="date" value={agentLeaseStart} onChange={(event) => setAgentLeaseStart(event.target.value)} required />
              <input type="date" value={agentLeaseEnd} onChange={(event) => setAgentLeaseEnd(event.target.value)} required />
              <input type="number" value={agentDeposit} onChange={(event) => setAgentDeposit(event.target.value)} placeholder="Deposit" />
              <button type="submit" disabled={agentLoading}>{agentLoading ? 'Adding…' : 'Add Tenant'}</button>
            </form>

            <h3 style={{ marginTop: 24, marginBottom: 12 }}>Tenants in My Property</h3>
            {tenants.map((tenant) => (
              <div key={tenant.id} style={{ display: 'grid', gridTemplateColumns: '1fr auto', gap: 12, alignItems: 'center', padding: '12px 0', borderBottom: '1px solid var(--line-soft)' }}>
                <div>
                  <strong>{tenant.full_name}</strong>
                  <div style={{ color: 'var(--ink-3)', fontSize: '13px' }}>{tenant.property} · Unit {tenant.unit}</div>
                </div>
                <button className="btn btn-ghost" style={{ fontSize: '12px', padding: '6px 12px', background: 'rgba(220,38,38,0.1)', color: '#7f1212' }} onClick={() => handleAgentTenantRemove(tenant.id)}>Mark Relocated</button>
              </div>
            ))}
          </div>

          <div className="card">
            <div className="card-label">Overdue Notifications</div>
            <h3 style={{ marginBottom: 16 }}>Send Notice</h3>
            <form onSubmit={handleSendNotification} className="form-grid">
              <select value={notificationTenantId} onChange={(event) => setNotificationTenantId(event.target.value)} required>
                <option value="">Select tenant</option>
                {tenants.map((tenant) => <option key={tenant.id} value={tenant.id}>{tenant.full_name} — Unit {tenant.unit}</option>)}
              </select>
              <textarea value={notificationMessage} onChange={(event) => setNotificationMessage(event.target.value)} required placeholder="Overdue rent reminder..." style={{ gridColumn: 'span 2', minHeight: 90, padding: 12, borderRadius: 10, border: '1px solid var(--line)', background: 'var(--surface)' }} />
              <button type="submit" style={{ gridColumn: 'span 2' }}>Send Notification</button>
            </form>

            <h3 style={{ marginTop: 24, marginBottom: 12 }}>Tenant Complaints</h3>
            {comments.length === 0 ? <p style={{ color: 'var(--ink-3)' }}>No complaints yet.</p> : comments.map((comment) => (
              <div key={comment.id} style={{ padding: '12px 0', borderBottom: '1px solid var(--line-soft)' }}>
                <strong>{comment.tenant}</strong>
                <div style={{ color: 'var(--ink-3)', fontSize: '13px' }}>{comment.message}</div>
                <span style={{ display: 'inline-block', marginTop: 6, padding: '3px 9px', borderRadius: '999px', fontSize: '11px', fontWeight: 700, background: comment.status === 'open' ? 'rgba(245,158,11,0.12)' : 'rgba(16,185,129,0.12)', color: comment.status === 'open' ? 'var(--amber)' : 'var(--accent)' }}>{comment.status}</span>
              </div>
            ))}
          </div>
        </section>
      )}

      {stats && (
        <>
          <section className="bento-section" style={{ marginTop: 0, padding: 0 }}>
            <div className="bento">
              <article className="card" style={{ gridColumn: 'span 3' }}><div className="card-label">Properties</div><h3 style={{ fontSize: '34px', margin: 0 }}>{stats.properties}</h3><p>Total properties in your portfolio.</p></article>
              {!isAgent && <article className="card" style={{ gridColumn: 'span 3' }}><div className="card-label">Agents</div><h3 style={{ fontSize: '34px', margin: 0 }}>{stats.agents}</h3><p>Agents assigned to properties.</p></article>}
              <article className="card" style={{ gridColumn: 'span 3' }}><div className="card-label">Tenants</div><h3 style={{ fontSize: '34px', margin: 0 }}>{stats.tenants}</h3><p>Active tenant records.</p></article>
              {!isAgent && <article className="card" style={{ gridColumn: 'span 3' }}><div className="card-label">Collections</div><h3 style={{ fontSize: '34px', margin: 0 }}>{formatCurrency(stats.total_payments)}</h3><p>Total payments recorded.</p></article>}
              {!isAgent && <article className="card" style={{ gridColumn: 'span 6' }}><div className="card-label">Outstanding Balance</div><h3 style={{ fontSize: '34px', margin: 0 }}>{formatCurrency(stats.total_balance)}</h3><p>Current balance remaining across tenant accounts.</p></article>}
              <article className="card" style={{ gridColumn: 'span 6' }}><div className="card-label">Due Dates</div><h3 style={{ fontSize: '34px', margin: 0 }}>{stats.tenants_with_analytics.length}</h3><p>Tenants with payment/start-date based due dates.</p></article>
            </div>
          </section>

          {!isAgent && (
            <section style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 18, marginTop: 24 }}>
              <div className="card">
                <div className="card-label">Properties and Agents</div>
                <h3 style={{ marginBottom: 16 }}>Add Property</h3>
                <form onSubmit={handleAddProperty} className="dashboard-agent-form" style={{ marginBottom: 24 }}>
                  <input value={propertyName} onChange={(event) => setPropertyName(event.target.value)} required placeholder="Property name" />
                  <input value={propertyAddress} onChange={(event) => setPropertyAddress(event.target.value)} required placeholder="Property address" />
                  <input value={propertySize} onChange={(event) => setPropertySize(event.target.value)} placeholder="Size / units" />
                  <button type="submit" disabled={propertyLoading}>{propertyLoading ? 'Adding…' : 'Add Property'}</button>
                </form>

                <h3 style={{ marginBottom: 16 }}>Add Agent</h3>
                {properties.length === 0 ? <p style={{ padding: '12px', borderRadius: '10px', background: 'rgba(245,158,11,0.1)', color: '#92400e', marginBottom: 16 }}>Add a property first, then assign an agent to that property.</p> : null}
                <form onSubmit={handleAddAgent} className="dashboard-agent-form" style={{ gap: 12 }}>
                  <input value={agentName} onChange={(event) => setAgentName(event.target.value)} required placeholder="Agent full name" />
                  <input type="email" value={agentEmail} onChange={(event) => setAgentEmail(event.target.value)} required placeholder="Agent email" />
                  <input type="password" value={agentPassword} onChange={(event) => setAgentPassword(event.target.value)} required placeholder="Password" />
                  <select value={agentPropertyId} onChange={(event) => setAgentPropertyId(event.target.value)} required>
                    <option value="">Select property</option>
                    {properties.map((property) => <option key={property.id} value={property.id}>{property.name}</option>)}
                  </select>
                  <button type="submit" disabled={agentLoading}>{agentLoading ? 'Adding…' : 'Add Agent'}</button>
                </form>

                <h3 style={{ marginTop: 24, marginBottom: 12 }}>Assigned Agents</h3>
                {agents.length === 0 ? <p style={{ color: 'var(--ink-3)' }}>No agents assigned yet.</p> : agents.map((agent) => (
                  <div key={agent.id} style={{ display: 'grid', gridTemplateColumns: '1fr auto', gap: 12, alignItems: 'center', padding: '12px 0', borderBottom: '1px solid var(--line-soft)' }}>
                    <div>
                      <strong>{agent.full_name}</strong>
                      <div style={{ color: 'var(--ink-3)', fontSize: '13px' }}>{agent.email}</div>
                      <div style={{ color: 'var(--ink-3)', fontSize: '13px' }}>{agent.property_name || 'Unassigned'} · {agent.status}</div>
                    </div>
                    <button className="btn btn-ghost" style={{ fontSize: '12px', padding: '6px 12px', background: agent.status === 'active' ? 'rgba(220,38,38,0.1)' : 'rgba(16,185,129,0.1)', color: agent.status === 'active' ? '#7f1212' : 'var(--accent)' }} onClick={() => handleRemoveAgent(agent.id)} disabled={agent.status !== 'active'}>{agent.status === 'active' ? 'Remove' : 'Removed'}</button>
                  </div>
                ))}
              </div>

              <div className="card">
                <div className="card-label">Portfolio</div>
                <h3 style={{ marginBottom: 16 }}>Properties</h3>
                {properties.length === 0 ? <p style={{ color: 'var(--ink-3)' }}>No properties added yet.</p> : properties.map((property) => (
                  <div key={property.id} style={{ padding: '12px 0', borderBottom: '1px solid var(--line-soft)' }}>
                    <strong>{property.name}</strong>
                    <div style={{ color: 'var(--ink-3)', fontSize: '13px' }}>{property.address}</div>
                  </div>
                ))}

                <h3 style={{ marginTop: 24, marginBottom: 16 }}>Recent Payments</h3>
                {payments.length === 0 ? <p style={{ color: 'var(--ink-3)' }}>No payments recorded yet.</p> : payments.slice(0, 6).map((payment) => (
                  <div key={payment.id} style={{ padding: '12px 0', borderBottom: '1px solid var(--line-soft)' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                      <strong>{payment.tenant}</strong>
                      <span style={{ color: payment.balance_remaining > 0 ? '#dc2626' : 'var(--accent)', fontWeight: 700 }}>{formatCurrency(payment.balance_remaining)}</span>
                    </div>
                    <div style={{ color: 'var(--ink-3)', fontSize: '13px' }}>{payment.property} · {payment.created_at ? new Date(payment.created_at).toLocaleDateString() : ''}</div>
                  </div>
                ))}
              </div>
            </section>
          )}
        </>
      )}
    </main>
  );
}
