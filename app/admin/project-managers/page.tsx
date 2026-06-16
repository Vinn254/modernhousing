'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import AdminTopNav from '../../components/AdminTopNav';

interface Admin {
  id: string;
  email: string;
  full_name: string;
  role: 'admin' | 'super_admin';
  status: string;
  created_at: string;
}

export default function AdminLandlordsPage() {
  const [admins, setAdmins] = useState<Admin[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');

  async function loadAdmins() {
    const response = await fetch('/api/admins');
    const result = await response.json();

    if (!response.ok) {
      setError(result.message ?? 'Unable to load landlords.');
      setLoading(false);
      return;
    }

    setAdmins(result.admins ?? []);
    setLoading(false);
  }

  useEffect(() => {
    loadAdmins();
  }, []);

  async function handleRemove(adminId: string) {
    if (!confirm('Mark this landlord as inactive?')) return;

    const response = await fetch(`/api/admins?id=${encodeURIComponent(adminId)}`, { method: 'DELETE' });
    const result = await response.json();

    if (!response.ok) {
      setError(result.message ?? 'Unable to remove landlord.');
      return;
    }

    setMessage('Landlord marked inactive.');
    await loadAdmins();
  }

  return (
    <>
      <section className="hero">
        <nav className="nav">
          <Link href="/" className="logo">
            <span className="logo-mark"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M3 21h18"/><path d="M5 21V7l8-4v18"/><path d="M19 21V11l-6-4"/></svg></span>
            Springfield Systems
          </Link>
          <AdminTopNav variant="admin" />
        </nav>

        <div className="hero-inner">
          <span className="eyebrow"><span className="pulse"></span> Admin Portal</span>
          <h1>Landlords</h1>
          <p className="hero-sub">Verify, activate, and manage landlord account access.</p>
        </div>
      </section>

      <section className="bento-section">
        <div className="bento">
          <article className="card card-pm" style={{ gridColumn: 'span 12' }}>
            <div className="card-label"><span className="badge badge-pm"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M16 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="8.5" cy="7" r="4"/><line x1="20" y1="8" x2="20" y2="14"/><line x1="23" y1="11" x2="17" y2="11"/></svg></span>Landlord Accounts</div>
            <h3 style={{ marginBottom: 16 }}>Account Management</h3>

            {loading && <p style={{ color: 'var(--ink-3)' }}>Loading landlords…</p>}
            {error && <p style={{ color: '#dc2626' }}>{error}</p>}
            {message && <p style={{ color: 'var(--accent)' }}>{message}</p>}

            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '14px' }}>
                <thead>
                  <tr style={{ borderBottom: '1px solid var(--line)' }}>
                    <th style={{ textAlign: 'left', padding: '12px 12px', fontWeight: 700, color: 'var(--ink-2)' }}>Name</th>
                    <th style={{ textAlign: 'left', padding: '12px 12px', fontWeight: 700, color: 'var(--ink-2)' }}>Email</th>
                    <th style={{ textAlign: 'left', padding: '12px 12px', fontWeight: 700, color: 'var(--ink-2)' }}>Role</th>
                    <th style={{ textAlign: 'left', padding: '12px 12px', fontWeight: 700, color: 'var(--ink-2)' }}>Status</th>
                    <th style={{ textAlign: 'left', padding: '12px 12px', fontWeight: 700, color: 'var(--ink-2)' }}>Created</th>
                    <th style={{ textAlign: 'left', padding: '12px 12px', fontWeight: 700, color: 'var(--ink-2)' }}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {admins.length === 0 && !loading ? (
                    <tr><td colSpan={6} style={{ padding: '24px 12px', color: 'var(--ink-3)', textAlign: 'center' }}>No landlords found.</td></tr>
                  ) : admins.map((admin) => (
                    <tr key={admin.id} style={{ borderBottom: '1px solid var(--line-soft)' }}>
                      <td style={{ padding: '16px 12px 16px 0', fontWeight: 500 }}>{admin.full_name}</td>
                      <td style={{ padding: '16px 12px', color: 'var(--ink-3)' }}>{admin.email}</td>
                      <td style={{ padding: '16px 12px', color: 'var(--ink-3)' }}>{admin.role.replace('_', ' ')}</td>
                      <td style={{ padding: '16px 12px' }}>
                        <span style={{ display: 'inline-block', padding: '4px 12px', borderRadius: '999px', fontSize: '12px', fontWeight: 700, background: admin.status === 'active' ? 'rgba(16,185,129,0.12)' : 'rgba(220,38,38,0.12)', color: admin.status === 'active' ? 'var(--accent)' : '#dc2626' }}>{admin.status}</span>
                      </td>
                      <td style={{ padding: '16px 12px', color: 'var(--ink-3)' }}>{admin.created_at ? new Date(admin.created_at).toLocaleDateString() : '—'}</td>
                      <td style={{ padding: '16px 12px' }}>
                        <button className="btn btn-ghost" style={{ fontSize: '12px', padding: '6px 12px', background: admin.status === 'active' ? 'rgba(220,38,38,0.1)' : 'rgba(16,185,129,0.1)', color: admin.status === 'active' ? '#7f1212' : 'var(--accent)' }} onClick={() => handleRemove(admin.id)} disabled={admin.status !== 'active'}>{admin.status === 'active' ? 'Remove' : 'Removed'}</button>
                      </td>
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
          <div className="footer-brand"><span className="logo-mark" style={{ width: 26, height: 26, borderRadius: 7 }}><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M3 21h18"/><path d="M5 21V7l8-4v18"/><path d="M19 21V11l-6-4"/></svg></span>Springfield Systems</div>
          <div className="footer-links"><a href="/">Home</a><a href="/admin">Dashboard</a></div>
          <div className="footer-copy">© 2026 Springfield Systems. All rights reserved.</div>
        </div>
      </footer>
    </>
  );
}
