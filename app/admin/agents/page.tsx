'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import AdminTopNav from '../../components/AdminTopNav';

interface Agent {
  id: string;
  name: string;
  email: string;
  property_name: string;
  status: string;
  landlord: string;
  landlord_email: string;
  created_at: string;
}

export default function AdminAgentsPage() {
  const [agents, setAgents] = useState<Agent[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

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
      <section className="hero">
        <nav className="nav">
          <Link href="/" className="logo">
            <span className="logo-mark">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M3 21h18"/><path d="M5 21V7l8-4v18"/><path d="M19 21V11l-6-4"/></svg>
            </span>
            Springfield Systems
          </Link>
          <AdminTopNav variant="admin" />
        </nav>

        <div className="hero-inner">
          <span className="eyebrow">
            <span className="pulse"></span>
            Admin Portal
          </span>
          <h1>Agents</h1>
          <p className="hero-sub">View agents added by landlords, their assigned property, and active status. Admins can view only and cannot edit agents.</p>
        </div>
      </section>

      <section className="bento-section">
        <div className="bento">
          <article className="card card-pm" style={{ gridColumn: 'span 12' }}>
            <div className="card-label">
              <span className="badge badge-agent">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>
              </span>
              Landlord Agents
            </div>
            <h3 style={{ marginBottom: 16 }}>Agent Oversight</h3>

            {loading && <p style={{ color: 'var(--ink-3)' }}>Loading agents…</p>}
            {error && <p style={{ color: '#dc2626' }}>{error}</p>}

            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '14px' }}>
                <thead>
                  <tr style={{ borderBottom: '1px solid var(--line)' }}>
                    <th style={{ textAlign: 'left', padding: '12px 12px', fontWeight: 700, color: 'var(--ink-2)' }}>Agent</th>
                    <th style={{ textAlign: 'left', padding: '12px 12px', fontWeight: 700, color: 'var(--ink-2)' }}>Assigned Property</th>
                    <th style={{ textAlign: 'left', padding: '12px 12px', fontWeight: 700, color: 'var(--ink-2)' }}>Landlord</th>
                    <th style={{ textAlign: 'left', padding: '12px 12px', fontWeight: 700, color: 'var(--ink-2)' }}>Status</th>
                    <th style={{ textAlign: 'left', padding: '12px 12px', fontWeight: 700, color: 'var(--ink-2)' }}>Created</th>
                  </tr>
                </thead>
                <tbody>
                  {agents.length === 0 && !loading ? (
                    <tr>
                      <td colSpan={5} style={{ padding: '24px 12px', color: 'var(--ink-3)', textAlign: 'center' }}>No agents found.</td>
                    </tr>
                  ) : agents.map((agent) => (
                    <tr key={agent.id} style={{ borderBottom: '1px solid var(--line-soft)' }}>
                      <td style={{ padding: '16px 12px 16px 0' }}>
                        <strong>{agent.name}</strong>
                        <div style={{ color: 'var(--ink-3)', fontSize: '13px' }}>{agent.email}</div>
                      </td>
                      <td style={{ padding: '16px 12px', color: 'var(--ink-3)' }}>{agent.property_name || 'Unassigned'}</td>
                      <td style={{ padding: '16px 12px' }}>
                        <strong>{agent.landlord}</strong>
                        <div style={{ color: 'var(--ink-3)', fontSize: '13px' }}>{agent.landlord_email}</div>
                      </td>
                      <td style={{ padding: '16px 12px' }}>
                        <span style={{
                          display: 'inline-block',
                          padding: '4px 12px',
                          borderRadius: '999px',
                          fontSize: '12px',
                          fontWeight: 700,
                          background: agent.status === 'active' ? 'rgba(16,185,129,0.12)' : 'rgba(220,38,38,0.12)',
                          color: agent.status === 'active' ? 'var(--accent)' : '#dc2626'
                        }}>{agent.status}</span>
                      </td>
                      <td style={{ padding: '16px 12px', color: 'var(--ink-3)' }}>{agent.created_at ? new Date(agent.created_at).toLocaleDateString() : '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </article>
        </div>
      </section>

      <footer>
        <div className="footer-inner">
          <div className="footer-brand">
            <span className="logo-mark" style={{width:26,height:26,borderRadius:7}}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M3 21h18"/><path d="M5 21V7l8-4v18"/><path d="M19 21V11l-6-4"/></svg>
            </span>
            Springfield Systems
          </div>
          <div className="footer-links">
            <a href="/">Home</a>
            <a href="/admin">Dashboard</a>
          </div>
          <div className="footer-copy">© 2026 Springfield Systems. All rights reserved.</div>
        </div>
      </footer>
    </>
  );
}
