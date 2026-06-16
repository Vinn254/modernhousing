'use client';

import { useState } from 'react';
import Link from 'next/link';
import AdminTopNav from '../../components/AdminTopNav';

interface Payment {
  id: string;
  tenant: string;
  unit: string;
  property: string;
  amount: number;
  date: string;
  status: string;
  pm: string;
}

export default function PaymentsPage() {
  const [payments, setPayments] = useState<Payment[]>([
    { id: '1', tenant: 'Mike Johnson', unit: 'A-101', property: 'Sunset Apartments', amount: 120000, date: '2024-06-01', status: 'paid', pm: 'Jane Doe' },
    { id: '2', tenant: 'Sarah Wilson', unit: 'A-102', property: 'Sunset Apartments', amount: 120000, date: '2024-06-01', status: 'paid', pm: 'Jane Doe' },
    { id: '3', tenant: 'Lisa Davis', unit: 'C-101', property: 'Ocean View Residences', amount: 130000, date: '2024-05-28', status: 'paid', pm: 'John Smith' },
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
          <AdminTopNav variant="admin" />
        </nav>

        <div className="hero-inner">
          <span className="eyebrow">
            <span className="pulse"></span>
            Admin Portal
          </span>

          <h1>Payments Oversight</h1>

          <p className="hero-sub">
            Monitor payment transactions and verify balances.
          </p>
        </div>
      </section>

      {/* BENTO */}
      <section className="bento-section">
        <div className="bento">

          <article className="card card-pm" style={{ gridColumn: 'span 12' }}>
            <div className="card-label">
              <span className="badge badge-pm">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><rect x="1" y="4" width="22" height="16" rx="2"/><line x1="1" y1="10" x2="23" y2="10"/></svg>
              </span>
              Payments
            </div>
            <h3 style={{ marginBottom: 16 }}>All Transactions</h3>

            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '14px' }}>
                <thead>
                  <tr style={{ borderBottom: '1px solid var(--line)' }}>
                    <th style={{ textAlign: 'left', padding: '12px 12px', fontWeight: 600, color: 'var(--ink-2)' }}>Tenant</th>
                    <th style={{ textAlign: 'left', padding: '12px 12px', fontWeight: 600, color: 'var(--ink-2)' }}>Unit</th>
                    <th style={{ textAlign: 'left', padding: '12px 12px', fontWeight: 600, color: 'var(--ink-2)' }}>Amount</th>
                    <th style={{ textAlign: 'left', padding: '12px 12px', fontWeight: 600, color: 'var(--ink-2)' }}>Date</th>
                    <th style={{ textAlign: 'left', padding: '12px 12px', fontWeight: 600, color: 'var(--ink-2)' }}>Status</th>
                    <th style={{ textAlign: 'left', padding: '12px 12px', fontWeight: 600, color: 'var(--ink-2)' }}>Landlord</th>
                  </tr>
                </thead>
                <tbody>
                  {payments.map((payment) => (
                    <tr key={payment.id} style={{ borderBottom: '1px solid var(--line-soft)' }}>
                      <td style={{ padding: '16px 12px 16px 0', fontWeight: 500 }}>{payment.tenant}</td>
                      <td style={{ padding: '16px 12px' }}>{payment.unit}</td>
                      <td style={{ padding: '16px 12px', fontWeight: 600, color: 'var(--accent)' }}>KSH {payment.amount.toLocaleString()}</td>
                      <td style={{ padding: '16px 12px', color: 'var(--ink-3)' }}>{payment.date}</td>
                      <td style={{ padding: '16px 12px' }}>
                        <span style={{
                          display: 'inline-block',
                          padding: '4px 12px',
                          borderRadius: '999px',
                          fontSize: '12px',
                          fontWeight: 500,
                          background: payment.status === 'paid' ? 'rgba(16,185,129,0.12)' : 'rgba(220,38,38,0.12)',
                          color: payment.status === 'paid' ? 'var(--accent)' : '#dc2626'
                        }}>{payment.status.toUpperCase()}</span>
                      </td>
                      <td style={{ padding: '16px 12px', color: 'var(--accent-bright)', fontWeight: 500 }}>{payment.pm}</td>
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