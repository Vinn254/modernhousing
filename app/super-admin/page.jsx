'use client';
import Link from 'next/link';
export default function SuperAdminDashboard() {
    return (<>
      <main className="container admin-no-hero">
        <div className="card-admin-header">
          <div>
            <p className="heading">Super Admin Dashboard</p>
            <p className="subheading">Manage administrators, agents, properties, tenants, and payments across every landlord workspace.</p>
          </div>
        </div>

        <section className="bento-section">
          <div className="bento">
            <article className="card card-pm">
              <div className="card-label"><span className="badge badge-pm"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg></span>Landlord Management</div>
              <h3>Manage landlord accounts and subscriptions.</h3>
              <p>Add landlords, choose subscription packages, activate access, and track renewals.</p>
              <Link href="/super-admin/landlords" className="card-cta">Manage Landlords <svg className="arrow" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="5" y1="12" x2="19" y2="12"/><polyline points="12 5 19 12 12 19"/></svg></Link>
            </article>

            <article className="card card-agent">
              <div className="card-label"><span className="badge badge-agent"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M16 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="8.5" cy="7" r="4"/><line x1="20" y1="8" x2="20" y2="14"/><line x1="23" y1="11" x2="17" y2="11"/></svg></span>Agents</div>
              <h3>View all agents and assignments.</h3>
              <p>Monitor agents across properties and manage their access levels.</p>
              <Link href="/super-admin/agents" className="card-cta">View Agents <svg className="arrow" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="5" y1="12" x2="19" y2="12"/><polyline points="12 5 19 12 12 19"/></svg></Link>
            </article>

            <article className="card card-feat card-feat-1">
              <div className="feat-icon" style={{ background: 'var(--accent)' }}><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="1" y="4" width="22" height="16" rx="2"/><line x1="1" y1="10" x2="23" y2="10"/></svg></div>
              <h3>Properties</h3>
              <p>Monitor all properties, track ownership, and view tenant distributions.</p>
              <Link href="/super-admin/properties" className="card-cta">View Properties</Link>
            </article>

            <article className="card card-feat card-feat-2">
              <div className="feat-icon" style={{ background: 'var(--navy-700)' }}><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/></svg></div>
              <h3>Payments</h3>
              <p>Review landlord subscription payments and system revenue.</p>
              <Link href="/super-admin/payments" className="card-cta accent">View Payments</Link>
            </article>

            <article className="card card-feat card-feat-3">
              <div className="feat-icon" style={{ background: 'var(--rose)' }}><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="12" y1="1" x2="12" y2="23"/><path d="M12 1l3 8h-6l3-8z"/><path d="M12 23l-3-8h6l-3 8z"/></svg></div>
              <h3>Tenants</h3>
              <p>Review tenant accounts across all properties and workspaces.</p>
              <Link href="/super-admin/tenants" className="card-cta">View Tenants</Link>
            </article>
          </div>
        </section>
      </main>

      <footer>
        <div className="footer-inner">
          <div className="footer-brand"><span className="logo-mark" style={{ width: 26, height: 26, borderRadius: 7 }}><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M3 21h18"/><path d="M5 21V7l8-4v18"/><path d="M19 21V11l-6-4"/></svg></span>Springfield Systems</div>
          <div className="footer-links"><a href="/">Home</a><a href="/super-admin">Dashboard</a></div>
          <div className="footer-copy">© 2026 Springfield Systems. All rights reserved.</div>
        </div>
      </footer>
    </>);
}
