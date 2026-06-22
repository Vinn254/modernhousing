'use client';

import { useEffect, useState } from 'react';
import { supabase } from '../../../lib/supabaseClient';

interface Notification {
  id: string;
  message: string;
  created_at: string;
}

export default function TenantNotificationsPage() {
  const [user, setUser] = useState<any>(null);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(true);

  async function loadNotifications(userId: string) {
    setLoading(true);
    const { data: { session } } = await supabase.auth.getSession();
    const response = await fetch(`/api/tenant/notifications?userId=${encodeURIComponent(userId)}`, {
      headers: session?.access_token ? { Authorization: `Bearer ${session.access_token}` } : undefined,
    });
    const result = await response.json();
    if (response.ok) setNotifications(result.notifications ?? []);
    setLoading(false);
  }

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      if (data.user) {
        setUser(data.user);
        loadNotifications(data.user.id);
      }
    });
  }, []);

  return (
    <main className="container page-layout">
      <div className="card-admin-header">
        <div><p className="heading">Notifications</p><p className="subheading">Messages and notices from your agent or landlord.</p></div>
      </div>

      <section className="card" style={{ marginTop: 24 }}>
        {loading && <p className="landlord-muted">Loading notifications…</p>}
        {!loading && notifications.length === 0 && <p>No notices from your agent yet.</p>}
        {!loading && notifications.length > 0 && (
          <div className="table-shell">
            <table className="landlord-table">
              <thead><tr><th>Message</th><th>Date</th></tr></thead>
              <tbody>
                {notifications.map(n => (
                  <tr key={n.id}>
                    <td>{n.message}</td>
                    <td>{n.created_at ? new Date(n.created_at).toLocaleDateString() : ''}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </main>
  );
}