'use client';

import Link from 'next/link';

export default function AdminDashboard() {
  return (
    <>
      <main className="container admin-no-hero" style={{ padding: '34px 0 80px' }}>
        <div className="card-admin-header">
          <div>
            <p className="heading">Project Manager Dashboard</p>
            <p className="subheading">Manage your properties, agents, tenants, payments, and communications.</p>
          </div>
        </div>

        <section className="bento-section">
          <div className="bento">
            <article className="card card-pm">
              <div className="card-label"><span className="badge badge-pm"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M16 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="8.5" cy="7" r="4"/><line x1="20" y1="8" x2="20" y2="14"/><line x1="23" y1="11" x2="17" y2="11"/></svg></span>Properties</div>
              <h3>Manage your properties and units.</h3>
              <p>Add properties, create units, and assign agents to specific properties.</p>
              <Link href="/properties" className="card-cta">Manage Properties</Link>
            </article>

            <article className="card card-agent">
              <div className="card-label"><span className="badge badge-agent"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13 a4 0 0 1 0 7.75"/></svg></span>Agents</div>
              <h3>Assign agents and monitor assignments.</h3>
              <p>View agents added by you, assigned properties, and active status.</p>
              <Link href="/admin/agents" className="card-cta">View Agents</Link>
            </article>

            <article className="card card-feat card-feat-1">
              <div className="feat-icon" style={{ background: 'var(--accent)' }}><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="1" y="4" width="22" height="16" rx="2"/><line x1="1" y1="10" x2="23" y2="10"/></svg></div>
              <h3>Tenants</h3>
              <p>View your tenants and manage occupancy.</p>
              <Link href="/admin/tenants" className="card-cta">View Tenants</Link>
            </article>

            <article className="card card-feat card-feat-2">
              <div className="feat-icon" style={{ background: 'var(--navy-700)' }}><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg></div>
              <h3>Payments</h3>
              <p>Review transaction records and balances.</p>
              <Link href="/payments" className="card-cta">View Payments</Link>
            </article>

            <article className="card card-feat card-feat-3">
              <div className="feat-icon" style={{ background: '#0ea5e9' }}><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2-2z"/></svg></div>
              <h3>Communications</h3>
              <p>Manage announcements and notices.</p>
              <Link href="/admin/communications" className="card-cta">Open</Link>
            </article>

            <article className="card card-feat card-feat-4">
              <div className="feat-icon" style={{ background: '#8b5cf6' }}><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg></div>
              <h3>Utilities</h3>
              <p>Manage utility services and payments.</p>
              <Link href="/admin/utilities" className="card-cta">Manage Utilities</Link>
            </article>

            <article className="card card-feat card-feat-5">
              <div className="feat-icon" style={{ background: '#f59e0b' }}><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg></div>
              <h3>Tenant Documents</h3>
              <p>Review tenant-submitted documents.</p>
              <Link href="/admin/documents" className="card-cta">View Documents</Link>
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