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
    <>
      <style jsx global>{`
        @media (max-width: 600px) {
          .table-shell {
            overflow-x: auto;
          }
          table {
            font-size: 12px;
          }
          th, td {
            padding: 8px 6px !important;
          }
        }
      `}</style>
      <main className="container admin-no-hero">
        <div className="card-admin-header">
          <div><p className="heading">Notifications</p><p className="subheading">View and manage tenant notifications and notices.</p></div>
        </div>

        <section className="card-grid" style={{ gridTemplateColumns: '1fr' }}>
          <div className="card">
            <div className="card-label">Tenant Notifications</div>
            <h3 style={{ marginBottom: 16 }}>Notification History</h3>
            {loading && <p className="landlord-muted">Loading notifications...</p>}
            {!loading && notifications.length === 0 && <p className="landlord-empty">No notifications recorded yet.</p>}
            {!loading && notifications.length > 0 && (
              <div className="table-shell" style={{ maxHeight: '400px', overflowY: 'auto' }}>
                <table className="landlord-table">
                  <thead><tr><th style={{ padding: '8px 6px' }}>Tenant</th><th style={{ padding: '8px 6px' }}>Message</th><th style={{ padding: '8px 6px' }}>Status</th><th style={{ padding: '8px 6px' }}>Date</th><th style={{ padding: '8px 6px' }}>Actions</th></tr></thead>
                  <tbody>
                    {notifications.map(notification => (
                      <tr key={notification.id}>
                        <td className="landlord-name" style={{ padding: '8px 6px' }}>{notification.tenant}</td>
                        <td style={{ padding: '8px 6px', whiteSpace: 'normal', wordBreak: 'break-word', maxWidth: '200px' }}>{notification.message}</td>
                        <td style={{ padding: '8px 6px' }}><span className={`status-pill ${notification.status === 'sent' ? 'status-active' : 'status-pending'}`}>{notification.status}</span></td>
                        <td style={{ padding: '8px 6px' }}>{notification.created_at ? new Date(notification.created_at).toLocaleDateString() : ''}</td>
                        <td style={{ padding: '8px 6px' }}><button className="action-button danger" onClick={() => handleDeleteNotification(notification.id)} style={{ padding: '4px 8px', fontSize: '12px' }}>Delete</button></td>
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
    </>
  );
}