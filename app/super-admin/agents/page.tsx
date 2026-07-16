'use client';

import { useEffect, useState } from 'react';

interface Agent {
  id: string;
  name: string;
  email: string;
  property_name: string;
  property_id: string;
  status: string;
  landlord: string;
  landlord_email: string;
  created_at: string;
}

export default function SuperAdminAgentsPage() {
  const [agents, setAgents] = useState<Agent[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [selectedAgent, setSelectedAgent] = useState<Agent | null>(null);

  async function loadAgents() {
    const response = await fetch('/api/admin/agents');
    const result = await response.json();

    if (!response.ok) {
      setError(result.message ?? 'Unable to load agents.');
      setLoading(false);
      return;
    }

    setAgents(result.agents ?? []);
    setLoading(false);
  }

  useEffect(() => {
    loadAgents();
  }, []);

  return (
    <>
      <main className="container admin-no-hero">
        <div className="card-admin-header">
          <div>
            <p className="heading">Agents</p>
            <p className="subheading">Manage all property agents, their assignments, landlords, and active status.</p>
          </div>
        </div>

        <section className="bento-section">
          <div className="bento">
            <article className="card">
              <div className="card-label"><span className="badge badge-agent"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13 a4 0 0 1 0 7.75"/></svg></span>Agent Management</div>
              <h3 style={{ marginBottom: 16 }}>All Agents</h3>

              {loading && <p style={{ color: 'var(--ink-3)' }}>Loading agents…</p>}
              {error && <p className="landlord-error">{error}</p>}

              {!loading && agents.length === 0 && <p className="landlord-empty">No agents found.</p>}

              {!loading && agents.length > 0 && (
                <div className="table-shell">
                  <table className="landlord-table">
                    <thead>
                      <tr>
                        <th>Agent</th>
                        <th>Assigned Property</th>
                        <th>Landlord</th>
                        <th>Status</th>
                        <th>Created</th>
                        <th>Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {agents.map((agent) => (
                        <tr key={agent.id}>
                          <td>
                            <strong>{agent.name}</strong>
                            <div style={{ color: 'var(--ink-3)', fontSize: '13px' }}>{agent.email}</div>
                          </td>
                          <td>{agent.property_name || 'Unassigned'}</td>
                          <td>
                            <strong>{agent.landlord}</strong>
                            <div style={{ color: 'var(--ink-3)', fontSize: '13px' }}>{agent.landlord_email}</div>
                          </td>
                          <td>
                            <span className={`status-pill ${agent.status === 'active' ? 'status-active' : 'status-pending'}`}>{agent.status}</span>
                          </td>
                          <td>{agent.created_at ? new Date(agent.created_at).toLocaleDateString() : '—'}</td>
                          <td>
                            <button className="action-button secondary" style={{ padding: '6px 12px', fontSize: '12px' }} onClick={() => setSelectedAgent(agent)}>View</button>
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

      {selectedAgent && (
        <div className="modal-overlay" onClick={(event) => event.target === event.currentTarget && setSelectedAgent(null)}>
          <div className="modal-card" style={{ maxWidth: 760, width: '95%' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
              <h3 style={{ margin: 0 }}>Agent: {selectedAgent.name}</h3>
              <button className="action-button ghost" onClick={() => setSelectedAgent(null)} style={{ fontSize: 18, padding: '4px 8px' }}>✕</button>
            </div>
            <div className="detail-grid">
              <div className="detail-card">
                <div className="card-label">Assigned Property</div>
                <strong>{selectedAgent.property_name || 'Unassigned'}</strong>
                <div style={{ color: 'var(--ink-3)', fontSize: '13px' }}>Property ID: {selectedAgent.property_id || '—'}</div>
              </div>
              <div className="detail-card">
                <div className="card-label">Landlord</div>
                <strong>{selectedAgent.landlord}</strong>
                <div style={{ color: 'var(--ink-3)', fontSize: '13px' }}>{selectedAgent.landlord_email}</div>
              </div>
              <div className="detail-card">
                <div className="card-label">Status</div>
                <strong style={{ color: selectedAgent.status === 'active' ? 'var(--accent)' : '#dc2626' }}>{selectedAgent.status}</strong>
              </div>
              <div className="detail-card">
                <div className="card-label">Email</div>
                <strong>{selectedAgent.email}</strong>
              </div>
            </div>
          </div>
        </div>
      )}

      <footer>
        <div className="footer-inner">
          <div className="footer-brand"><span className="logo-mark" style={{ width: 26, height: 26, borderRadius: 7 }}><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M3 21h18"/><path d="M5 21V7l8-4v18"/><path d="M19 21V11l-6-4"/></svg></span>Springfield Systems</div>
          <div className="footer-links"><a href="/">Home</a><a href="/super-admin">Dashboard</a></div>
          <div className="footer-copy">© 2026 Springfield Systems. All rights reserved.</div>
        </div>
      </footer>
    </>
  );
}