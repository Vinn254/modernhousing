'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import AdminTopNav from '../../components/AdminTopNav';

interface Landlord {
  id: string;
  email: string;
  full_name: string;
  organization: string;
  status: 'active' | 'inactive' | 'pending';
  created_at: string;
}

interface Subscription {
  id: string;
  admin_id: string;
  admin_name: string;
  email: string;
  plan: 'monthly' | 'quarterly' | 'yearly';
  amount: number;
  status: 'paid' | 'pending' | 'overdue' | 'expired' | 'active';
  start_date: string;
  expiry_date: string;
  paid_at: string;
  created_at: string;
}

interface Notification {
  id: string;
  recipient: 'tenant' | 'landlord';
  admin_id?: string | null;
  admin_name?: string | null;
  admin_email?: string | null;
  type: string;
  message: string;
  status: string;
  created_at: string;
}

type RiskLevel = 'safe' | 'expiring' | 'overdue';

function getSubscriptionForLandlord(landlord: Landlord, subscriptions: Subscription[]) {
  return subscriptions.find((subscription) => subscription.admin_id === landlord.id || subscription.email.toLowerCase() === landlord.email.toLowerCase());
}

function getDaysUntilExpiry(expiryDate: string) {
  if (!expiryDate) return 999;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const expiry = new Date(expiryDate);
  expiry.setHours(0, 0, 0, 0);
  return Math.ceil((expiry.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
}

function getRisk(subscription?: Subscription | null): RiskLevel {
  if (!subscription) return 'safe';
  if (subscription.status === 'overdue' || subscription.status === 'expired') return 'overdue';
  const days = getDaysUntilExpiry(subscription.expiry_date);
  if (days < 0 || subscription.status === 'pending') return 'overdue';
  if (days <= 7) return 'expiring';
  return 'safe';
}

function getRiskLabel(subscription?: Subscription | null) {
  if (!subscription) return 'No subscription';
  if (subscription.status === 'overdue' || subscription.status === 'expired') return 'Overdue';
  if (subscription.status === 'pending') return 'Pending';
  const days = getDaysUntilExpiry(subscription.expiry_date);
  if (days < 0) return 'Expired';
  if (days <= 7) return `Expiring in ${days} day${days === 1 ? '' : 's'}`;
  if (days <= 30) return `${days} days left`;
  return 'Active';
}

function generateNotificationMessage(subscription: Subscription, landlord: Landlord) {
  const risk = getRisk(subscription);
  const expiry = new Date(subscription.expiry_date).toLocaleDateString();

  if (risk === 'overdue') {
    return `Hello ${landlord.full_name}, your Springfield Systems subscription for ${landlord.organization} is overdue. Please renew your ${subscription.plan} subscription to keep landlord workspace access active.`;
  }

  if (risk === 'expiring') {
    return `Hello ${landlord.full_name}, your Springfield Systems subscription for ${landlord.organization} is due to end on ${expiry}. Please renew your ${subscription.plan} subscription before access is interrupted.`;
  }

  return `Hello ${landlord.full_name}, this is a reminder that your Springfield Systems subscription for ${landlord.organization} is active. Your current plan is ${subscription.plan}.`;
}

export default function LandlordManagementPage() {
  const [landlords, setLandlords] = useState<Landlord[]>([]);
  const [subscriptions, setSubscriptions] = useState<Subscription[]>([]);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [showAddModal, setShowAddModal] = useState(false);
  const [selectedLandlord, setSelectedLandlord] = useState<Landlord | null>(null);
  const [selectedSubscription, setSelectedSubscription] = useState<Subscription | null>(null);
  const [notificationText, setNotificationText] = useState('');
  const [newEmail, setNewEmail] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [newName, setNewName] = useState('');
  const [organization, setOrganization] = useState('');
  const [loading, setLoading] = useState(false);
  const [notificationLoading, setNotificationLoading] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  async function loadData() {
    setLoading(true);
    const landlordsResponse = await fetch('/api/landlords');
    const landlordsResult = await landlordsResponse.json();

    if (!landlordsResponse.ok) {
      setError(landlordsResult.message ?? 'Unable to load landlords.');
      setLoading(false);
      return;
    }

    const subscriptionsResponse = await fetch('/api/subscriptions');
    const subscriptionsResult = await subscriptionsResponse.json();
    const subscriptions = subscriptionsResponse.ok ? (subscriptionsResult.subscriptions ?? []) : [];

    const notificationsResponse = await fetch('/api/notifications?recipient=landlord');
    const notificationsResult = await notificationsResponse.json();
    const notifications = notificationsResponse.ok ? (notificationsResult.notifications ?? []) : [];

    setLandlords(landlordsResult.landlords ?? []);
    setSubscriptions(subscriptions);
    setNotifications(notifications);
    setLoading(false);
  }

  useEffect(() => {
    loadData();
  }, []);

  useEffect(() => {
    if (selectedLandlord || selectedSubscription || landlords.length === 0 || subscriptions.length === 0) return;

    const priorityLandlord = landlords.find((landlord) => getRisk(getSubscriptionForLandlord(landlord, subscriptions)) === 'overdue')
      ?? landlords.find((landlord) => getRisk(getSubscriptionForLandlord(landlord, subscriptions)) === 'expiring')
      ?? landlords[0];
    const subscription = getSubscriptionForLandlord(priorityLandlord, subscriptions);

    if (priorityLandlord && subscription) {
      setSelectedLandlord(priorityLandlord);
      setSelectedSubscription(subscription);
      setNotificationText(generateNotificationMessage(subscription, priorityLandlord));
    }
  }, [landlords, subscriptions]);

  async function handleAddLandlord(event: React.FormEvent) {
    event.preventDefault();
    setMessage('');
    setError('');
    setLoading(true);

    const response = await fetch('/api/landlords', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: newEmail,
        password: newPassword,
        fullName: newName,
        organization,
      }),
    });

    const result = await response.json();

    if (!response.ok) {
      setError(result.message ?? 'Unable to create landlord.');
      setLoading(false);
      return;
    }

    setMessage('Landlord created.');
    setShowAddModal(false);
    setNewEmail('');
    setNewPassword('');
    setNewName('');
    setOrganization('');
    await loadData();
  }

  async function handleApprove(landlord: Landlord) {
    const response = await fetch('/api/landlords', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId: landlord.id, fullName: landlord.full_name, status: 'active' }),
    });

    const result = await response.json();
    if (!response.ok) {
      setError(result.message ?? 'Unable to approve landlord.');
      return;
    }

    setLandlords((current) => current.map((item) => (item.id === landlord.id ? { ...item, ...result.landlord } : item)));
    setMessage('Landlord approved and activated.');
  }

  async function handleDeactivate(landlord: Landlord) {
    if (!confirm(`Deactivate ${landlord.full_name}?`)) return;

    const response = await fetch(`/api/landlords?id=${encodeURIComponent(landlord.id)}`, { method: 'DELETE' });
    const result = await response.json();

    if (!response.ok) {
      setError(result.message ?? 'Unable to deactivate landlord.');
      return;
    }

    setLandlords((current) => current.map((item) => (item.id === landlord.id ? { ...item, ...result.landlord } : item)));
    setMessage('Landlord deactivated.');
  }

  async function sendNotification() {
    if (!selectedSubscription || !selectedLandlord) return;

    setNotificationLoading(true);
    const response = await fetch('/api/notifications', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        recipient: 'landlord',
        adminId: selectedLandlord.id,
        adminName: selectedLandlord.full_name,
        adminEmail: selectedLandlord.email,
        type: getRisk(selectedSubscription) === 'overdue' ? 'overdue' : 'subscription_expiring',
        message: notificationText,
      }),
    });

    const result = await response.json();
    setNotificationLoading(false);

    if (!response.ok) {
      setError(result.message ?? 'Unable to send notification.');
      return;
    }

    setMessage('Notification sent to landlord.');
    setNotifications((current) => [result.notification, ...current]);
    setSelectedSubscription(null);
    setSelectedLandlord(null);
    setNotificationText('');
  }

  function openNotification(subscription: Subscription, landlord: Landlord) {
    setSelectedSubscription(subscription);
    setSelectedLandlord(landlord);
    setNotificationText(generateNotificationMessage(subscription, landlord));
    setError('');
  }

  function handleComposerLandlordChange(event: React.ChangeEvent<HTMLSelectElement>) {
    const landlord = landlords.find((item) => item.id === event.target.value) ?? null;
    setSelectedLandlord(landlord);
    const subscription = landlord ? getSubscriptionForLandlord(landlord, subscriptions) ?? null : null;
    setSelectedSubscription(subscription);
    setNotificationText(landlord && subscription ? generateNotificationMessage(subscription, landlord) : '');
  }

  function handleComposerSubscriptionChange(event: React.ChangeEvent<HTMLSelectElement>) {
    const subscription = subscriptions.find((item) => item.id === event.target.value) ?? null;
    setSelectedSubscription(subscription);
    if (selectedLandlord && subscription) {
      setNotificationText(generateNotificationMessage(subscription, selectedLandlord));
    }
  }

  const activeCount = landlords.filter((landlord) => landlord.status === 'active').length;
  const inactiveCount = landlords.filter((landlord) => landlord.status !== 'active').length;
  const expiringCount = landlords.filter((landlord) => getRisk(getSubscriptionForLandlord(landlord, subscriptions)) === 'expiring').length;
  const overdueCount = landlords.filter((landlord) => getRisk(getSubscriptionForLandlord(landlord, subscriptions)) === 'overdue').length;
  const composerSubscriptions = landlords
    .map((landlord) => getSubscriptionForLandlord(landlord, subscriptions))
    .filter((subscription): subscription is Subscription => Boolean(subscription));

  return (
    <>
      <section className="hero">
        <nav className="nav">
          <Link href="/" className="logo">
            <span className="logo-mark">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M3 21h18"/><path d="M5 21V7l8-4v18"/><path d="M19 21V11l-6-4"/></svg>
            </span>
            Springfield Systems
          </Link>
          <AdminTopNav variant="super" />
        </nav>

        <div className="hero-inner">
          <span className="eyebrow"><span className="pulse"></span> Super Admin</span>
          <h1>Landlords</h1>
          <p className="hero-sub">Add landlords, manage subscriptions, and send renewal notifications from one place.</p>
        </div>
      </section>

      <section className="landlord-section">
        <div className="landlord-stats">
          <article className="landlord-stat">
            <span>Landlords</span>
            <strong>{landlords.length}</strong>
            <p>Total landlord workspaces.</p>
          </article>
          <article className="landlord-stat">
            <span>Active</span>
            <strong>{activeCount}</strong>
            <p>Approved landlord accounts.</p>
          </article>
          <article className="landlord-stat expiring-stat">
            <span>Expiring Soon</span>
            <strong>{expiringCount}</strong>
            <p>Subscriptions ending within 7 days.</p>
          </article>
          <article className="landlord-stat overdue-stat">
            <span>Overdue</span>
            <strong>{overdueCount}</strong>
            <p>Overdue or expired subscriptions.</p>
          </article>
        </div>

        <div className="landlord-panel">
          <div className="landlord-panel-header">
            <div>
              <span className="landlord-kicker">Landlords</span>
              <h2>Landlord Accounts and Subscriptions</h2>
            </div>
            <button className="landlord-add-button" onClick={() => setShowAddModal(true)}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
              Add Landlord
            </button>
          </div>

          {loading && <p className="landlord-muted">Loading landlords…</p>}
          {message && <p className="landlord-success">{message}</p>}
          {error && <p className="landlord-error">{error}</p>}

          <div className="table-shell">
            <table className="landlord-table">
              <thead>
                <tr>
                  <th>Name</th>
                  <th>Organization</th>
                  <th>Email</th>
                  <th>Subscription</th>
                  <th>Expiry</th>
                  <th>Renewal Status</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {landlords.length === 0 && !loading ? (
                  <tr>
                    <td colSpan={7} className="landlord-empty">No landlords found.</td>
                  </tr>
                ) : landlords.map((landlord) => {
                  const subscription = getSubscriptionForLandlord(landlord, subscriptions);
                  const risk = getRisk(subscription);
                  return (
                    <tr key={landlord.id} className={`risk-row ${risk}`}>
                      <td className="landlord-name">{landlord.full_name}</td>
                      <td>{landlord.organization || '—'}</td>
                      <td>{landlord.email}</td>
                      <td>{subscription ? `${subscription.plan} · KSH ${Number(subscription.amount ?? 0).toLocaleString()}` : 'No subscription'}</td>
                      <td>{subscription?.expiry_date ? new Date(subscription.expiry_date).toLocaleDateString() : '—'}</td>
                      <td>
                        <span className={`renewal-pill ${risk}`}>{getRiskLabel(subscription)}</span>
                      </td>
                      <td>
                        <div className="landlord-actions">
                          <button className="action-button" onClick={() => setSelectedLandlord(landlord)}>View</button>
                          {subscription && <button className="action-button notify" onClick={() => openNotification(subscription, landlord)}>Notify</button>}
                          {landlord.status !== 'active' && <button className="action-button primary" onClick={() => handleApprove(landlord)}>Approve</button>}
                          <button className="action-button danger" onClick={() => handleDeactivate(landlord)}>Deactivate</button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>

        <div className="landlord-panel notification-panel">
          <div className="landlord-panel-header">
            <div>
              <span className="landlord-kicker">Notifications</span>
              <h2>Subscription Renewal Messages</h2>
            </div>
          </div>
          <p className="landlord-muted">Send auto-generated renewal reminders to landlords. Expiring subscriptions are orange; overdue subscriptions are red.</p>

          <div className="notification-composer">
            <div className="composer-card">
              <div className="composer-controls">
                <label>
                  Landlord
                  <select value={selectedLandlord?.id ?? ''} onChange={handleComposerLandlordChange} disabled={!selectedLandlord}>
                    <option value="">Select landlord</option>
                    {landlords.map((landlord) => (
                      <option key={landlord.id} value={landlord.id}>{landlord.full_name} · {landlord.organization || landlord.email}</option>
                    ))}
                  </select>
                </label>
                <label>
                  Subscription
                  <select value={selectedSubscription?.id ?? ''} onChange={handleComposerSubscriptionChange} disabled={!selectedSubscription}>
                    <option value="">Select subscription</option>
                    {composerSubscriptions.map((subscription) => (
                        <option key={subscription.id} value={subscription.id}>
                          {subscription.plan} · {subscription.status} · KSH {Number(subscription.amount ?? 0).toLocaleString()}
                        </option>
                      ))}
                  </select>
                </label>
                <button className="landlord-add-button" onClick={() => selectedLandlord && selectedSubscription && openNotification(selectedSubscription, selectedLandlord)}>
                  Generate Message
                </button>
              </div>
              <textarea value={notificationText} onChange={(event) => setNotificationText(event.target.value)} rows={5} placeholder="Auto-generated renewal message will appear here." />
              <div className="modal-actions">
                <button onClick={sendNotification} disabled={notificationLoading || !notificationText.trim() || !selectedLandlord || !selectedSubscription}>{notificationLoading ? 'Sending…' : 'Send Notification'}</button>
                <button type="button" className="secondary-button" onClick={() => { setSelectedSubscription(null); setSelectedLandlord(null); setNotificationText(''); }}>Clear</button>
              </div>
            </div>
          </div>

          <div className="notification-history">
            <div className="history-title">
              <span>Recent Messages</span>
              <strong>{notifications.length}</strong>
            </div>
            {notifications.slice(0, 6).map((notification) => (
              <div className="notification-item" key={notification.id}>
                <div>
                  <strong>{notification.admin_name || 'Landlord'}</strong>
                  <span>{notification.admin_email || notification.type}</span>
                </div>
                <p>{notification.message}</p>
                <small>{new Date(notification.created_at).toLocaleString()}</small>
              </div>
            ))}
            {notifications.length === 0 && <div className="landlord-empty">No landlord notifications sent yet.</div>}
          </div>
        </div>
      </section>

      {showAddModal && (
        <div className="modal-overlay">
          <div className="modal-card landlord-modal">
            <div className="modal-title-row">
              <h3>Add New Landlord</h3>
              <button className="icon-button" onClick={() => setShowAddModal(false)}>×</button>
            </div>
            {error && <p className="landlord-error">{error}</p>}
            <form onSubmit={handleAddLandlord} className="landlord-form">
              <div className="field-group">
                <label>Email</label>
                <input type="email" value={newEmail} onChange={(event) => setNewEmail(event.target.value)} required placeholder="landlord@example.com" />
              </div>
              <div className="field-group">
                <label>Password</label>
                <input type="password" value={newPassword} onChange={(event) => setNewPassword(event.target.value)} required placeholder="Choose a secure password" />
              </div>
              <div className="field-group">
                <label>Full Name</label>
                <input value={newName} onChange={(event) => setNewName(event.target.value)} required placeholder="Jane Doe" />
              </div>
              <div className="field-group">
                <label>Organization</label>
                <input value={organization} onChange={(event) => setOrganization(event.target.value)} required placeholder="Springfield Properties" />
              </div>
              <div className="modal-actions">
                <button type="submit" disabled={loading}>{loading ? 'Creating…' : 'Create Landlord'}</button>
                <button type="button" className="secondary-button" onClick={() => setShowAddModal(false)} disabled={loading}>Cancel</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {selectedLandlord && !selectedSubscription && (
        <div className="modal-overlay" onClick={(event) => event.target === event.currentTarget && setSelectedLandlord(null)}>
          <div className="modal-card landlord-modal">
            <div className="modal-title-row">
              <h3>Landlord Details</h3>
              <button className="icon-button" onClick={() => setSelectedLandlord(null)}>×</button>
            </div>
            <div className="detail-grid">
              <div className="detail-card"><span>Full name</span><strong>{selectedLandlord.full_name}</strong></div>
              <div className="detail-card"><span>Organization</span><strong>{selectedLandlord.organization || '—'}</strong></div>
              <div className="detail-card"><span>Email</span><strong>{selectedLandlord.email}</strong></div>
              <div className="detail-card"><span>Status</span><strong>{selectedLandlord.status}</strong></div>
              <div className="detail-card"><span>Created</span><strong>{new Date(selectedLandlord.created_at).toLocaleDateString()}</strong></div>
            </div>
          </div>
        </div>
      )}

      <footer>
        <div className="footer-inner">
          <div className="footer-brand"><span className="logo-mark" style={{ width: 26, height: 26, borderRadius: 7 }}><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M3 21h18"/><path d="M5 21V7l8-4v18"/><path d="M19 21V11l-6-4"/></svg></span>Springfield Systems</div>
          <div className="footer-links"><a href="/">Home</a><a href="/super-admin">Dashboard</a></div>
          <div className="footer-copy">© 2026 Springfield Systems. All rights reserved.</div>
        </div>
      </footer>
    </>
  );
}
