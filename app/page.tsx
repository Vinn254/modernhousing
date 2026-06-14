'use client';

import { useState, useRef, useEffect } from 'react';
import Link from 'next/link';

export default function Home() {
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

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
            <a href="/">Home</a>
            <a href="/signup">Account</a>
            <Link href="/login" className="nav-cta">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M15 3h4a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-4"/><polyline points="10 7 15 12 10 17"/><line x1="15" y1="12" x2="3" y2="12"/></svg>
              Log In
            </Link>
          </div>
        </nav>

        <div className="hero-inner">
          <span className="eyebrow">
            <span className="pulse"></span>
            Apartment management, modernized
          </span>

          <h1>Springfield Systems</h1>

          <p className="hero-sub">
            Professional apartment management platform for project managers and agents.
            Streamline properties, units, tenants, and payments in one secure system.
          </p>

          <div className="hero-ctas">
            <Link href="/signup" className="btn btn-primary">
              Get Started
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="5" y1="12" x2="19" y2="12"/><polyline points="12 5 19 12 12 19"/></svg>
            </Link>
            <Link href="/login" className="btn btn-ghost">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M15 3h4a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-4"/><polyline points="10 7 15 12 10 17"/><line x1="15" y1="12" x2="3" y2="12"/></svg>
              Sign In
            </Link>
          </div>
        </div>

        <div className="floats">
          <div className="float-card float-1">
            <div className="row"><span className="dot" style={{background:'var(--accent)'}}></span> Oakwood Apartments · 92% occupied</div>
          </div>
          <div className="float-card float-2">
            <div className="row"><span className="dot" style={{background:'var(--amber)'}}></span> 3 maintenance tickets pending</div>
          </div>
          <div className="float-card float-3">
            <div className="row"><span className="dot" style={{background:'var(--rose)'}}></span> Rent received · Unit 4B</div>
          </div>
        </div>
      </section>

      {/* BENTO */}
      <section className="bento-section">
        <div className="bento">

          <article className="card card-pm">
            <div className="card-label">
              <span className="badge badge-pm">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>
              </span>
              Project Manager
            </div>
            <h3>Run your entire portfolio from one place.</h3>
            <p>Self-register to manage properties, units, tenants, and payments. Create your organization and start managing your portfolio with full visibility into occupancy, finances, and maintenance.</p>

            <div className="pm-visual">
              <div className="pm-stat">
                <div className="num">12</div>
                <div className="lbl">Properties</div>
              </div>
              <div className="pm-stat">
                <div className="num">148</div>
                <div className="lbl">Units</div>
              </div>
              <div className="pm-stat">
                <div className="num">94%</div>
                <div className="lbl">Occupied</div>
              </div>
            </div>

            <Link href="/signup" className="card-cta accent">
              Get Started
              <svg className="arrow" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="5" y1="12" x2="19" y2="12"/><polyline points="12 5 19 12 12 19"/></svg>
            </Link>
          </article>

          <article className="card card-agent">
            <div className="card-label">
              <span className="badge badge-agent">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M16 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="8.5" cy="7" r="4"/><line x1="20" y1="8" x2="20" y2="14"/><line x1="23" y1="11" x2="17" y2="11"/></svg>
              </span>
              Agent
            </div>
            <h3>Get assigned. Get to work.</h3>
            <p>Assigned to units by PMs. Log in only after receiving your project assignment and access tenant information, lease details, and payment records.</p>

            <div className="agent-flow">
              <div className="flow-step">
                <span className="step-num">1</span>
                PM assigns you to a unit
              </div>
              <div className="flow-step">
                <span className="step-num">2</span>
                Receive your login credentials
              </div>
              <div className="flow-step">
                <span className="step-num">3</span>
                Manage tenants & leases
              </div>
            </div>

            <Link href="/login" className="card-cta">
              Access Portal
              <svg className="arrow" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="5" y1="12" x2="19" y2="12"/><polyline points="12 5 19 12 12 19"/></svg>
            </Link>
          </article>

          <article className="card card-feat card-feat-1">
            <div className="feat-icon" style={{backgroundColor:'var(--accent)'}}>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="1" y="4" width="22" height="16" rx="2"/><line x1="1" y1="10" x2="23" y2="10"/></svg>
            </div>
            <h3>Track every payment</h3>
            <p>Rent, utilities, overdue settlements — all logged with running balances per tenant.</p>
          </article>

          <article className="card card-feat card-feat-2">
            <div className="feat-icon" style={{backgroundColor:'var(--navy-700)'}}>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>
            </div>
            <h3>Bank-grade security</h3>
            <p>Row-level security, role-gated access, and full audit trails on every action.</p>
          </article>

          <article className="card card-feat card-feat-3">
            <div className="feat-icon" style={{backgroundColor:'var(--rose)'}}>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/></svg>
            </div>
            <h3>Built for scale</h3>
            <p>From a single building to a multi-property portfolio — your dashboard grows with you.</p>
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
            <a href="/signup">Account</a>
            <a href="/login">Log In</a>
          </div>
          <div className="footer-copy">© 2024 Springfield Systems. All rights reserved.</div>
        </div>
      </footer>
    </>
  );
}