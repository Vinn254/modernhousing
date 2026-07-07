'use client';

import { useEffect, useRef, useState } from 'react';
import { supabase } from '../../../lib/supabaseClient';

interface Property {
  id: string;
  name: string;
  address: string;
}

interface Agent {
  id: string;
  email: string;
  full_name: string;
  property_name?: string;
  status: string;
  phone?: string | null;
}

export default function AgentsPage() {
  const [agents, setAgents] = useState<Agent[]>([]);
  const [properties, setProperties] = useState<Property[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [form, setForm] = useState({
    agentName: '',
    agentEmail: '',
    agentPassword: '',
    agentPropertyId: '',
    agentPhone: '',
  });
  const [selectedAgent, setSelectedAgent] = useState<Agent | null>(null);
  const formRef = useRef<HTMLDivElement>(null);

  async function getAuthHeaders() {
    const { data } = await supabase.auth.getSession();
    const headers: Record<string, string> = { 'Content-Type': 'application/json' };
    if (data.session?.access_token) headers.Authorization = `Bearer ${data.session.access_token}`;
    return headers;
  }

  async function loadData() {
    setLoading(true);
    setError('');

    try {
      const [agentsResponse, propertiesResponse] = await Promise.all([
        fetch('/api/agents', { headers: await getAuthHeaders() }),
        fetch('/api/properties', { headers: await getAuthHeaders() }),
      ]);

      const agentsResult = await agentsResponse.json();
      const propertiesResult = await propertiesResponse.json();

      if (!agentsResponse.ok) throw new Error(agentsResult.message ?? 'Failed to load agents');
      if (!propertiesResponse.ok) throw new Error(propertiesResult.message ?? 'Failed to load properties');

      setAgents(agentsResult.agents ?? []);
      setProperties(propertiesResult.properties ?? []);
    } catch (err: any) {
      setError(err.message);
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

    const selectedProperty = properties.find(p => p.id === form.agentPropertyId);
    const response = await fetch('/api/agents', {
      method: 'POST',
      headers: await getAuthHeaders(),
      body: JSON.stringify({
        email: form.agentEmail,
        password: form.agentPassword,
        fullName: form.agentName,
        phone: form.agentPhone || undefined,
        propertyId: form.agentPropertyId,
        propertyName: selectedProperty?.name ?? '',
      }),
    });

    const result = await response.json();

    if (!response.ok) {
      setError(result.message ?? 'Unable to add agent.');
      return;
    }

    setMessage('Agent added and assigned successfully.');
    setForm({ agentName: '', agentEmail: '', agentPassword: '', agentPropertyId: '', agentPhone: '' });
    await loadData();
  }

  async function handleRemove(agentId: string) {
    if (!confirm('Remove this agent from active property access?')) return;

    const response = await fetch(`/api/agents?id=${encodeURIComponent(agentId)}`, { method: 'DELETE', headers: await getAuthHeaders() });
    const result = await response.json();

    if (!response.ok) {
      setError(result.message ?? 'Unable to remove agent.');
      return;
    }

    setAgents(agents.map(a => a.id === agentId ? { ...a, status: 'inactive' } : a));
    setMessage('Agent removed from active access.');
  }

  function handleReassign(agent: Agent) {
    setSelectedAgent(agent);
    scrollToForm();
  }

  return (
    <>
      <main className="container admin-no-hero">
        <div className="card-admin-header">
          <div>
            <p className="heading">Agent Management</p>
            <p className="subheading">Assign agents to properties, reassign agents, and remove agents from the system.</p>
          </div>
        </div>

<section className="card-grid">
          <div className="card">
            <div ref={formRef} className="card-label"><span className="badge badge-pm">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13 a4 0 0 1 0 7.75"/></svg>
            </span>Add Agent</div>
            <h3>Assign Agent to Property</h3>
            <form onSubmit={handleSubmit} className="form-grid">
              <input value={form.agentName} onChange={e => setForm(f => ({ ...f, agentName: e.target.value }))} required placeholder="Agent full name" />
              <input type="email" value={form.agentEmail} onChange={e => setForm(f => ({ ...f, agentEmail: e.target.value }))} required placeholder="Agent email" />
              <input type="tel" value={form.agentPhone} onChange={e => setForm(f => ({ ...f, agentPhone: e.target.value }))} placeholder="Phone (optional)" />
              <input type="password" value={form.agentPassword} onChange={e => setForm(f => ({ ...f, agentPassword: e.target.value }))} required placeholder="Password" />
              <select value={form.agentPropertyId} onChange={e => setForm(f => ({ ...f, agentPropertyId: e.target.value }))} required>
                <option value="">Select property</option>
                {properties.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
              </select>
              <button type="submit">Add Agent</button>
            </form>
            {message && <p className="landlord-success" style={{ marginTop: 16 }}>{message}</p>}
            {error && <p className="landlord-error" style={{ marginTop: 16 }}>{error}</p>}
          </div>

          <div className="card">
            <div className="card-label"><span className="badge badge-agent">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13 a4 0 0 1 0 7.75"/></svg>
            </span>Assigned Agents</div>
            <h3 style={{ marginBottom: 16 }}>Agent List</h3>

            {loading && <p className="landlord-muted">Loading agents...</p>}
            {!loading && agents.length === 0 && <p className="landlord-empty">No agents assigned yet.</p>}

            {!loading && agents.length > 0 && (
              <div className="table-shell">
                <table className="landlord-table">
                  <thead>
                    <tr>
                      <th>Name</th>
                      <th>Email</th>
                      <th>Property</th>
                      <th>Status</th>
                      <th>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {agents.map(agent => (
                      <tr key={agent.id}>
                        <td className="landlord-name">{agent.full_name}</td>
                        <td>{agent.email}</td>
                        <td>{agent.property_name || 'Unassigned'}</td>
                        <td>
                          <span className={`status-pill ${agent.status === 'active' ? 'status-active' : 'status-pending'}`}>
                            {agent.status}
                          </span>
                        </td>
                        <td>
                          <div className="landlord-actions">
                            {agent.status === 'active' ? (
                              <>
                                <button className="action-button primary" onClick={() => handleReassign(agent)}>Reassign</button>
                                <button className="action-button danger" onClick={() => handleRemove(agent.id)}>Remove</button>
                              </>
                            ) : (
                              <button className="action-button" onClick={() => handleReassign(agent)}>Reactivate</button>
                            )}
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
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