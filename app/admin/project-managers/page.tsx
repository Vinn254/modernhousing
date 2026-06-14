'use client';

import { useState } from 'react';
import Link from 'next/link';

interface ProjectManager {
  id: string;
  email: string;
  full_name: string;
  organization: string;
  status: string;
  created_at: string;
}

export default function ProjectManagersPage() {
  const [pms, setPms] = useState<ProjectManager[]>([
    { id: '1', email: 'pm@springfield.com', full_name: 'Jane Doe', organization: 'Springfield Holdings', status: 'active', created_at: '2024-01-15' },
    { id: '2', email: 'pm2@springfield.com', full_name: 'John Smith', organization: 'Ocean View LLC', status: 'pending', created_at: '2024-02-20' },
  ]);
  const [showAddModal, setShowAddModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [selectedPm, setSelectedPm] = useState<ProjectManager | null>(null);
  const [showConfirmModal, setShowConfirmModal] = useState(false);
  const [confirmAction, setConfirmAction] = useState<string>('');

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
            <a href="/admin">Dashboard</a>
            <a href="/admin/tenants">Tenants</a>
            <a href="/admin/payments">Payments</a>
            <a href="/admin/communications">Announcements</a>
          </div>
        </nav>

        <div className="hero-inner">
          <span className="eyebrow">
            <span className="pulse"></span>
            Admin Portal
          </span>

          <h1>Project Managers</h1>

          <p className="hero-sub">
            Verify, activate, and manage account access.
          </p>
        </div>
      </section>

      {/* BENTO */}
      <section className="bento-section">
        <div className="bento">

          <article className="card card-pm" style={{ gridColumn: 'span 12' }}>
            <div className="card-label">
              <span className="badge badge-pm">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M16 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="8.5" cy="7" r="4"/><line x1="20" y1="8" x2="20" y2="14"/><line x1="23" y1="11" x2="17" y2="11"/></svg>
              </span>
              Project Managers
            </div>
            <h3 style={{ marginBottom: 16 }}>PM Accounts Management</h3>

            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '14px' }}>
                <thead>
                  <tr style={{ borderBottom: '1px solid var(--line)' }}>
                    <th style={{ textAlign: 'left', padding: '12px 12px', fontWeight: 600, color: 'var(--ink-2)' }}>Name</th>
                    <th style={{ textAlign: 'left', padding: '12px 12px', fontWeight: 600, color: 'var(--ink-2)' }}>Email</th>
                    <th style={{ textAlign: 'left', padding: '12px 12px', fontWeight: 600, color: 'var(--ink-2)' }}>Organization</th>
                    <th style={{ textAlign: 'left', padding: '12px 12px', fontWeight: 600, color: 'var(--ink-2)' }}>Status</th>
                    <th style={{ textAlign: 'left', padding: '12px 12px', fontWeight: 600, color: 'var(--ink-2)' }}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {pms.map((pm) => (
                    <tr key={pm.id} style={{ borderBottom: '1px solid var(--line-soft)' }}>
                      <td style={{ padding: '16px 12px 16px 0', fontWeight: 500 }}>{pm.full_name}</td>
                      <td style={{ padding: '16px 12px', color: 'var(--ink-3)' }}>{pm.email}</td>
                      <td style={{ padding: '16px 12px', color: 'var(--ink-3)' }}>{pm.organization}</td>
                      <td style={{ padding: '16px 12px' }}>
                        <span style={{
                          display: 'inline-block',
                          padding: '4px 12px',
                          borderRadius: '999px',
                          fontSize: '12px',
                          fontWeight: 500,
                          background: pm.status === 'active' ? 'rgba(16,185,129,0.12)' : 'rgba(245,158,11,0.12)',
                          color: pm.status === 'active' ? 'var(--accent)' : 'var(--amber)'
                        }}>{pm.status}</span>
                      </td>
                      <td style={{ padding: '16px 12px' }}>
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
              Add Project Manager
              <svg className="arrow" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="5" y1="12" x2="19" y2="12"/><polyline points="12 5 19 12 12 19"/></svg>
            </button>
          </article>

        </div>
      </section>

      {showAddModal && (
        <div className="modal-overlay" onClick={(e) => e.target === e.currentTarget && setShowAddModal(false)}>
          <div className="modal-card" style={{ padding: 32, maxWidth: 420 }}>
            <h3 style={{ marginTop: 0, marginBottom: 20 }}>Add Project Manager</h3>
            <div className="auth-form">
              <div className="field-group">
                <label>Email</label>
                <input type="email" required />
              </div>
              <div className="field-group">
                <label>Password</label>
                <input type="password" required />
              </div>
              <div className="field-group">
                <label>Full Name</label>
                <input required />
              </div>
              <div className="field-group">
                <label>Organization</label>
                <input required />
              </div>
              <div style={{ display: 'flex', gap: 12 }}>
                <button>Create</button>
                <button onClick={() => setShowAddModal(false)} className="btn btn-ghost">Cancel</button>
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
            <a href="/admin">Dashboard</a>
          </div>
          <div className="footer-copy">© 2024 Springfield Systems. All rights reserved.</div>
        </div>
      </footer>
    </>
  );
}