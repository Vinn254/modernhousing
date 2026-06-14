'use client';

import { useState } from 'react';
import Link from 'next/link';

interface Announcement {
  id: string;
  title: string;
  message: string;
  audience: string;
  date: string;
  status: string;
}

export default function CommunicationsPage() {
  const [announcements, setAnnouncements] = useState<Announcement[]>([
    { id: '1', title: 'System Maintenance', message: 'Scheduled maintenance on June 15th at 8PM', audience: 'All Users', date: '2024-06-10', status: 'sent' },
    { id: '2', title: 'New Feature', message: 'New payment tracking features now available', audience: 'Active Tenants', date: '2024-06-08', status: 'sent' },
  ]);
  const [showSendModal, setShowSendModal] = useState(false);

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
            <a href="/admin">Dashboard</a>
            <a href="/admin/project-managers">Project Managers</a>
            <a href="/admin/tenants">Tenants</a>
            <a href="/admin/payments">Payments</a>
          </div>
        </nav>

        <div className="hero-inner">
          <span className="eyebrow">
            <span className="pulse"></span>
            Admin Portal
          </span>

          <h1>Communications</h1>

          <p className="hero-sub">
            Manage system-wide announcements and notifications.
          </p>
        </div>
      </section>

      {/* BENTO */}
      <section className="bento-section">
        <div className="bento">

          <article className="card card-pm" style={{ gridColumn: 'span 12' }}>
            <div className="card-label">
              <span className="badge badge-pm">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>
              </span>
              Announcements
            </div>
            <h3 style={{ marginBottom: 16 }}>Recent Announcements</h3>

            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '14px' }}>
                <thead>
                  <tr style={{ borderBottom: '1px solid var(--line)' }}>
                    <th style={{ textAlign: 'left', padding: '12px 12px', fontWeight: 600, color: 'var(--ink-2)' }}>Title</th>
                    <th style={{ textAlign: 'left', padding: '12px 12px', fontWeight: 600, color: 'var(--ink-2)' }}>Message</th>
                    <th style={{ textAlign: 'left', padding: '12px 12px', fontWeight: 600, color: 'var(--ink-2)' }}>Audience</th>
                    <th style={{ textAlign: 'left', padding: '12px 12px', fontWeight: 600, color: 'var(--ink-2)' }}>Date</th>
                  </tr>
                </thead>
                <tbody>
                  {announcements.map((a) => (
                    <tr key={a.id} style={{ borderBottom: '1px solid var(--line-soft)' }}>
                      <td style={{ padding: '16px 12px 16px 0', fontWeight: 500 }}>{a.title}</td>
                      <td style={{ padding: '16px 12px', color: 'var(--ink-3)' }}>{a.message}</td>
                      <td style={{ padding: '16px 12px' }}>{a.audience}</td>
                      <td style={{ padding: '16px 12px', color: 'var(--ink-3)' }}>{a.date}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <button onClick={() => setShowSendModal(true)} className="card-cta" style={{ marginTop: 24 }}>
              Send Announcement
              <svg className="arrow" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="5" y1="12" x2="19" y2="12"/><polyline points="12 5 19 12 12 19"/></svg>
            </button>
          </article>

        </div>
      </section>

      {showSendModal && (
        <div className="modal-overlay" onClick={(e) => e.target === e.currentTarget && setShowSendModal(false)}>
          <div className="modal-card" style={{ padding: 32, maxWidth: 420 }}>
            <h3 style={{ marginTop: 0, marginBottom: 20 }}>Send Announcement</h3>
            <div className="auth-form">
              <div className="field-group">
                <label>Title</label>
                <input required />
              </div>
              <div className="field-group">
                <label>Message</label>
                <textarea required rows={3}></textarea>
              </div>
              <div className="field-group">
                <label>Audience</label>
                <select>
                  <option>All Users</option>
                  <option>Project Managers</option>
                  <option>All Tenants</option>
                </select>
              </div>
              <div style={{ display: 'flex', gap: 12 }}>
                <button>Send</button>
                <button onClick={() => setShowSendModal(false)} className="btn btn-ghost">Cancel</button>
              </div>
            </div>
          </div>
        </div>
      )}

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