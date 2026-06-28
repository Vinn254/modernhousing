'use client';

import { useEffect, useState } from 'react';
import { supabase } from '../../../lib/supabaseClient';

interface Tenant {
  id: string;
  full_name: string;
  email: string;
  lease_end: string;
  unit?: string;
  property?: string;
}

interface Notification {
  id: string;
  admin_id: string;
  admin_name: string;
  admin_email: string;
  type: string;
  message: string;
  status: string;
  created_at: string;
}

export default function CommunicationsPage() {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [tenants, setTenants] = useState<Tenant[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [notificationForm, setNotificationForm] = useState({
    type: 'announcement',
    messageText: '',
    tenantId: '',
  });
  const [sending, setSending] = useState(false);

  async function getAuthHeaders() {
    const { data } = await supabase.auth.getSession();
    const headers: Record<string, string> = { 'Content-Type': 'application/json' };
    if (data.session?.access_token) headers.Authorization = `Bearer ${data.session.access_token}`;
    return headers;
  }

  async function loadNotifications() {
    setLoading(true);
    setError('');

    try {
      const { data: { user } } = await supabase.auth.getUser();
      const response = await fetch(`/api/notifications?recipient=project_manager&adminEmail=${encodeURIComponent(user?.email ?? '')}`, {
        headers: await getAuthHeaders(),
      });

      if (!response.ok) {
        const result = await response.json();
        throw new Error(result.message ?? 'Failed to load notifications.');
      }

      const result = await response.json();
      setNotifications(result.notifications ?? []);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  async function loadTenants() {
    try {
      const response = await fetch('/api/tenants', { headers: await getAuthHeaders() });
      const result = await response.json();
      if (response.ok) setTenants(result.tenants ?? []);
    } catch (e) {}
  }

  useEffect(() => {
    Promise.all([loadNotifications(), loadTenants()]);
  }, []);

  async function handleSendNotification(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setMessage('');
    setError('');
    setSending(true);

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      setError('Not authenticated.');
      setSending(false);
      return;
    }

    const { data: { session } } = await supabase.auth.getSession();
    const authHeaders = {
      ...(await getAuthHeaders()),
      Authorization: session?.access_token ? `Bearer ${session.access_token}` : '',
    };

    // If tenant selected, send to tenant
    if (notificationForm.tenantId) {
      const tenant = tenants.find(t => t.id === notificationForm.tenantId);
      const unit = tenant?.unit || '';

      const response = await fetch('/api/notifications', {
        method: 'POST',
        headers: authHeaders,
        body: JSON.stringify({
          tenantId: notificationForm.tenantId,
          recipient: 'tenant',
          type: notificationForm.type,
          message: notificationForm.messageText,
          adminEmail: user.email,
        }),
      });

      const result = await response.json();
      setSending(false);

      if (!response.ok) {
        setError(result.message ?? 'Failed to send notification.');
        return;
      }

      setMessage('Tenant notification sent successfully.');
    } else {
      // Send to all landlords
      const response = await fetch('/api/notifications', {
        method: 'POST',
        headers: authHeaders,
        body: JSON.stringify({
          adminId: user.id,
          adminName: user.user_metadata?.full_name || user.email,
          adminEmail: user.email,
          recipient: 'project_manager',
          type: notificationForm.type,
          message: notificationForm.messageText,
        }),
      });

      const result = await response.json();
      setSending(false);

      if (!response.ok) {
        setError(result.message ?? 'Failed to send notification.');
        return;
      }

      setMessage('Notification sent successfully.');
    }

    setNotificationForm({ type: 'announcement', messageText: '', tenantId: '' });
    await loadNotifications();
  }

  const notificationTypes = [
    { value: 'announcement', label: 'Announcement' },
    { value: 'reminder', label: 'Reminder' },
    { value: 'overdue', label: 'Overdue Alert' },
    { value: 'lease_expired', label: 'Lease Expired' },
    { value: 'lease_ending', label: 'Lease Ending' },
  ];

  // Get overdue tenants (lease ended or ending within 7 days)
  const today = new Date().toISOString().slice(0, 10);
  const nextWeek = new Date();
  nextWeek.setDate(nextWeek.getDate() + 7);
  const nextWeekStr = nextWeek.toISOString().slice(0, 10);
  const overdueTenants = tenants.filter(t => t.lease_end <= nextWeekStr);

  return (
    <>
      <main className="container admin-no-hero" style={{ padding: '34px 0 80px' }}>
        <div className="card-admin-header">
          <div>
            <p className="heading">Communications</p>
            <p className="subheading">Send announcements and manage tenant communications.</p>
          </div>
        </div>

        <section className="bento-section">
          <div className="bento">
            <article className="card">
              <div className="card-label"><span className="badge badge-pm">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2-2z"/></svg>
              </span>Send Notification</div>
              <h3>Create Announcement or Send to Tenant</h3>
              <form onSubmit={handleSendNotification} className="form-grid">
                <select value={notificationForm.type} onChange={e => setNotificationForm(f => ({ ...f, type: e.target.value }))} required>
                  {notificationTypes.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
                </select>
                <select value={notificationForm.tenantId} onChange={e => setNotificationForm(f => ({ ...f, tenantId: e.target.value }))}>
                  <option value="">All tenants (broadcast)</option>
                  {tenants.map(t => (
                    <option key={t.id} value={t.id}>
                      {t.full_name} - {t.unit} ({t.property})
                    </option>
                  ))}
                </select>
                <textarea
                  value={notificationForm.messageText}
                  onChange={e => setNotificationForm(f => ({ ...f, messageText: e.target.value }))}
                  required
                  placeholder="Enter your message..."
                  rows={4}
                />
                <button type="submit" disabled={sending}>{sending ? 'Sending…' : 'Send Notification'}</button>
              </form>
              {message && <p className="landlord-success" style={{ marginTop: 16 }}>{message}</p>}
              {error && <p className="landlord-error" style={{ marginTop: 16 }}>{error}</p>}
            </article>

            <article className="card">
              <div className="card-label"><span className="badge badge-agent">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2-2z"/></svg>
              </span>Overdue Tenants</div>
              <h3>Tenants Needing Attention</h3>

              {overdueTenants.length === 0 ? (
                <p className="landlord-muted">No tenants with leases ending soon.</p>
              ) : (
                <div className="table-shell">
                  <table className="landlord-table">
                    <thead>
                      <tr>
                        <th>Tenant</th>
                        <th>Lease End</th>
                        <th>Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      {overdueTenants.map(t => (
                        <tr key={t.id}>
                          <td className="landlord-name">{t.full_name}</td>
                          <td>{t.lease_end}</td>
                          <td>
                            <span className={`status-pill ${t.lease_end < today ? 'status-active' : 'status-pending'}`}>
                              {t.lease_end < today ? 'Overdue' : 'Ending Soon'}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </article>
          </div>

          <article className="card" style={{ marginTop: 24 }}>
            <div className="card-label"><span className="badge badge-agent">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2-2z"/></svg>
            </span>Message History</div>
            <h3>Sent Communications</h3>

            {loading && <p className="landlord-muted">Loading communications...</p>}

            {!loading && notifications.length === 0 && (
              <p className="landlord-empty">No communications sent yet.</p>
            )}

            {!loading && notifications.length > 0 && (
              <div className="table-shell">
                <table className="landlord-table">
                  <thead>
                    <tr>
                      <th>Type</th>
                      <th>Message</th>
                      <th>Status</th>
                      <th>Date</th>
                    </tr>
                  </thead>
                  <tbody>
                    {notifications.map(n => (
                      <tr key={n.id}>
                        <td>{n.type}</td>
                        <td>{n.message}</td>
                        <td>
                          <span className={`renewal-pill ${n.status === 'sent' ? 'status-active' : 'status-pending'}`}>
                            {n.status}
                          </span>
                        </td>
                        <td>{n.created_at ? new Date(n.created_at).toLocaleDateString() : ''}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </article>
        </section>
      </main>

      <footer>
        <div className="footer-inner">
          <div className="footer-brand"><span className="logo-mark" style={{ width: 26, height: 26, borderRadius: 7 }}><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M3 21h18"/><path d="M5 21V7l8-4v18"/><path d="M19 21V11l-6-4"/></svg></span>Springfield Systems</div>
          <div className="footer-links"><a href="/">Home</a><a href="/admin">Dashboard</a></div>
          <div className="footer-copy">© 2026 Springfield Systems. All rights reserved.</div>
        </div>
      </footer>
    </>
  );
}