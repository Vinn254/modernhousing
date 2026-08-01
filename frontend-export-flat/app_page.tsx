import Link from 'next/link';

export default function HomePage() {
  return (
    <>
      <section className="hero">
        <nav className="nav">
          <Link href="/" className="logo">
            <span className="logo-mark">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M3 21h18"/><path d="M5 21V7l8-4v18"/><path d="M19 21V11l-6-4"/></svg>
            </span>
            Springfield Systems
          </Link>
          <div className="nav-links" style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
            <a href="/pricing" className="nav-pricing-link" style={{ color: '#fff', textDecoration: 'none', fontWeight: 800 }}>Pricing</a>
            <a href="/login" className="nav-login" style={{ display: 'inline-flex', alignItems: 'center', padding: '9px 16px', borderRadius: '999px', background: 'linear-gradient(135deg, #10b981, #34d399)', border: '1px solid rgba(52,211,153,0.35)', fontSize: 13, fontWeight: 800, color: '#052e1f', textDecoration: 'none', boxShadow: '0 6px 18px rgba(16,185,129,0.28)' }}>Log In</a>
          </div>
        </nav>

        <div className="hero-inner">
          <span className="eyebrow"><span className="pulse"></span> Project management platform</span>
          <h1>Project Manager, agent, and tenant workflows in one secure portal.</h1>
          <p className="hero-sub">Manage properties, assign agents, onboard tenants, collect payments, send notices, and track house problems from a single dashboard.</p>
          <div className="hero-ctas">
            <Link href="/login" className="btn btn-primary">Log In</Link>
            <Link href="/tenant/register" className="btn btn-ghost">Tenant Registration</Link>
          </div>
        </div>

<div className="floats">
           <div className="float-card float-1"><div className="row"><span className="dot"></span> Rent collected</div></div>
           <div className="float-card float-2"><div className="row"><span className="dot"></span> Agent assigned</div></div>
           <div className="float-card float-3"><div className="row"><span className="dot"></span> Tenant support</div></div>
           <div className="float-card float-4"><div className="row"><span className="dot"></span> Secure portal</div></div>
           <div className="float-card float-5"><div className="row"><span className="dot"></span> Quick setup</div></div>
           <div className="float-card float-6"><div className="row"><span className="dot"></span> Real-time sync</div></div>
         </div>
      </section>

      <section className="bento-section">
        <div className="bento">
          <article className="card card-pm">
<div className="card-label"><span className="badge badge-pm"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M3 21h18"/><path d="M5 21V7l8-4v18"/><path d="M19 21V11l-6-4"/></svg></span>Project Manager Workspace</div>
             <h3>Control your property portfolio.</h3>
             <p>Create properties, assign agents, add tenants, review payments, and monitor balances from the project manager dashboard.</p>
             <Link href="/login" className="card-cta">Project Manager Login <svg className="arrow" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="5" y1="12" x2="19" y2="12"/><polyline points="12 5 19 12 12 19"/></svg></Link>
          </article>

          <article className="card card-agent">
            <div className="card-label"><span className="badge badge-agent"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13 a4 0 0 1 0 7.75"/></svg></span>Agent Access</div>
            <h3>Manage assigned units.</h3>
            <p>Agents see only the property assigned by the project manager and can add tenants, send notices, and review complaints.</p>
            <Link href="/login" className="card-cta">Agent Login <svg className="arrow" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="5" y1="12" x2="19" y2="12"/><polyline points="12 5 19 12 12 19"/></svg></Link>
          </article>

          <article className="card card-feat card-feat-1">
            <div className="feat-icon" style={{ background: 'var(--accent)' }}><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="1" y="4" width="22" height="16" rx="2"/><line x1="1" y1="10" x2="23" y2="10"/></svg></div>
            <h3>Tenant Dashboard</h3>
            <p>Tenants view apartment details, payment history, next payment date, notices, and house problems raised to their agent.</p>
          </article>

          <article className="card card-feat card-feat-2">
            <div className="feat-icon" style={{ background: 'var(--navy-700)' }}><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg></div>
            <h3>Secure Roles</h3>
            <p>Role-based routing keeps project manager pages hidden from tenants and limits agents to their assigned property.</p>
          </article>

          <article className="card card-feat card-feat-3">
            <div className="feat-icon" style={{ background: '#0ea5e9' }}><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/></svg></div>
            <h3>Payment Tracking</h3>
            <p>Record transactions, calculate due dates, and keep rent balances visible across tenants and properties.</p>
          </article>
        </div>
      </section>

      <footer>
        <div className="footer-inner">
          <div className="footer-brand">
            <span className="logo-mark" style={{ width: 26, height: 26, borderRadius: 7 }}><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M3 21h18"/><path d="M5 21V7l8-4v18"/><path d="M19 21V11l-6-4"/></svg></span>
            Springfield Systems
          </div>
          <div className="footer-copy">© 2026 Springfield Systems. All rights reserved.</div>
        </div>
      </footer>
    </>
  );
}
