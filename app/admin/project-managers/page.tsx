'use client';

import { useEffect, useState } from 'react';

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
    const response = await fetch('/api/admins?role=admin');
    const result = await response.json();

    if (!response.ok) {
      setError(result.message ?? 'Unable to load project managers.');
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
    if (!confirm('Mark this project manager as inactive?')) return;

    const response = await fetch(`/api/admins?id=${encodeURIComponent(adminId)}` , { method: 'DELETE' });
    const result = await response.json();

    if (!response.ok) {
      setError(result.message ?? 'Unable to remove project manager.');
      return;
    }

    setMessage('Project manager marked inactive.');
    await loadAdmins();
  }

  return (
    <>
      <main className="container admin-no-hero" style={{ padding: '34px 0 80px' }}>
        <div className="card-admin-header">
          <div>
            <p className="heading">Project Managers</p>
            <p className="subheading">Verify, activate, and manage project manager account access.</p>
          </div>
        </div>

        <section className="bento-section">
          <div className="bento">
            <article className="card">
              <div className="card-label"><span className="badge badge-pm"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M16 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="8.5" cy="7" r="4"/><line x1="20" y1="8" x2="20" y2="14"/><line x1="23" y1="11" x2="17" y2="11"/></svg></span>Project Manager Accounts</div>
              <h3 style={{ marginBottom: 16 }}>Account Management</h3>

              {loading && <p style={{ color: 'var(--ink-3)' }}>Loading project managers…</p>}
              {error && <p style={{ color: '#dc2626' }}>{error}</p>}
              {message && <p style={{ color: 'var(--accent)' }}>{message}</p>}

              <div style={{ overflowX: 'auto' }}>
                <table className="landlord-table">
                  <thead>
                    <tr>
                      <th>Name</th>
                      <th>Email</th>
                      <th>Status</th>
                      <th>Created</th>
                      <th>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {admins.length === 0 && !loading ? (
                      <tr><td colSpan={5} className="landlord-empty">No project managers found.</td></tr>
                    ) : admins.map((admin) => (
                      <tr key={admin.id}>
                        <td className="landlord-name">{admin.full_name}</td>
                        <td>{admin.email}</td>
                        <td>
                          <span className={`status-pill ${admin.status === 'active' ? 'status-active' : 'status-pending'}`}>{admin.status}</span>
                        </td>
                        <td>{admin.created_at ? new Date(admin.created_at).toLocaleDateString() : '—'}</td>
                        <td>
                          <button className="action-button danger" onClick={() => handleRemove(admin.id)} disabled={admin.status !== 'active'}>{admin.status === 'active' ? 'Remove' : 'Removed'}</button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </article>
          </div>
        </section>
      </main>

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