'use client';

import { useState } from 'react';
import Link from 'next/link';

interface Tenant {
  id: string;
  name: string;
  email: string;
  unit: string;
  property: string;
  lease_start: string;
  lease_end: string;
  status: string;
  pm: string;
}

export default function TenantsPage() {
  const [tenants, setTenants] = useState<Tenant[]>([
    { id: '1', name: 'Mike Johnson', email: 'mike@example.com', unit: 'A-101', property: 'Sunset Apartments', lease_start: '2024-01-01', lease_end: '2025-01-01', status: 'active', pm: 'Jane Doe' },
    { id: '2', name: 'Sarah Wilson', email: 'sarah@example.com', unit: 'A-102', property: 'Sunset Apartments', lease_start: '2024-02-01', lease_end: '2025-02-01', status: 'active', pm: 'Jane Doe' },
  ]);

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
            <a href="/admin/project-managers">Project Managers</a>
            <a href="/admin/payments">Payments</a>
            <a href="/admin/communications">Announcements</a>
          </div>
        </nav>

        <div className="hero-inner">
          <span className="eyebrow">
            <span className="pulse"></span>
            Admin Portal
          </span>

          <h1>Tenant Records</h1>

          <p className="hero-sub">
            Maintain and verify tenant records across all properties.
          </p>
        </div>
      </section>

      {/* BENTO */}
      <section className="bento-section">
        <div className="bento">

          <article className="card card-pm" style={{ gridColumn: 'span 12' }}>
            <div className="card-label">
              <span className="badge badge-pm">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>
              </span>
              Tenants
            </div>
            <h3 style={{ marginBottom: 16 }}>All Tenant Records</h3>

            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '14px' }}>
                <thead>
                  <tr style={{ borderBottom: '1px solid var(--line)' }}>
                    <th style={{ textAlign: 'left', padding: '12px 12px', fontWeight: 600, color: 'var(--ink-2)', minWidth: 150 }}>Name</th>
                    <th style={{ textAlign: 'left', padding: '12px 12px', fontWeight: 600, color: 'var(--ink-2)', minWidth: 200 }}>Email</th>
                    <th style={{ textAlign: 'left', padding: '12px 12px', fontWeight: 600, color: 'var(--ink-2)' }}>Unit</th>
                    <th style={{ textAlign: 'left', padding: '12px 12px', fontWeight: 600, color: 'var(--ink-2)' }}>Property</th>
                    <th style={{ textAlign: 'left', padding: '12px 12px', fontWeight: 600, color: 'var(--ink-2)' }}>PM</th>
                    <th style={{ textAlign: 'left', padding: '12px 12px', fontWeight: 600, color: 'var(--ink-2)' }}>Status</th>
                    <th style={{ textAlign: 'left', padding: '12px 12px', fontWeight: 600, color: 'var(--ink-2)' }}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {tenants.map((tenant) => (
                    <tr key={tenant.id} style={{ borderBottom: '1px solid var(--line-soft)' }}>
                      <td style={{ padding: '16px 12px 16px 0', fontWeight: 500 }}>{tenant.name}</td>
                      <td style={{ padding: '16px 12px', color: 'var(--ink-3)' }}>{tenant.email}</td>
                      <td style={{ padding: '16px 12px' }}>{tenant.unit}</td>
                      <td style={{ padding: '16px 12px', color: 'var(--ink-3)' }}>{tenant.property}</td>
                      <td style={{ padding: '16px 12px', color: 'var(--accent-bright)', fontWeight: 500 }}>{tenant.pm}</td>
                      <td style={{ padding: '16px 12px' }}>
                        <span style={{
                          display: 'inline-block',
                          padding: '4px 12px',
                          borderRadius: '999px',
                          fontSize: '12px',
                          fontWeight: 500,
                          background: 'rgba(16,185,129,0.12)',
                          color: 'var(--accent)'
                        }}>{tenant.status}</span>
                      </td>
                      <td style={{ padding: '16px 12px' }}>
                        <div style={{ display: 'flex', gap: '8px' }}>
                          <button className="btn btn-ghost" style={{ fontSize: '12px', padding: '6px 12px' }}>Edit</button>
                          <button className="btn btn-ghost" style={{ fontSize: '12px', padding: '6px 12px', background: 'rgba(220,38,38,0.1)', color: '#7f1212' }}>Remove</button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </article>

        </div>
      </section>

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