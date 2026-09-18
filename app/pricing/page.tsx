'use client';

import { Suspense } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';

const plans = [
  {
    name: 'Monthly',
    price: 'KSH 2,500',
    duration: 'month',
    description: 'Best for project managers managing one or two properties.',
    features: ['Project manager dashboard', 'Agent assignment', 'Tenant onboarding', 'Payment tracking', 'Renewal reminders'],
  },
  {
    name: 'Quarterly',
    price: 'KSH 5,000',
    duration: 'quarter',
    description: 'Save with a three-month subscription package.',
    features: ['Everything in Monthly', 'Quarterly renewal cycle', 'Priority support', 'Subscription monitoring', 'Workspace access'],
    popular: true,
  },
  {
    name: 'Yearly',
    price: 'KSH 6,000',
    duration: 'year',
    description: 'Best value for long-term project manager workspace access.',
    features: ['Everything in Quarterly', 'Annual renewal cycle', 'Reduced monthly cost', 'Advanced renewal tracking', 'Priority account support'],
  },
];

function PricingContent() {
  const searchParams = useSearchParams();
  const restricted = searchParams.get('restricted') === 'true';

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify({
          '@context': 'https://schema.org',
          '@type': 'Product',
          name: 'Springfield Systems Subscription',
          description: 'Property management subscription plans for landlords and agents.',
          offers: plans.map(plan => ({ '@type': 'Offer', name: plan.name, price: plan.price, priceCurrency: 'KES' }))
        }) }}
      />
      <main>
      <section className="hero">
        <nav className="nav">
          <Link href="/" className="logo">
            <span className="logo-mark">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M3 21h18"/><path d="M5 21V7l8-4v18"/><path d="M19 21V11l-6-4"/></svg>
            </span>
          </Link>
          <div className="nav-links">
            <a href="/pricing" className="nav-pricing-link" style={{ color: '#fff', textDecoration: 'none', fontWeight: 800 }}>Pricing</a>
            <a href="/login" className="nav-login" style={{ display: 'inline-flex', alignItems: 'center', padding: '9px 16px', borderRadius: '999px', background: 'linear-gradient(135deg, #10b981, #34d399)', border: '1px solid rgba(52,211,153,0.35)', fontSize: 13, fontWeight: 800, color: '#052e1f', textDecoration: 'none', boxShadow: '0 6px 18px rgba(16,185,129,0.28)' }}>Log In</a>
          </div>
        </nav>

<div className="pricing-hero-inner">
           <span className="eyebrow"><span className="pulse"></span> Subscription Packages</span>
           <h1>{restricted ? 'Subscription Required' : 'Choose a project manager workspace plan.'}</h1>
           <p className="hero-sub">
             {restricted
               ? 'Your subscription has expired. Renew below to regain access to your workspace.'
               : 'Simple subscription packages for project managers who need secure property, agent, tenant, and payment management.'}
           </p>
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

      <section className="pricing-section">
        <div className="pricing-grid">
          {plans.map((plan) => (
            <article className={`pricing-card ${plan.popular ? 'popular' : ''}`} key={plan.name}>
              {plan.popular && <span className="pricing-badge">Most Popular</span>}
              <div className="pricing-card-header">
                <span>{plan.name}</span>
                <strong>{plan.price}</strong>
              </div>
              <p>{plan.description}</p>
              <ul>
                {plan.features.map((feature) => (
                  <li key={feature}>
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
                    {feature}
                  </li>
                ))}
              </ul>
              <Link href={`/login?subscribe=${plan.duration}${restricted ? '&restricted=true' : ''}`} className="pricing-button">Choose {plan.name}</Link>
            </article>
          ))}
        </div>
      </section>

      <section className="split-section">
        <div className="split-grid">
          <div className="split-content">
            <span className="section-eyebrow">Payment Options</span>
            <h2>Flexible payment methods.</h2>
            <p><strong>Option 1: Subscription fee.</strong> Pay a fixed monthly, quarterly, or yearly subscription fee to access the platform.</p>
            <p><strong>Option 2: Pay-per-use (1% platform fee).</strong> Alternatively, you can choose to pay a <strong>1% platform fee</strong> deducted automatically from every rent payment processed through the app. No upfront subscription required.</p>
            <p>Both options give you full access to all features. You can switch between them from your dashboard settings.</p>
            <div className="split-actions">
              <Link href="/login" className="btn btn-primary">Get started</Link>
              <Link href="/pricing" className="btn btn-primary" style={{ background: 'linear-gradient(135deg, #6366f1, #4f46e5)', borderColor: 'transparent' }}>View pricing</Link>
            </div>
          </div>
          <div className="split-visual">
            <div className="split-card split-card--animated">
              <div className="split-card__inner">
                <div className="split-card__icon"><svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="1" y="4" width="22" height="16" rx="2"/><line x1="1" y1="10" x2="23" y2="10"/></svg></div>
                <h3>Choose your payment style</h3>
                <p>Fixed subscription or pay-as-you-go with 1% per transaction.</p>
                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', justifyContent: 'center' }}>
                  <span style={{ padding: '6px 12px', borderRadius: 999, background: 'var(--accent-soft)', color: 'var(--accent)', fontSize: 12, fontWeight: 700 }}>Subscription</span>
                  <span style={{ padding: '6px 12px', borderRadius: 999, background: 'rgba(14,165,233,0.12)', color: '#0284c7', fontSize: 12, fontWeight: 700 }}>1% per rent</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      <footer>
        <div className="footer-inner">
          <div className="footer-brand"><span className="logo-mark" style={{ width: 26, height: 26, borderRadius: 7 }}><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M3 21h18"/><path d="M5 21V7l8-4v18"/><path d="M19 21V11l-6-4"/></svg></span>Springfield Systems</div>
          <div className="footer-copy">© 2026 Springfield Systems. All rights reserved.</div>
        </div>
      </footer>
      </main>
    </>
  );
}

export default function PricingPage() {
  return (
    <Suspense fallback={<div style={{ padding: '40px', display: 'flex', justifyContent: 'center' }}>Loading…</div>}>
      <PricingContent />
    </Suspense>
  );
}
