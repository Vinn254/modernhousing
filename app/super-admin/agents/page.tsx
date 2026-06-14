'use client';

import { useState } from 'react';
import Link from 'next/link';

interface Property {
  id: string;
  name: string;
  address: string;
}

interface Tenant {
  id: string;
  name: string;
  unit: string;
  rent: number;
  paid: boolean;
}

interface Agent {
  id: string;
  name: string;
  email: string;
  status: string;
  properties: Property[];
  tenants: Tenant[];
}

const agents: Agent[] = [
  { 
    id: '1', 
    name: 'John Smith', 
    email: 'john@agent.com', 
    status: 'Active',
    properties: [
      { id: 'p1', name: 'Sunset Apartments', address: '123 Main St' },
    ],
    tenants: [
      { id: 't1', name: 'Mike Johnson', unit: 'A-101', rent: 120000, paid: true },
      { id: 't2', name: 'Sarah Wilson', unit: 'A-102', rent: 120000, paid: false },
    ]
  },
  { 
    id: '2', 
    name: 'Jane Doe', 
    email: 'jane@agent.com', 
    status: 'Active',
    properties: [
      { id: 'p2', name: 'Ocean View Residences', address: '456 Ocean Ave' },
    ],
    tenants: [
      { id: 't3', name: 'Tom Brown', unit: 'B-201', rent: 150000, paid: true },
      { id: 't4', name: 'Lisa Davis', unit: 'B-202', rent: 150000, paid: true },
    ]
  },
];

export default function AgentsPage() {
  const [selectedAgent, setSelectedAgent] = useState<Agent | null>(null);
  const [showModal, setShowModal] = useState(false);

  const handleViewDetails = (agent: Agent) => {
    setSelectedAgent(agent);
    setShowModal(true);
  };

  return (
    <>
      {/* HERO */}
      <section className="hero">
        <nav className="nav">
          <Link href="/" className="logo">
            <span className="logo-mark">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M3 21h18"/><path d="M5 21V7l8-4v18"/><path d="M19 21V11l-6-4"/></svg>
            </span>
            Springfield Systems
          </Link>
          <div className="nav-links">
            <a href="/super-admin">Dashboard</a>
            <a href="/super-admin/admins">Admins</a>
            <a href="/super-admin/agents">Agents</a>
            <a href="/super-admin/properties">Properties</a>
            <a href="/super-admin/tenants">Tenants</a>
            <a href="/super-admin/payments">Payments</a>
          </div>
        </nav>

        <div className="hero-inner">
          <span className="eyebrow">
            <span className="pulse"></span>
            Super Admin
          </span>

          <h1>Agents</h1>

          <p className="hero-sub">
            Manage all property agents, their assignments, and tenant relationships.
          </p>
        </div>
      </section>

      {/* BENTO */}
      <section className="bento-section">
        <div className="bento">

          <article className="card card-pm" style={{ gridColumn: 'span 12' }}>
            <div className="card-label">
              <span className="badge badge-agent">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>
              </span>
              Agent Management
            </div>
            <h3 style={{ marginBottom: 16 }}>All Agents</h3>

            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '14px' }}>
                <thead>
                  <tr style={{ borderBottom: '1px solid var(--line)' }}>
                    <th style={{ textAlign: 'left', padding: '12px 16px', fontWeight: 600, color: 'var(--ink-2)' }}>Name</th>
                    <th style={{ textAlign: 'left', padding: '12px 16px', fontWeight: 600, color: 'var(--ink-2)' }}>Email</th>
                    <th style={{ textAlign: 'left', padding: '12px 16px', fontWeight: 600, color: 'var(--ink-2)' }}>Properties</th>
                    <th style={{ textAlign: 'left', padding: '12px 16px', fontWeight: 600, color: 'var(--ink-2)' }}>Tenants</th>
                    <th style={{ textAlign: 'left', padding: '12px 16px', fontWeight: 600, color: 'var(--ink-2)' }}>Status</th>
                    <th style={{ textAlign: 'left', padding: '12px 16px', fontWeight: 600, color: 'var(--ink-2)' }}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {agents.map((agent) => (
                    <tr key={agent.id} style={{ borderBottom: '1px solid var(--line-soft)' }}>
                      <td style={{ padding: '16px 16px 16px 0', fontWeight: 500 }}>{agent.name}</td>
                      <td style={{ padding: '16px', color: 'var(--ink-3)' }}>{agent.email}</td>
                      <td style={{ padding: '16px', color: 'var(--ink-2)', fontWeight: 500 }}>{agent.properties.length}</td>
                      <td style={{ padding: '16px', color: 'var(--ink-2)', fontWeight: 500 }}>{agent.tenants.length}</td>
                      <td style={{ padding: '16px' }}>
                        <span style={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '6px',
                          padding: '4px 12px',
                          borderRadius: '999px',
                          fontSize: '12px',
                          fontWeight: 500,
                          backgroundColor: agent.status === 'Active' ? 'var(--accent-soft)' : 'rgba(245,158,11,0.1)',
                          color: agent.status === 'Active' ? 'var(--accent)' : 'var(--amber)'
                        }}>
                          <span style={{
                            width: '6px',
                            height: '6px',
                            borderRadius: '50%',
                            backgroundColor: agent.status === 'Active' ? 'var(--accent)' : 'var(--amber)'
                          }}></span>
                          {agent.status}
                        </span>
                      </td>
                      <td style={{ padding: '16px' }}>
                        <button onClick={() => handleViewDetails(agent)} className="btn btn-primary" style={{ fontSize: '12px', padding: '6px 12px' }}>View</button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </article>

        </div>
      </section>

      {showModal && selectedAgent && (
        <div className="modal-overlay" onClick={(e) => e.target === e.currentTarget && setShowModal(false)}>
          <div className="modal-card" style={{ maxWidth: 900, width: '95%' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
              <h3 style={{ margin: 0 }}>Agent: {selectedAgent.name}</h3>
              <button className="btn btn-ghost" onClick={() => setShowModal(false)} style={{ fontSize: '18px', padding: '4px 8px' }}>✕</button>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 24 }}>
              {/* Properties Section */}
              <div>
                <h4 style={{ marginTop: 0, marginBottom: 12, fontSize: 16, fontWeight: 600, display: 'flex', alignItems: 'center', gap: 8 }}>
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 21h18"/><path d="M5 21V7l8-4v18"/><path d="M19 21V11l-6-4"/></svg>
                  Properties Assigned
                </h4>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                  {selectedAgent.properties.map((prop) => (
                    <div key={prop.id} style={{
                      padding: 14,
                      background: 'var(--line-soft)',
                      borderRadius: 10,
                      border: '1px solid var(--line)'
                    }}>
                      <div style={{ fontWeight: 600, color: 'var(--ink)', marginBottom: 4 }}>{prop.name}</div>
                      <div style={{ fontSize: 13, color: 'var(--ink-3)' }}>{prop.address}</div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Tenants Section */}
              <div>
                <h4 style={{ marginTop: 0, marginBottom: 12, fontSize: 16, fontWeight: 600, display: 'flex', alignItems: 'center', gap: 8 }}>
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>
                  Tenants ({selectedAgent.tenants.length})
                </h4>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
                  <thead style={{ background: 'var(--line-soft)' }}>
                    <tr>
                      <th style={{ padding: '10px 12px', textAlign: 'left', fontWeight: 600 }}>Name</th>
                      <th style={{ padding: '10px 12px', textAlign: 'left', fontWeight: 600 }}>Unit</th>
                      <th style={{ padding: '10px 12px', textAlign: 'left', fontWeight: 600 }}>Rent</th>
                      <th style={{ padding: '10px 12px', textAlign: 'left', fontWeight: 600 }}>Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {selectedAgent.tenants.map((tenant) => (
                      <tr key={tenant.id} style={{ borderBottom: '1px solid var(--line-soft)' }}>
                        <td style={{ padding: '12px 12px 12px 0', fontWeight: 500 }}>{tenant.name}</td>
                        <td style={{ padding: '12px 12px' }}>{tenant.unit}</td>
                        <td style={{ padding: '12px 12px', fontWeight: 600, color: 'var(--accent)' }}>KSH {tenant.rent.toLocaleString()}</td>
                        <td style={{ padding: '12px 12px' }}>
                          <span style={{
                            display: 'inline-block',
                            padding: '3px 10px',
                            borderRadius: '999px',
                            fontSize: '11px',
                            fontWeight: 500,
                            backgroundColor: tenant.paid ? 'var(--accent-soft)' : 'rgba(220,38,38,0.1)',
                            color: tenant.paid ? 'var(--accent)' : '#dc2626'
                          }}>
                            {tenant.paid ? 'Paid' : 'Unpaid'}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* FOOTER */}
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
            <a href="/super-admin">Dashboard</a>
          </div>
          <div className="footer-copy">© 2024 Springfield Systems. All rights reserved.</div>
        </div>
      </footer>
    </>
  );
}