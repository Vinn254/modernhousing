'use client';

export default function AnalyticsPage() {
  return (
    <>
      <main className="container admin-no-hero" style={{ padding: '34px 0 80px' }}>
        <div className="card-admin-header">
          <div>
            <p className="heading">Analytics</p>
            <p className="subheading">System-wide statistics and performance metrics.</p>
          </div>
        </div>

        <section className="bento-section">
          <div className="bento">
            <article className="card">
              <div className="card-label">
                <span className="badge badge-pm" style={{ background: 'var(--accent)' }}>
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><rect x="1" y="4" width="22" height="16" rx="2"/><line x1="1" y1="10" x2="23" y2="10"/></svg>
                </span>
                Properties
              </div>
              <h3 style={{ fontSize: '36px', fontWeight: 700, margin: '8px 0 4px' }}>12</h3>
              <p style={{ color: 'var(--ink-3)', margin: 0, fontSize: '14px' }}>Across the platform</p>
            </article>

            <article className="card">
              <div className="card-label">
                <span className="badge" style={{ background: 'var(--amber)' }}>
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
                </span>
                Overdue Subscriptions
              </div>
              <h3 style={{ fontSize: '36px', fontWeight: 700, margin: '8px 0 4px', color: 'var(--rose)' }}>24</h3>
              <p style={{ color: 'var(--ink-3)', margin: 0, fontSize: '14px' }}>Landlord renewals due</p>
            </article>

            <article className="card">
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
      </main>

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
          <div className="footer-copy">© 2026 Springfield Systems. All rights reserved.</div>
        </div>
      </footer>
    </>
  );
}