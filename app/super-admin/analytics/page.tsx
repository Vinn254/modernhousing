'use client';

import Link from 'next/link';

export default function AnalyticsPage() {
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

          <h1>Analytics</h1>

          <p className="hero-sub">
            System-wide statistics and performance metrics.
          </p>
        </div>
      </section>

      {/* BENTO */}
      <section className="bento-section">
        <div className="bento">

          <article className="card" style={{ gridColumn: 'span 4' }}>
            <div className="card-label">
              <span className="badge badge-pm" style={{ background: 'var(--accent)' }}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><rect x="1" y="4" width="22" height="16" rx="2"/><line x1="1" y1="10" x2="23" y2="10"/></svg>
              </span>
              Properties
            </div>
            <h3 style={{ fontSize: '36px', fontWeight: 700, margin: '8px 0 4px' }}>12</h3>
            <p style={{ color: 'var(--ink-3)', margin: 0, fontSize: '14px' }}>Across the platform</p>
          </article>

          <article className="card" style={{ gridColumn: 'span 4' }}>
            <div className="card-label">
              <span className="badge badge-agent" style={{ background: 'var(--amber)' }}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="8.5" cy="7" r="4"/></svg>
              </span>
              Tenants
            </div>
            <h3 style={{ fontSize: '36px', fontWeight: 700, margin: '8px 0 4px', color: 'var(--amber)' }}>156</h3>
            <p style={{ color: 'var(--ink-3)', margin: 0, fontSize: '14px' }}>Currently renting</p>
          </article>

          <article className="card" style={{ gridColumn: 'span 4' }}>
            <div className="card-label">
              <span className="badge" style={{ background: 'var(--rose)' }}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
              </span>
              Overdue
            </div>
            <h3 style={{ fontSize: '36px', fontWeight: 700, margin: '8px 0 4px', color: 'var(--rose)' }}>24</h3>
            <p style={{ color: 'var(--ink-3)', margin: 0, fontSize: '14px' }}>Due for collection</p>
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
            <a href="/super-admin">Dashboard</a>
          </div>
          <div className="footer-copy">© 2024 Springfield Systems. All rights reserved.</div>
        </div>
      </footer>
    </>
  );
}