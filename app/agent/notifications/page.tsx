'use client';

import { useEffect, useState } from 'react';
import { supabase } from '../../../lib/supabaseClient';

interface Notification {
  id: string;
  tenant: string;
  tenant_email: string;
  message: string;
  status: string;
  created_at: string;
}

export default function AgentNotificationsPage() {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  async function loadData() {
    setLoading(true);
    try {
      const storedPropertyId = localStorage.getItem('agentPropertyId') || '';
      const response = await fetch(`/api/notifications?propertyId=${storedPropertyId}`);
      const result = await response.json();
      if (response.ok) setNotifications(result.notifications ?? []);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { loadData(); }, []);

  async function handleDeleteNotification(notificationId: string) {
    const response = await fetch(`/api/notifications?id=${notificationId}`, { method: 'DELETE' });
    const result = await response.json();
    if (response.ok) {
      setNotifications(notifications.filter(n => n.id !== notificationId));
    }
  }

  return (
    <main className="container admin-no-hero" style={{ padding: '34px 0 80px' }}>
      <div className="card-admin-header">
        <div><p className="heading">Notifications</p><p className="subheading">View and manage tenant notifications and notices.</p></div>
      </div>

<section className="card-grid">
        <div className="card">
          <div className="card-label">Tenant Notifications</div>
          <h3 style={{ marginBottom: 16 }}>Notification History</h3>
          {loading && <p className="landlord-muted">Loading notifications...</p>}
          {!loading && notifications.length === 0 && <p className="landlord-empty">No notifications recorded yet.</p>}
          {!loading && notifications.length > 0 && (
            <div className="table-shell">
              <table className="landlord-table">
                <thead><tr><th>Tenant</th><th>Message</th><th>Status</th><th>Date</th><th>Actions</th></tr></thead>
                <tbody>
                  {notifications.map(notification => (
                    <tr key={notification.id}>
                      <td className="landlord-name">{notification.tenant}</td>
                      <td>{notification.message}</td>
                      <td><span className={`status-pill ${notification.status === 'sent' ? 'status-active' : 'status-pending'}`}>{notification.status}</span></td>
                      <td>{notification.created_at ? new Date(notification.created_at).toLocaleDateString() : ''}</td>
                      <td><button className="action-button danger" onClick={() => handleDeleteNotification(notification.id)} style={{ padding: '4px 8px', fontSize: '12px' }}>Delete</button></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          {error && <p className="landlord-error">{error}</p>}
        </div>
      </section>
    </main>
  );
}