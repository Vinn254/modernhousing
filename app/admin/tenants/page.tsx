'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import AdminTopNav from '../../components/AdminTopNav';

interface Tenant {
  id: string;
  full_name: string;
  email: string;
  unit: string;
  property: string;
  address?: string;
  lease_start: string;
  lease_end: string;
}

export default function AdminTenantsPage() {
  const [tenants, setTenants] = useState<Tenant[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  async function loadTenants() {
    const response = await fetch('/api/tenants');
    const result = await response.json();

    if (!response.ok) {
      setError(result.message ?? 'Unable to load tenants.');
      setLoading(false);
      return;
    }

    setTenants(result.tenants ?? []);
    setLoading(false);
  }

  useEffect(() => {
    loadTenants();
  }, []);

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
          <h1>Tenant Records</h1>
          <p className="hero-sub">Maintain and verify tenant records across all properties.</p>
        </div>
      </section>

      <section className="bento-section">
        <div className="bento">
          <article className="card card-pm" style={{ gridColumn: 'span 12' }}>
            <div className="card-label"><span className="badge badge-pm"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg></span>Tenants</div>
            <h3 style={{ marginBottom: 16 }}>All Tenant Records</h3>

            {loading && <p style={{ color: 'var(--ink-3)' }}>Loading tenants…</p>}
            {error && <p style={{ color: '#dc2626' }}>{error}</p>}

            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '14px' }}>
                <thead>
                  <tr style={{ borderBottom: '1px solid var(--line)' }}>
                    <th style={{ textAlign: 'left', padding: '12px 12px', fontWeight: 700, color: 'var(--ink-2)', minWidth: 150 }}>Name</th>
                    <th style={{ textAlign: 'left', padding: '12px 12px', fontWeight: 700, color: 'var(--ink-2)', minWidth: 200 }}>Email</th>
                    <th style={{ textAlign: 'left', padding: '12px 12px', fontWeight: 700, color: 'var(--ink-2)' }}>Unit</th>
                    <th style={{ textAlign: 'left', padding: '12px 12px', fontWeight: 700, color: 'var(--ink-2)' }}>Property</th>
                    <th style={{ textAlign: 'left', padding: '12px 12px', fontWeight: 700, color: 'var(--ink-2)' }}>Lease</th>
                    <th style={{ textAlign: 'left', padding: '12px 12px', fontWeight: 700, color: 'var(--ink-2)' }}>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {tenants.length === 0 && !loading ? (
                    <tr><td colSpan={6} style={{ padding: '24px 12px', color: 'var(--ink-3)', textAlign: 'center' }}>No tenants found.</td></tr>
                  ) : tenants.map((tenant) => (
                    <tr key={tenant.id} style={{ borderBottom: '1px solid var(--line-soft)' }}>
                      <td style={{ padding: '16px 12px 16px 0', fontWeight: 500 }}>{tenant.full_name}</td>
                      <td style={{ padding: '16px 12px', color: 'var(--ink-3)' }}>{tenant.email}</td>
                      <td style={{ padding: '16px 12px' }}>{tenant.unit}</td>
                      <td style={{ padding: '16px 12px', color: 'var(--ink-3)' }}>{tenant.property}</td>
                      <td style={{ padding: '16px 12px', color: 'var(--ink-3)' }}>{tenant.lease_start} → {tenant.lease_end}</td>
                      <td style={{ padding: '16px 12px' }}>
                        <span style={{ display: 'inline-block', padding: '4px 12px', borderRadius: '999px', fontSize: '12px', fontWeight: 700, background: 'rgba(16,185,129,0.12)', color: 'var(--accent)' }}>Active</span>
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
