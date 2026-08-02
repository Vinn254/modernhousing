import Link from 'next/link';

export const metadata = {
  title: 'Springfield Systems - Property Management Platform',
  description: 'Comprehensive property management platform for landlords, agents, and tenants. Manage properties, tenants, payments, and leases in one workspace.',
  alternates: {
    canonical: '/',
  },
  openGraph: {
    title: 'Springfield Systems - Property Management Platform',
    description: 'Comprehensive property management platform for landlords, agents, and tenants.',
    url: 'https://modernhousing.vercel.app',
    siteName: 'Springfield Systems',
    type: 'website',
  },
};

export default function HomePage() {
  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'Organization',
    name: 'Springfield Systems',
    description: 'Property management platform for landlords, agents, and tenants',
    url: 'https://modernhousing.vercel.app',
    logo: 'https://modernhousing.vercel.app/logo.png',
    sameAs: [],
    contactPoint: {
      '@type': 'ContactPoint',
      email: 'support@springfieldsystems.com',
      contactType: 'customer service',
    },
  };

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
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
           <div className="float-card float-1" style={{ boxShadow: '0 0 18px rgba(16,185,129,.35), 0 0 40px rgba(16,185,129,.15)' }}><div className="row"><span className="dot"></span> Rent collected</div></div>
           <div className="float-card float-2" style={{ boxShadow: '0 0 18px rgba(16,185,129,.35), 0 0 40px rgba(16,185,129,.15)' }}><div className="row"><span className="dot"></span> Agent assigned</div></div>
           <div className="float-card float-3" style={{ boxShadow: '0 0 18px rgba(16,185,129,.35), 0 0 40px rgba(16,185,129,.15)' }}><div className="row"><span className="dot"></span> Tenant support</div></div>
           <div className="float-card float-4" style={{ boxShadow: '0 0 18px rgba(16,185,129,.35), 0 0 40px rgba(16,185,129,.15)' }}><div className="row"><span className="dot"></span> Secure portal</div></div>
           <div className="float-card float-5" style={{ boxShadow: '0 0 18px rgba(16,185,129,.35), 0 0 40px rgba(16,185,129,.15)' }}><div className="row"><span className="dot"></span> Quick setup</div></div>
           <div className="float-card float-6" style={{ boxShadow: '0 0 18px rgba(16,185,129,.35), 0 0 40px rgba(16,185,129,.15)' }}><div className="row"><span className="dot"></span> Real-time sync</div></div>
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

      <section className="split-section">
        <div className="split-grid">
          <div className="split-content">
            <span className="section-eyebrow">About Us</span>
            <h2>Built for modern property management in Kenya.</h2>
            <p>Springfield Systems streamlines rent collection, tenant onboarding, and property oversight for landlords, agents, and tenants. We combine secure role-based access with real-time notifications so every stakeholder stays aligned.</p>
            <p>Our platform handles leases, payments, complaints, and renewals in one workspace—reducing paperwork, missed follow-ups, and revenue leakage.</p>
            <div className="split-actions">
              <Link href="/login" className="btn btn-primary">Get started</Link>
              <Link href="/pricing" className="btn btn-ghost">View pricing</Link>
            </div>
          </div>
          <div className="split-visual">
            <div className="split-card split-card--animated">
              <div className="split-card__inner">
                <div className="split-card__icon"><svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 21h18"/><path d="M5 21V7l8-4v18"/><path d="M19 21V11l-6-4"/></svg></div>
                <h3>Property-first design</h3>
                <p>From unit-level tracking to portfolio-level reporting, every feature is built around real property workflows.</p>
                <div className="card-metric">2,400+</div>
                <div className="card-metric-label">Units managed</div>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="split-section reverse">
        <div className="split-grid">
          <div className="split-content">
            <span className="section-eyebrow">Contact Us</span>
            <h2>Talk to our support team.</h2>
            <p>Need help with onboarding, subscriptions, or integrations? Reach out and we will respond within one business day. For urgent issues, use the in-app support chat.</p>
            <p><strong>Email:</strong> support@springfieldsystems.com<br /><strong>Phone:</strong> +254 700 000 000<br /><strong>Hours:</strong> Mon-Fri, 8:00 AM - 6:00 PM EAT</p>
            <div className="split-actions">
              <Link href="mailto:support@springfieldsystems.com" className="btn btn-primary">Email us</Link>
              <Link href="/help" className="btn btn-ghost">Visit help center</Link>
            </div>
          </div>
          <div className="split-visual">
            <div className="split-card">
              <div className="split-card__inner">
                <div className="split-card__icon"><svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg></div>
                <h3>We are here to help</h3>
                <p>Average response time is under 4 hours during business days.</p>
                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', justifyContent: 'center' }}>
                  <span style={{ padding: '6px 12px', borderRadius: 999, background: 'var(--accent-soft)', color: 'var(--accent)', fontSize: 12, fontWeight: 700 }}>Live chat</span>
                  <span style={{ padding: '6px 12px', borderRadius: 999, background: 'rgba(14,165,233,0.12)', color: '#0284c7', fontSize: 12, fontWeight: 700 }}>Email</span>
                  <span style={{ padding: '6px 12px', borderRadius: 999, background: 'rgba(245,158,11,0.12)', color: '#b45309', fontSize: 12, fontWeight: 700 }}>Phone</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="split-section">
        <div className="split-grid">
          <div className="split-content">
            <span className="section-eyebrow">Terms of Service</span>
            <h2>Clear terms for fair use.</h2>
            <p><strong>1. Account access.</strong> You are responsible for keeping your login secure. Do not share credentials.</p>
            <p><strong>2. Payments.</strong> Rent collected through Springfield Systems may include a platform fee. Payouts to landlords are processed within 1 business day after tenant payment confirmation.</p>
            <p><strong>3. Data.</strong> We use your data only to operate the platform and improve services. We do not sell personal information.</p>
            <p><strong>4. Termination.</strong> Accounts may be suspended for misuse, fraud, or violation of these terms.</p>
            <div className="split-actions">
              <Link href="/terms" className="btn btn-primary">Read full terms</Link>
            </div>
          </div>
          <div className="split-visual">
            <div className="split-card split-card--animated">
              <div className="split-card__inner">
                <div className="split-card__icon"><svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/></svg></div>
                <h3>Transparent policies</h3>
                <p>No hidden clauses. We publish plain-language terms so you know exactly what to expect.</p>
                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', justifyContent: 'center' }}>
                  <span style={{ padding: '6px 12px', borderRadius: 999, background: 'var(--accent-soft)', color: 'var(--accent)', fontSize: 12, fontWeight: 700 }}>Plain language</span>
                  <span style={{ padding: '6px 12px', borderRadius: 999, background: 'rgba(14,165,233,0.12)', color: '#0284c7', fontSize: 12, fontWeight: 700 }}>Fair use</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="split-section reverse">
        <div className="split-grid">
          <div className="split-content">
            <span className="section-eyebrow">Refund Policy</span>
            <h2>Simple refunds, no drama.</h2>
            <p><strong>1. Subscription refunds.</strong> If you cancel within 14 days of a new subscription purchase, we will refund the full amount.</p>
            <p><strong>2. Processing refunds.</strong> Refunds are issued to the original payment method within 5-10 business days.</p>
            <p><strong>3. Partial months.</strong> We do not prorate partial months. Cancel before renewal to avoid future charges.</p>
            <p><strong>4. Chargebacks.</strong> If a chargeback is filed without contacting support first, the account may be suspended pending review.</p>
            <div className="split-actions">
              <Link href="/refund-policy" className="btn btn-primary">View refund policy</Link>
            </div>
          </div>
          <div className="split-visual">
            <div className="split-card">
              <div className="split-card__inner">
                <div className="split-card__icon"><svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><path d="M16 8l-4 4-2-2"/></svg></div>
                <h3>Hassle-free cancellations</h3>
                <p>Cancel anytime from your dashboard. No emails, no waiting on hold.</p>
                <div className="card-metric">14 days</div>
                <div className="card-metric-label">Money-back guarantee</div>
              </div>
            </div>
          </div>
        </div>
      </section>
    </>
  );
}
