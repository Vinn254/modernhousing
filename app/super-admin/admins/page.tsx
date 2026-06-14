'use client';

import { useState } from 'react';
import Link from 'next/link';

interface Admin {
  id: string;
  email: string;
  full_name: string;
  status: string;
}

export default function AdminManagementPage() {
  const [admins, setAdmins] = useState<Admin[]>([
    { id: '1', email: 'admin@springfield.com', full_name: 'Admin User', status: 'active' },
  ]);
  const [showAddModal, setShowAddModal] = useState(false);
  const [newEmail, setNewEmail] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [newName, setNewName] = useState('');

  async function handleAddAdmin(event: React.FormEvent) {
    event.preventDefault();
    setAdmins([...admins, {
      id: Date.now().toString(),
      email: newEmail,
      full_name: newName,
      status: 'active'
    }]);
    setShowAddModal(false);
    setNewEmail('');
    setNewPassword('');
    setNewName('');
  }

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

          <h1>Admin Management</h1>

          <p className="hero-sub">
            Create and manage administrator accounts and permissions.
          </p>
        </div>
      </section>

      {/* BENTO */}
      <section className="bento-section">
        <div className="bento">

          <article className="card card-pm" style={{ gridColumn: 'span 12' }}>
            <div className="card-label">
              <span className="badge badge-pm">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>
              </span>
              Administrators
            </div>
            <h3 style={{ marginBottom: 16 }}>Administrator Accounts</h3>

            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '14px' }}>
                <thead>
                  <tr style={{ borderBottom: '1px solid var(--line)' }}>
                    <th style={{ textAlign: 'left', padding: '12px 16px', fontWeight: 600, color: 'var(--ink-2)' }}>Name</th>
                    <th style={{ textAlign: 'left', padding: '12px 16px', fontWeight: 600, color: 'var(--ink-2)' }}>Email</th>
                    <th style={{ textAlign: 'left', padding: '12px 16px', fontWeight: 600, color: 'var(--ink-2)' }}>Status</th>
                    <th style={{ textAlign: 'left', padding: '12px 16px', fontWeight: 600, color: 'var(--ink-2)' }}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {admins.map((admin) => (
                    <tr key={admin.id} style={{ borderBottom: '1px solid var(--line-soft)' }}>
                      <td style={{ padding: '16px 16px 16px 0', fontWeight: 500 }}>{admin.full_name}</td>
                      <td style={{ padding: '16px', color: 'var(--ink-3)' }}>{admin.email}</td>
                      <td style={{ padding: '16px' }}>
                        <span style={{
                          display: 'inline-block',
                          width: '8px',
                          height: '8px',
                          borderRadius: '50%',
                          background: 'var(--accent)',
                          boxShadow: '0 0 0 0 var(--accent)',
                          animation: 'pulse 2s infinite'
                        }}></span>
                      </td>
                      <td style={{ padding: '16px' }}>
                        <div style={{ display: 'flex', gap: '8px' }}>
                          <button className="btn btn-ghost" style={{ fontSize: '12px', padding: '6px 12px' }}>Edit</button>
                          <button className="btn btn-ghost" style={{ fontSize: '12px', padding: '6px 12px', background: 'rgba(245,158,11,0.1)', color: '#783200' }}>Reset</button>
                          <button className="btn btn-ghost" style={{ fontSize: '12px', padding: '6px 12px', background: 'rgba(220,38,38,0.1)', color: '#7f1212' }}>Remove</button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <button onClick={() => setShowAddModal(true)} className="card-cta" style={{ marginTop: 24 }}>
              Add Administrator
              <svg className="arrow" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="5" y1="12" x2="19" y2="12"/><polyline points="12 5 19 12 12 19"/></svg>
            </button>
          </article>

        </div>
      </section>

      {showAddModal && (
        <div className="modal-overlay">
          <div className="modal-card" style={{ padding: 32, maxWidth: 420 }}>
            <h3 style={{ marginTop: 0, marginBottom: 20 }}>Add New Administrator</h3>
            <form onSubmit={handleAddAdmin} className="auth-form">
              <div className="field-group">
                <label>Email</label>
                <input type="email" value={newEmail} onChange={(e) => setNewEmail(e.target.value)} required />
              </div>
              <div className="field-group">
                <label>Password</label>
                <input type="password" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} required />
              </div>
              <div className="field-group">
                <label>Full Name</label>
                <input value={newName} onChange={(e) => setNewName(e.target.value)} required />
              </div>
              <div style={{ display: 'flex', gap: 12 }}>
                <button type="submit">Create</button>
                <button type="button" className="btn btn-ghost" onClick={() => setShowAddModal(false)}>Cancel</button>
              </div>
            </form>
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