'use client';

import { useEffect, useState } from 'react';
import { supabase } from '../../../lib/supabaseClient';

interface Tenant {
  id: string;
  full_name: string;
  email: string;
  unit: string;
  property: string;
}

interface Notification {
  id: string;
  tenant?: string;
  tenant_email?: string;
  message: string;
  type: string;
  status: string;
  created_at: string;
  recipient: string;
}

const notificationTypes = [
  { value: 'overdue', label: 'Overdue Rent Reminder' },
  { value: 'due_date', label: 'Upcoming Due Date' },
  { value: 'lease_renewal', label: 'Lease Renewal Notice' },
  { value: 'maintenance', label: 'Maintenance Activity' },
  { value: 'policy_change', label: 'Policy Change' },
  { value: 'inspection', label: 'Inspection Notice' },
  { value: 'utility_interruption', label: 'Utility Interruption' },
  { value: 'announcement', label: 'General Announcement' },
];

export default function CommunicationsPage() {
  const [tenants, setTenants] = useState<Tenant[]>([]);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [form, setForm] = useState({
    tenantId: '',
    type: 'overdue',
    customMessage: '',
  });

  async function getAuthHeaders() {
    const { data } = await supabase.auth.getSession();
    const headers: Record<string, string> = { 'Content-Type': 'application/json' };
    if (data.session?.access_token) headers.Authorization = `Bearer ${data.session.access_token}`;
    return headers;
  }

  async function loadData() {
    setLoading(true);
    setError('');

    try {
      const [tenantsResponse, notificationsResponse] = await Promise.all([
        fetch('/api/tenants', { headers: await getAuthHeaders() }),
        fetch('/api/notifications', { headers: await getAuthHeaders() }),
      ]);

      const tenantsResult = await tenantsResponse.json();
      const notificationsResult = await notificationsResponse.json();

      setTenants(tenantsResult.tenants ?? []);
      setNotifications(notificationsResult.notifications ?? []);
    } catch (err: any) {
      setError(err.message ?? 'Unable to load data.');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadData();
  }, []);

  async function handleSendNotification(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setMessage('');
    setError('');

    const response = await fetch('/api/notifications', {
      method: 'POST',
      headers: await getAuthHeaders(),
      body: JSON.stringify({
        tenantId: form.tenantId,
        type: form.type,
        message: form.customMessage,
      }),
    });

    const result = await response.json();

    if (!response.ok) {
      setError(result.message ?? 'Unable to send notification.');
      return;
    }

    setMessage('Notification sent successfully.');
    setForm(f => ({ ...f, tenantId: '', customMessage: '' }));
    await loadData();
  }

  return (
    <>
      <main className="container admin-no-hero" style={{ padding: '34px 0 80px' }}>
        <div className="card-admin-header">
          <div>
            <p className="heading">Communications</p>
            <p className="subheading">Send notifications to tenants for rent, utilities, maintenance, and announcements.</p>
          </div>
        </div>

        <section className="bento-section">
          <div className="bento">
            <article className="card">
              <div className="card-label"><span className="badge badge-pm">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>
              </span>Send Notification</div>
              <h3>Send Tenant Notice</h3>
              <form onSubmit={handleSendNotification} className="form-grid">
                <select value={form.tenantId} onChange={e => setForm(f => ({ ...f, tenantId: e.target.value }))} required>
                  <option value="">Select tenant</option>
                  {tenants.map(t => <option key={t.id} value={t.id}>{t.full_name} - Unit {t.unit}</option>)}
                </select>
                <select value={form.type} onChange={e => setForm(f => ({ ...f, type: e.target.value }))} required>
                  <option value="">Select notification type</option>
                  {notificationTypes.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
                </select>
                <textarea
                  value={form.customMessage}
                  onChange={e => setForm(f => ({ ...f, customMessage: e.target.value }))}
                  required
                  placeholder="Enter your message here..."
                  rows={4}
                  style={{ gridColumn: 'span 2', minHeight: 100 }}
                />
                <button type="submit" style={{ gridColumn: 'span 2' }}>Send Notification</button>
              </form>
              {message && <p className="landlord-success" style={{ marginTop: 16 }}>{message}</p>}
              {error && <p className="landlord-error" style={{ marginTop: 16 }}>{error}</p>}
            </article>

            <article className="card">
              <div className="card-label"><span className="badge badge-agent">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>
              </span>Notification History</div>
              <h3 style={{ marginBottom: 16 }}>Recent Communications</h3>

              {loading && <p className="landlord-muted">Loading notifications...</p>}
              {!loading && notifications.length === 0 && <p className="landlord-empty">No notifications sent yet.</p>}

              {!loading && notifications.length > 0 && (
                <div className="notification-history">
                  <div className="history-title">
                    <span>Sent Notifications</span>
                  </div>
                  {notifications.slice(0, 20).map(notification => (
                    <div key={notification.id} className="notification-item">
                      <div>
                        <span>Type: {notification.type}</span>
                        <span>Recipient: {notification.recipient} - {notification.tenant ?? '—'}</span>
                      </div>
                      <p>{notification.message}</p>
                      <span className={`status-pill ${notification.status === 'sent' ? 'status-active' : 'status-pending'}`}>{notification.status}</span>
                    </div>
                  ))}
                </div>
              )}
            </article>
          </div>
        </section>
      </main>

      <footer>
        <div className="footer-inner">
          <div className="footer-brand"><span className="logo-mark" style={{ width: 26, height: 26, borderRadius: 7 }}><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M3 21h18"/><path d="M5 21V7l8-4v18"/><path d="M19 21V11l-6-4"/></svg></span>Springfield Systems</div>
          <div className="footer-links"><a href="/">Home</a><a href="/dashboard">Dashboard</a></div>
          <div className="footer-copy">© 2026 Springfield Systems. All rights reserved.</div>
        </div>
      </footer>
    </>
  );
}