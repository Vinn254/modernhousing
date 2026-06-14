'use client';

import Link from 'next/link';

interface Subscription {
  id: string;
  admin: string;
  email: string;
  plan: string;
  amount: number;
  startDate: string;
  expiryDate: string;
  paymentStatus: 'paid' | 'pending' | 'overdue';
  status: 'active' | 'expired' | 'expiring-soon';
}

interface TenantPayment {
  id: string;
  tenant: string;
  property: string;
  amount: number;
  type: string;
  date: string;
  status: string;
}

const subscriptions: Subscription[] = [
  { id: '1', admin: 'Admin User', email: 'admin@springfield.com', plan: 'Premium', amount: 2500, startDate: '2024-01-01', expiryDate: '2025-01-01', paymentStatus: 'paid', status: 'active' },
  { id: '2', admin: 'Main Admin', email: 'admin@main.com', plan: 'Standard', amount: 1500, startDate: '2024-02-15', expiryDate: '2024-08-15', paymentStatus: 'pending', status: 'expiring-soon' },
  { id: '3', admin: 'Legacy Admin', email: 'admin@legacy.com', plan: 'Basic', amount: 500, startDate: '2023-06-01', expiryDate: '2024-06-01', paymentStatus: 'overdue', status: 'expired' },
];

const payments: TenantPayment[] = [
  { id: '1', tenant: 'Mike Johnson', property: 'Sunset Apartments', amount: 120000, type: 'Rent', date: '2024-01-15', status: 'Paid' },
  { id: '2', tenant: 'Sarah Wilson', property: 'Sunset Apartments', amount: 120000, type: 'Rent', date: '2024-01-14', status: 'Pending' },
  { id: '3', tenant: 'Tom Brown', property: 'Ocean View Residences', amount: 150000, type: 'Rent', date: '2024-01-13', status: 'Paid' },
  { id: '4', tenant: 'Lisa Davis', property: 'Ocean View Residences', amount: 150000, type: 'Service Charge', date: '2024-01-12', status: 'Paid' },
  { id: '5', tenant: 'Alex Chen', property: 'Sunset Apartments', amount: 130000, type: 'Rent', date: '2024-01-11', status: 'Overdue' },
];

const totalProperties = 12;
const totalTenants = 45;
const totalPaidSubscriptions = subscriptions.filter(s => s.paymentStatus === 'paid').reduce((sum, s) => sum + s.amount, 0);
const totalPendingAmount = subscriptions.filter(s => s.paymentStatus === 'pending').reduce((sum, s) => sum + s.amount, 0);
const totalOverdueAmount = subscriptions.filter(s => s.paymentStatus === 'overdue').reduce((sum, s) => sum + s.amount, 0);

export default function PaymentsPage() {
  const activeSubscriptions = subscriptions.filter(s => s.status === 'active').length;
  const expiringSubscriptions = subscriptions.filter(s => s.status === 'expiring-soon').length;
  const expiredSubscriptions = subscriptions.filter(s => s.status === 'expired').length;

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
          </div>
        </nav>

        <div className="hero-inner">
          <span className="eyebrow">
            <span className="pulse"></span>
            Super Admin
          </span>

          <h1>Payments</h1>

          <p className="hero-sub">
            Review all payment transactions, admin subscriptions, and financial analytics.
          </p>
        </div>
      </section>

      {/* BENTO */}
      <section className="bento-section">
        <div className="bento">

          <article className="card card-pm" style={{ gridColumn: 'span 12' }}>
            <div className="card-label">
              <span className="badge badge-pay">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><rect x="1" y="4" width="22" height="16" rx="2"/><line x1="1" y1="10" x2="23" y2="10"/></svg>
              </span>
              Admin Subscriptions
            </div>
            <h3 style={{ marginBottom: 16 }}>Subscription Payments & Status</h3>

            <div style={{ display: 'flex', gap: 16, marginBottom: 20 }}>
              <div style={{ flex: 1, padding: 16, background: 'var(--accent-soft)', borderRadius: 10, textAlign: 'center' }}>
                <span style={{ fontSize: 11, color: 'var(--ink-3)', display: 'block', marginBottom: 4, textTransform: 'uppercase' }}>Paid</span>
                <span style={{ fontSize: 24, fontWeight: 700, color: 'var(--accent)' }}>KSH {totalPaidSubscriptions.toLocaleString()}</span>
              </div>
              <div style={{ flex: 1, padding: 16, background: 'rgba(245,158,11,0.1)', borderRadius: 10, textAlign: 'center' }}>
                <span style={{ fontSize: 11, color: 'var(--ink-3)', display: 'block', marginBottom: 4, textTransform: 'uppercase' }}>Pending</span>
                <span style={{ fontSize: 24, fontWeight: 700, color: 'var(--amber)' }}>KSH {totalPendingAmount.toLocaleString()}</span>
              </div>
              <div style={{ flex: 1, padding: 16, background: 'rgba(220,38,38,0.1)', borderRadius: 10, textAlign: 'center' }}>
                <span style={{ fontSize: 11, color: 'var(--ink-3)', display: 'block', marginBottom: 4, textTransform: 'uppercase' }}>Overdue</span>
                <span style={{ fontSize: 24, fontWeight: 700, color: '#dc2626' }}>KSH {totalOverdueAmount.toLocaleString()}</span>
              </div>
            </div>

            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '14px' }}>
                <thead>
                  <tr style={{ borderBottom: '1px solid var(--line)' }}>
                    <th style={{ textAlign: 'left', padding: '12px 12px', fontWeight: 600, color: 'var(--ink-2)' }}>Admin</th>
                    <th style={{ textAlign: 'left', padding: '12px 12px', fontWeight: 600, color: 'var(--ink-2)' }}>Email</th>
                    <th style={{ textAlign: 'left', padding: '12px 12px', fontWeight: 600, color: 'var(--ink-2)' }}>Plan</th>
                    <th style={{ textAlign: 'left', padding: '12px 12px', fontWeight: 600, color: 'var(--ink-2)' }}>Amount</th>
                    <th style={{ textAlign: 'left', padding: '12px 12px', fontWeight: 600, color: 'var(--ink-2)' }}>Start Date</th>
                    <th style={{ textAlign: 'left', padding: '12px 12px', fontWeight: 600, color: 'var(--ink-2)' }}>Expiry Date</th>
                    <th style={{ textAlign: 'left', padding: '12px 12px', fontWeight: 600, color: 'var(--ink-2)' }}>Payment Status</th>
                    <th style={{ textAlign: 'left', padding: '12px 12px', fontWeight: 600, color: 'var(--ink-2)' }}>Sub Status</th>
                  </tr>
                </thead>
                <tbody>
                  {subscriptions.map((sub) => (
                    <tr key={sub.id} style={{ borderBottom: '1px solid var(--line-soft)' }}>
                      <td style={{ padding: '16px 12px 16px 0', fontWeight: 500 }}>{sub.admin}</td>
                      <td style={{ padding: '16px 12px', color: 'var(--ink-3)' }}>{sub.email}</td>
                      <td style={{ padding: '16px 12px' }}>{sub.plan}</td>
                      <td style={{ padding: '16px 12px', fontWeight: 600, color: 'var(--accent)' }}>KSH {sub.amount.toLocaleString()}/mo</td>
                      <td style={{ padding: '16px 12px', color: 'var(--ink-3)' }}>{sub.startDate}</td>
                      <td style={{ padding: '16px 12px', color: 'var(--ink-3)' }}>{sub.expiryDate}</td>
                      <td style={{ padding: '16px 12px' }}>
                        <span style={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '6px',
                          padding: '4px 12px',
                          borderRadius: '999px',
                          fontSize: '12px',
                          fontWeight: 500,
                          backgroundColor: sub.paymentStatus === 'paid' ? 'var(--accent-soft)' :
                            sub.paymentStatus === 'pending' ? 'rgba(245,158,11,0.1)' : 'rgba(220,38,38,0.1)',
                          color: sub.paymentStatus === 'paid' ? 'var(--accent)' :
                            sub.paymentStatus === 'pending' ? 'var(--amber)' : '#dc2626'
                        }}>
                          <span style={{
                            width: '6px',
                            height: '6px',
                            borderRadius: '50%',
                            backgroundColor: sub.paymentStatus === 'paid' ? 'var(--accent)' :
                              sub.paymentStatus === 'pending' ? 'var(--amber)' : '#dc2626'
                          }}></span>
                          {sub.paymentStatus === 'paid' ? 'Paid' :
                            sub.paymentStatus === 'pending' ? 'Pending' : 'Overdue'}
                        </span>
                      </td>
                      <td style={{ padding: '16px 12px' }}>
                        <span style={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '6px',
                          padding: '4px 12px',
                          borderRadius: '999px',
                          fontSize: '12px',
                          fontWeight: 500,
                          backgroundColor: sub.status === 'active' ? 'var(--accent-soft)' :
                            sub.status === 'expiring-soon' ? 'rgba(245,158,11,0.1)' : 'rgba(220,38,38,0.1)',
                          color: sub.status === 'active' ? 'var(--accent)' :
                            sub.status === 'expiring-soon' ? 'var(--amber)' : '#dc2626'
                        }}>
                          <span style={{
                            width: '6px',
                            height: '6px',
                            borderRadius: '50%',
                            backgroundColor: sub.status === 'active' ? 'var(--accent)' :
                              sub.status === 'expiring-soon' ? 'var(--amber)' : '#dc2626'
                          }}></span>
                          {sub.status === 'active' ? 'Active' :
                            sub.status === 'expiring-soon' ? 'Expiring Soon' : 'Expired'}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </article>

          <article className="card card-agent" style={{ gridColumn: 'span 12' }}>
            <div className="card-label">
              <span className="badge badge-agent">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>
              </span>
              System Overview
            </div>
            <h3 style={{ marginBottom: 16 }}>Properties & Tenants Summary</h3>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 16 }}>
              <div style={{ padding: 20, background: 'var(--line-soft)', borderRadius: 12, textAlign: 'center' }}>
                <div style={{ fontSize: 28, fontWeight: 700, color: 'var(--ink)', marginBottom: 4 }}>{totalProperties}</div>
                <div style={{ fontSize: 12, color: 'var(--ink-3)', textTransform: 'uppercase', letterSpacing: 0.05 }}>Total Properties</div>
              </div>
              <div style={{ padding: 20, background: 'var(--line-soft)', borderRadius: 12, textAlign: 'center' }}>
                <div style={{ fontSize: 28, fontWeight: 700, color: 'var(--ink)', marginBottom: 4 }}>{totalTenants}</div>
                <div style={{ fontSize: 12, color: 'var(--ink-3)', textTransform: 'uppercase', letterSpacing: 0.05 }}>Total Tenants</div>
              </div>
              <div style={{ padding: 20, background: 'var(--line-soft)', borderRadius: 12, textAlign: 'center' }}>
                <div style={{ fontSize: 28, fontWeight: 700, color: 'var(--accent)', marginBottom: 4 }}>KSH {(payments.reduce((sum, p) => sum + p.amount, 0) / 1000).toFixed(0)}K</div>
                <div style={{ fontSize: 12, color: 'var(--ink-3)', textTransform: 'uppercase', letterSpacing: 0.05 }}>Monthly Volume</div>
              </div>
            </div>

            <div style={{ display: 'flex', gap: 12, marginTop: 20 }}>
              <div style={{ flex: 1, padding: 16, background: 'var(--accent-soft)', borderRadius: 10 }}>
                <span style={{ fontSize: 12, color: 'var(--ink-3)', display: 'block', marginBottom: 4 }}>Active Subscriptions</span>
                <span style={{ fontSize: 22, fontWeight: 600, color: 'var(--accent)' }}>{activeSubscriptions}</span>
              </div>
              <div style={{ flex: 1, padding: 16, background: 'rgba(245,158,11,0.1)', borderRadius: 10 }}>
                <span style={{ fontSize: 12, color: 'var(--ink-3)', display: 'block', marginBottom: 4 }}>Expiring Soon</span>
                <span style={{ fontSize: 22, fontWeight: 600, color: 'var(--amber)' }}>{expiringSubscriptions}</span>
              </div>
              <div style={{ flex: 1, padding: 16, background: 'rgba(220,38,38,0.1)', borderRadius: 10 }}>
                <span style={{ fontSize: 12, color: 'var(--ink-3)', display: 'block', marginBottom: 4 }}>Expired</span>
                <span style={{ fontSize: 22, fontWeight: 600, color: '#dc2626' }}>{expiredSubscriptions}</span>
              </div>
            </div>
          </article>

          <article className="card" style={{ gridColumn: 'span 12' }}>
            <div className="card-label">
              <span className="badge badge-pay">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><rect x="1" y="4" width="22" height="16" rx="2"/><line x1="1" y1="10" x2="23" y2="10"/></svg>
              </span>
              Tenant Payments
            </div>
            <h3 style={{ marginBottom: 16 }}>All Payments</h3>

            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '14px' }}>
                <thead>
                  <tr style={{ borderBottom: '1px solid var(--line)' }}>
                    <th style={{ textAlign: 'left', padding: '12px 12px', fontWeight: 600, color: 'var(--ink-2)' }}>Tenant</th>
                    <th style={{ textAlign: 'left', padding: '12px 12px', fontWeight: 600, color: 'var(--ink-2)' }}>Property</th>
                    <th style={{ textAlign: 'left', padding: '12px 12px', fontWeight: 600, color: 'var(--ink-2)' }}>Amount</th>
                    <th style={{ textAlign: 'left', padding: '12px 12px', fontWeight: 600, color: 'var(--ink-2)' }}>Type</th>
                    <th style={{ textAlign: 'left', padding: '12px 12px', fontWeight: 600, color: 'var(--ink-2)' }}>Date</th>
                    <th style={{ textAlign: 'left', padding: '12px 12px', fontWeight: 600, color: 'var(--ink-2)' }}>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {payments.map((payment) => (
                    <tr key={payment.id} style={{ borderBottom: '1px solid var(--line-soft)' }}>
                      <td style={{ padding: '16px 12px 16px 0', fontWeight: 500 }}>{payment.tenant}</td>
                      <td style={{ padding: '16px 12px', color: 'var(--ink-3)' }}>{payment.property}</td>
                      <td style={{ padding: '16px 12px', fontWeight: 600, color: 'var(--accent)' }}>KSH {payment.amount.toLocaleString()}</td>
                      <td style={{ padding: '16px 12px' }}>{payment.type}</td>
                      <td style={{ padding: '16px 12px', color: 'var(--ink-3)' }}>{payment.date}</td>
                      <td style={{ padding: '16px 12px' }}>
                        <span style={{
                          display: 'inline-block',
                          padding: '4px 12px',
                          borderRadius: '999px',
                          fontSize: '12px',
                          fontWeight: 500,
                          background: payment.status === 'Paid' ? 'rgba(16,185,129,0.12)' : 
                            payment.status === 'Pending' ? 'rgba(245,158,11,0.12)' : 'rgba(220,38,38,0.12)',
                          color: payment.status === 'Paid' ? 'var(--accent)' : 
                            payment.status === 'Pending' ? 'var(--amber)' : '#dc2626'
                        }}>{payment.status}</span>
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
            <a href="/super-admin">Dashboard</a>
          </div>
          <div className="footer-copy">© 2024 Springfield Systems. All rights reserved.</div>
        </div>
      </footer>
    </>
  );
}