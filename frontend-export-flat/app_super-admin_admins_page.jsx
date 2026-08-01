'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import AdminTopNav from '../../components/AdminTopNav';
export default function AdminManagementPage() {
    const [admins, setAdmins] = useState([]);
    const [showAddModal, setShowAddModal] = useState(false);
    const [selectedAdmin, setSelectedAdmin] = useState(null);
    const [newEmail, setNewEmail] = useState('');
    const [newPassword, setNewPassword] = useState('');
    const [newName, setNewName] = useState('');
    const [role, setRole] = useState('admin');
    const [loading, setLoading] = useState(false);
    const [message, setMessage] = useState('');
    const [error, setError] = useState('');
    async function loadData() {
        setLoading(true);
        const response = await fetch('/api/admins');
        const result = await response.json();
        if (!response.ok) {
            setError(result.message ?? 'Unable to load administrators.');
            setLoading(false);
            return;
        }
        setAdmins(result.admins ?? []);
        setLoading(false);
    }
    useEffect(() => {
        loadData();
    }, []);
    async function handleAddAdmin(event) {
        event.preventDefault();
        setMessage('');
        setError('');
        setLoading(true);
        const response = await fetch('/api/admins', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email: newEmail, password: newPassword, fullName: newName, role }),
        });
        const result = await response.json();
        if (!response.ok) {
            setError(result.message ?? 'Unable to create administrator.');
            setLoading(false);
            return;
        }
        setMessage('Administrator created.');
        setShowAddModal(false);
        setNewEmail('');
        setNewPassword('');
        setNewName('');
        setRole('admin');
        await loadData();
    }
    async function handleApprove(admin) {
        const response = await fetch('/api/admins', {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ userId: admin.id, fullName: admin.full_name, status: 'active' }),
        });
        const result = await response.json();
        if (!response.ok) {
            setError(result.message ?? 'Unable to approve administrator.');
            return;
        }
        setAdmins((current) => current.map((item) => (item.id === admin.id ? { ...item, ...result.admin } : item)));
        setMessage('Administrator approved and activated.');
    }
    async function handleDeactivate(admin) {
        if (!confirm(`Deactivate ${admin.full_name}?`))
            return;
        const response = await fetch(`/api/admins?id=${encodeURIComponent(admin.id)}`, { method: 'DELETE' });
        const result = await response.json();
        if (!response.ok) {
            setError(result.message ?? 'Unable to deactivate administrator.');
            return;
        }
        setAdmins((current) => current.map((item) => (item.id === admin.id ? { ...item, ...result.admin } : item)));
        setMessage('Administrator deactivated.');
    }
    const activeCount = admins.filter((admin) => admin.status === 'active').length;
    const inactiveCount = admins.filter((admin) => admin.status === 'inactive').length;
    return (<>
      <section className="hero">
        <nav className="nav">
          <Link href="/" className="logo">
            <span className="logo-mark">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M3 21h18"/><path d="M5 21V7l8-4v18"/><path d="M19 21V11l-6-4"/></svg>
            </span>
            Springfield Systems
          </Link>
          <AdminTopNav variant="super"/>
        </nav>

        <div className="hero-inner">
          <span className="eyebrow">
            <span className="pulse"></span>
            Super Admin
          </span>

          <h1>Administrators</h1>

          <p className="hero-sub">
            Manage administrator accounts, approve pending users, and deactivate access when needed.
          </p>
        </div>
      </section>

      <section className="bento-section">
        <div className="bento">
          <article className="card" style={{ gridColumn: 'span 4' }}>
            <div className="card-label">Administrators</div>
            <h3 style={{ fontSize: '34px', margin: 0 }}>{admins.length}</h3>
            <p>Total administrator accounts.</p>
          </article>

          <article className="card" style={{ gridColumn: 'span 4' }}>
            <div className="card-label">Active</div>
            <h3 style={{ fontSize: '34px', margin: 0 }}>{activeCount}</h3>
            <p>Approved administrator accounts.</p>
          </article>

          <article className="card" style={{ gridColumn: 'span 4' }}>
            <div className="card-label">Inactive</div>
            <h3 style={{ fontSize: '34px', margin: 0, color: 'var(--amber)' }}>{inactiveCount}</h3>
            <p>Disabled or pending accounts.</p>
          </article>

          <article className="card card-pm" style={{ gridColumn: 'span 12' }}>
            <div className="card-label">
              <span className="badge badge-pm">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>
              </span>
              Administrators
            </div>
            <h3 style={{ marginBottom: 16 }}>Administrator Accounts</h3>

            {loading && <p style={{ color: 'var(--ink-3)', margin: '0 0 16px' }}>Loading administrators…</p>}
            {message && <p style={{ color: 'var(--accent)', margin: '0 0 16px' }}>{message}</p>}
            {error && <p style={{ color: '#dc2626', margin: '0 0 16px' }}>{error}</p>}

            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '14px' }}>
                <thead>
                  <tr style={{ borderBottom: '1px solid var(--line)' }}>
                    <th style={{ textAlign: 'left', padding: '12px 16px', fontWeight: 600, color: 'var(--ink-2)' }}>Name</th>
                    <th style={{ textAlign: 'left', padding: '12px 16px', fontWeight: 600, color: 'var(--ink-2)' }}>Email</th>
                    <th style={{ textAlign: 'left', padding: '12px 16px', fontWeight: 600, color: 'var(--ink-2)' }}>Role</th>
                    <th style={{ textAlign: 'left', padding: '12px 16px', fontWeight: 600, color: 'var(--ink-2)' }}>Status</th>
                    <th style={{ textAlign: 'left', padding: '12px 16px', fontWeight: 600, color: 'var(--ink-2)' }}>Created</th>
                    <th style={{ textAlign: 'left', padding: '12px 16px', fontWeight: 600, color: 'var(--ink-2)' }}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {admins.length === 0 && !loading ? (<tr>
                      <td colSpan={6} style={{ padding: '24px 16px', color: 'var(--ink-3)', textAlign: 'center' }}>No administrators found.</td>
                    </tr>) : admins.map((admin) => (<tr key={admin.id} style={{ borderBottom: '1px solid var(--line-soft)' }}>
                      <td style={{ padding: '16px 16px 16px 0', fontWeight: 600 }}>{admin.full_name}</td>
                      <td style={{ padding: '16px', color: 'var(--ink-3)' }}>{admin.email}</td>
                      <td style={{ padding: '16px', textTransform: 'capitalize' }}>{admin.role.replace('_', ' ')}</td>
                      <td style={{ padding: '16px' }}>
                        <span style={{
                display: 'inline-block',
                padding: '4px 12px',
                borderRadius: '999px',
                fontSize: '12px',
                fontWeight: 700,
                background: admin.status === 'active' ? 'rgba(16,185,129,0.12)' : 'rgba(245,158,11,0.12)',
                color: admin.status === 'active' ? 'var(--accent)' : 'var(--amber)'
            }}>{admin.status}</span>
                      </td>
                      <td style={{ padding: '16px', color: 'var(--ink-3)' }}>{new Date(admin.created_at).toLocaleDateString()}</td>
                      <td style={{ padding: '16px' }}>
                        <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                          <button className="btn btn-ghost" style={{ fontSize: '12px', padding: '6px 12px' }} onClick={() => setSelectedAdmin(admin)}>View</button>
                          {admin.status !== 'active' && <button className="btn btn-primary" style={{ fontSize: '12px', padding: '6px 12px' }} onClick={() => handleApprove(admin)}>Approve</button>}
                          <button className="btn btn-ghost" style={{ fontSize: '12px', padding: '6px 12px', background: 'rgba(220,38,38,0.1)', color: '#7f1212' }} onClick={() => handleDeactivate(admin)}>Deactivate</button>
                        </div>
                      </td>
                    </tr>))}
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

      {showAddModal && (<div className="modal-overlay">
          <div className="modal-card" style={{ padding: 32, maxWidth: 460 }}>
            <h3 style={{ marginTop: 0, marginBottom: 20 }}>Add New Administrator</h3>
            {error && <p style={{ color: '#dc2626', marginBottom: 12 }}>{error}</p>}
            <form onSubmit={handleAddAdmin} className="auth-form">
              <div className="field-group">
                <label>Email</label>
                <input type="email" value={newEmail} onChange={(e) => setNewEmail(e.target.value)} required/>
              </div>
              <div className="field-group">
                <label>Password</label>
                <input type="password" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} required/>
              </div>
              <div className="field-group">
                <label>Full Name</label>
                <input value={newName} onChange={(e) => setNewName(e.target.value)} required/>
              </div>
              <div className="field-group">
                <label>Role</label>
                <select value={role} onChange={(e) => setRole(e.target.value)}>
                  <option value="admin">Admin</option>
                  <option value="super_admin">Super Admin</option>
                </select>
              </div>
              <div style={{ display: 'flex', gap: 12 }}>
                <button type="submit" disabled={loading}>{loading ? 'Creating…' : 'Create Administrator'}</button>
                <button type="button" className="btn btn-ghost" onClick={() => setShowAddModal(false)} disabled={loading}>Cancel</button>
              </div>
            </form>
          </div>
        </div>)}

      {selectedAdmin && (<div className="modal-overlay" onClick={(e) => e.target === e.currentTarget && setSelectedAdmin(null)}>
          <div className="modal-card" style={{ maxWidth: 520 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, marginBottom: 20 }}>
              <h3 style={{ margin: 0 }}>Administrator Details</h3>
              <button className="btn btn-ghost" onClick={() => setSelectedAdmin(null)} style={{ padding: '4px 10px' }}>Close</button>
            </div>
            <div className="grid" style={{ gap: 12 }}>
              <div className="card" style={{ padding: 16 }}><p style={{ margin: '0 0 4px', color: 'var(--ink-3)', fontSize: '12px', textTransform: 'uppercase' }}>Full name</p><strong>{selectedAdmin.full_name}</strong></div>
              <div className="card" style={{ padding: 16 }}><p style={{ margin: '0 0 4px', color: 'var(--ink-3)', fontSize: '12px', textTransform: 'uppercase' }}>Email</p><strong>{selectedAdmin.email}</strong></div>
              <div className="card" style={{ padding: 16 }}><p style={{ margin: '0 0 4px', color: 'var(--ink-3)', fontSize: '12px', textTransform: 'uppercase' }}>Role</p><strong>{selectedAdmin.role.replace('_', ' ')}</strong></div>
              <div className="card" style={{ padding: 16 }}><p style={{ margin: '0 0 4px', color: 'var(--ink-3)', fontSize: '12px', textTransform: 'uppercase' }}>Status</p><strong>{selectedAdmin.status}</strong></div>
              <div className="card" style={{ padding: 16 }}><p style={{ margin: '0 0 4px', color: 'var(--ink-3)', fontSize: '12px', textTransform: 'uppercase' }}>Created</p><strong>{new Date(selectedAdmin.created_at).toLocaleDateString()}</strong></div>
            </div>
          </div>
        </div>)}

      <footer>
        <div className="footer-inner">
          <div className="footer-brand">
            <span className="logo-mark" style={{ width: 26, height: 26, borderRadius: 7 }}>
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
    </>);
}
