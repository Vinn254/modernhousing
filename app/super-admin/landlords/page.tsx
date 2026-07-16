'use client';

import { useEffect, useState } from 'react';

interface Landlord {
  id: string;
  email: string;
  full_name: string;
  organization: string;
  phone?: string | null;
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
  recipient: 'tenant' | 'landlord' | 'project_manager';
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
    return `Hello ${landlord.full_name}, your Springfield Systems subscription for ${landlord.organization} is overdue. Please renew your ${subscription.plan} subscription to keep project manager workspace access active.`;
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
  const [newPhone, setNewPhone] = useState('');
  const [newPlan, setNewPlan] = useState('monthly');
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

    const notificationsResponse = await fetch('/api/notifications?recipient=project_manager');
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
        phone: newPhone || null,
      }),
    });

    const result = await response.json();

    if (!response.ok) {
      setError(result.message ?? 'Unable to create project manager.');
      setLoading(false);
      return;
    }

    setMessage('Project manager created. Awaiting super admin approval.');
    setShowAddModal(false);
    setNewEmail('');
    setNewPassword('');
    setNewName('');
    setOrganization('');
    setNewPhone('');
    setNewPlan('monthly');

    if (result.landlord?.id) {
      const planAmounts: Record<string, number> = { monthly: 2500, quarterly: 5000, yearly: 6000 };

      const subscriptionResponse = await fetch('/api/subscriptions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          adminId: result.landlord.id,
          adminName: newName,
          email: newEmail,
          plan: newPlan,
          amount: planAmounts[newPlan],
          status: 'pending',
        }),
      });

      const subscriptionResult = await subscriptionResponse.json();
      if (!subscriptionResponse.ok) {
        setError(subscriptionResult.message ?? 'Unable to create subscription.');
        setLoading(false);
        return;
      }
    }

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
      setError(result.message ?? 'Unable to approve project manager.');
      return;
    }

    setLandlords((current) => current.map((item) => (item.id === landlord.id ? { ...item, ...result.landlord } : item)));
    setMessage('Project manager approved and activated.');
  }

  async function handleDeleteLandlord(landlord: Landlord) {
    if (!confirm(`Permanently delete ${landlord.full_name}? This cannot be undone.`)) return;

    const response = await fetch(`/api/landlords?id=${encodeURIComponent(landlord.id)}`, { method: 'DELETE' });
    const result = await response.json();

    if (!response.ok) {
      setError(result.message ?? 'Unable to delete project manager.');
      return;
    }

    setLandlords((current) => current.filter((item) => item.id !== landlord.id));
    setMessage('Project manager permanently deleted.');
  }

  async function handleResetPassword(landlord: Landlord) {
    const newPassword = prompt('Enter new password for ' + landlord.full_name + ':');
    if (!newPassword) return;
    if (newPassword.length < 6) {
      setError('Password must be at least 6 characters.');
      return;
    }

    const response = await fetch('/api/landlords', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId: landlord.id, fullName: landlord.full_name, password: newPassword }),
    });

    const result = await response.json();
    if (!response.ok) {
      setError(result.message ?? 'Unable to reset password.');
      return;
    }

    setMessage(`Password reset for ${landlord.full_name}.`);
  }

  async function handleUpgradeSubscription(landlord: Landlord) {
    const plans = ['monthly', 'quarterly', 'yearly'];
    const plan = prompt('Enter new subscription plan (monthly, quarterly, or yearly):\nCurrent subscription: ' + (getSubscriptionForLandlord(landlord, subscriptions)?.plan || 'none'));
    if (!plan) return;
    if (!plans.includes(plan.toLowerCase())) {
      setError('Invalid plan. Choose: monthly, quarterly, or yearly.');
      return;
    }

    const planAmounts: Record<string, number> = { monthly: 2500, quarterly: 5000, yearly: 6000 };

    const response = await fetch('/api/subscriptions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        adminId: landlord.id,
        adminName: landlord.full_name,
        email: landlord.email,
        plan: plan.toLowerCase(),
        amount: planAmounts[plan.toLowerCase()],
      }),
    });

    const result = await response.json();
    if (!response.ok) {
      setError(result.message ?? 'Unable to upgrade subscription.');
      return;
    }

    await loadData();
    setMessage(`Subscription upgraded to ${plan.toLowerCase()} for ${landlord.full_name}.`);
  }

  async function sendNotification(subscription?: Subscription | null) {
    const resolvedSubscription = subscription ?? selectedSubscription;
    if (!selectedLandlord) return;

    setNotificationLoading(true);
    const response = await fetch('/api/notifications', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        recipient: 'project_manager',
        adminId: selectedLandlord.id,
        adminName: selectedLandlord.full_name,
        adminEmail: selectedLandlord.email,
        type: resolvedSubscription ? (getRisk(resolvedSubscription) === 'overdue' ? 'overdue' : 'subscription_expiring') : 'subscription_expiring',
        message: notificationText,
      }),
    });

    const result = await response.json();
    setNotificationLoading(false);

    if (!response.ok) {
      setError(result.message ?? 'Unable to send notification.');
      return;
    }

    setMessage('Notification sent to project manager.');
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
    if (landlord && subscription) {
      setNotificationText(generateNotificationMessage(subscription, landlord));
    } else {
      setNotificationText('');
    }
  }

  function handleComposerSubscriptionChange(event: React.ChangeEvent<HTMLSelectElement>) {
    const subscription = subscriptions.find((item) => item.id === event.target.value) ?? null;
    setSelectedSubscription(subscription);
    if (selectedLandlord && subscription) {
      setNotificationText(generateNotificationMessage(subscription, selectedLandlord));
    }
  }

  const activeCount = landlords.filter((landlord) => landlord.status === 'active').length;
  const expiringCount = landlords.filter((landlord) => getRisk(getSubscriptionForLandlord(landlord, subscriptions)) === 'expiring').length;
  const overdueCount = landlords.filter((landlord) => getRisk(getSubscriptionForLandlord(landlord, subscriptions)) === 'overdue').length;
  const composerSubscriptions = subscriptions;

  return (
    <>
      <main className="container admin-no-hero">
        <div className="card-admin-header">
          <div>
            <p className="heading">Project Managers</p>
            <p className="subheading">Add project managers, manage subscriptions, approve accounts, and send renewal notifications from one place.</p>
          </div>
        </div>

        <section className="bento-section">
          <div className="bento">
            <article className="card">
              <div className="card-label"><span className="badge badge-pm"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M16 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="8.5" cy="7" r="4"/><line x1="20" y1="8" x2="20" y2="14"/><line x1="23" y1="11" x2="17" y2="11"/></svg></span>Project Manager Accounts</div>
              <h3 style={{ marginBottom: 16 }}>Workspace Accounts and Subscriptions</h3>

              {loading && <p className="landlord-muted">Loading project managers…</p>}
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
                        <td colSpan={7} className="landlord-empty">No project managers found.</td>
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
                              <button className="action-button secondary" style={{ padding: '6px 10px', fontSize: '12px' }} onClick={() => setSelectedLandlord(landlord)}>View</button>
                              {subscription && <button className="action-button info" style={{ padding: '6px 10px', fontSize: '12px' }} onClick={() => openNotification(subscription, landlord)}>Notify</button>}
                              {subscription && <button className="action-button warn" style={{ padding: '6px 10px', fontSize: '12px' }} onClick={() => handleUpgradeSubscription(landlord)}>Upgrade</button>}
                              {landlord.status !== 'active' && <button className="action-button primary" style={{ padding: '6px 10px', fontSize: '12px' }} onClick={() => handleApprove(landlord)}>Approve</button>}
                              <button className="action-button warn" style={{ padding: '6px 10px', fontSize: '12px' }} onClick={() => handleResetPassword(landlord)}>Reset Password</button>
                              <button className="action-button danger" style={{ padding: '6px 10px', fontSize: '12px' }} onClick={() => handleDeleteLandlord(landlord)}>Delete</button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              <div style={{ margin: '28px 0 0' }}>
                <button className="action-button primary" onClick={() => setShowAddModal(true)}>
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
                  Add Project Manager
                </button>
              </div>
            </article>
          </div>
        </section>
      </main>

      {showAddModal && (
        <div className="modal-overlay">
          <div className="modal-card landlord-modal">
            <div className="modal-title-row">
              <h3>Add New Project Manager</h3>
              <button className="action-button ghost" onClick={() => setShowAddModal(false)} style={{ padding: '4px 8px' }}>×</button>
            </div>
            {error && <p className="landlord-error">{error}</p>}
            <form onSubmit={handleAddLandlord} className="landlord-form">
              <div className="field-group">
                <label>Email</label>
                <input type="email" value={newEmail} onChange={(event) => setNewEmail(event.target.value)} required placeholder="manager@example.com" />
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
              <div className="field-group">
                <label>Phone (optional)</label>
                <input type="tel" value={newPhone} onChange={(event) => setNewPhone(event.target.value)} placeholder="+254 7xx xxx xxx" />
              </div>
              <div className="field-group">
                <label>Subscription Plan</label>
                <select value={newPlan} onChange={(event) => setNewPlan(event.target.value)} required>
                  <option value="monthly">Monthly - KSH 2,500</option>
                  <option value="quarterly">Quarterly - KSH 5,000</option>
                  <option value="yearly">Yearly - KSH 6,000</option>
                </select>
              </div>
              <div className="modal-actions">
                <button type="submit" disabled={loading} className="action-button primary">{loading ? 'Creating…' : 'Create Project Manager'}</button>
                <button type="button" className="action-button ghost" onClick={() => setShowAddModal(false)} disabled={loading}>Cancel</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {selectedLandlord && !selectedSubscription && (
        <div className="modal-overlay" onClick={(event) => event.target === event.currentTarget && setSelectedLandlord(null)}>
          <div className="modal-card landlord-modal">
            <div className="modal-title-row">
              <h3>Project Manager Details</h3>
              <button className="action-button ghost" onClick={() => setSelectedLandlord(null)}>×</button>
            </div>
            <div className="detail-grid">
              <div className="detail-card"><span>Full name</span><strong>{selectedLandlord.full_name}</strong></div>
              <div className="detail-card"><span>Organization</span><strong>{selectedLandlord.organization || '—'}</strong></div>
              <div className="detail-card"><span>Email</span><strong>{selectedLandlord.email}</strong></div>
              {selectedLandlord.phone && <div className="detail-card"><span>Phone</span><strong>{selectedLandlord.phone}</strong></div>}
              <div className="detail-card"><span>Status</span><strong>{selectedLandlord.status}</strong></div>
              <div className="detail-card"><span>Created</span><strong>{new Date(selectedLandlord.created_at).toLocaleDateString()}</strong></div>
            </div>
          </div>
        </div>
      )}

      {selectedLandlord && selectedSubscription && (
        <div className="modal-overlay" onClick={(event) => event.target === event.currentTarget && (setSelectedLandlord(null), setSelectedSubscription(null))}>
          <div className="modal-card landlord-modal">
            <div className="modal-title-row">
              <h3>Send Subscription Notification</h3>
              <button className="action-button ghost" onClick={() => (setSelectedLandlord(null), setSelectedSubscription(null))}>×</button>
            </div>
            <div className="notification-composer">
              <div className="composer-card">
                <label>To: {selectedLandlord.full_name}</label>
                <label>Plan: {selectedSubscription.plan}</label>
              </div>
              <div className="composer-card">
                <textarea rows={4} value={notificationText} onChange={(event) => setNotificationText(event.target.value)} placeholder="Notification message..." />
              </div>
              <div className="composer-controls">
                <select value={selectedLandlord.id} onChange={handleComposerLandlordChange}>
                  {landlords.map((landlord) => (
                    <option key={landlord.id} value={landlord.id}>{landlord.full_name}</option>
                  ))}
                </select>
                <select value={selectedSubscription.id} onChange={handleComposerSubscriptionChange}>
                  {composerSubscriptions.filter((s) => s.admin_id === selectedLandlord.id).map((subscription) => (
                    <option key={subscription.id} value={subscription.id}>{subscription.plan} - {new Date(subscription.expiry_date).toLocaleDateString()}</option>
                  ))}
                </select>
              </div>
              <div className="modal-actions">
                <button type="button" disabled={notificationLoading} onClick={() => sendNotification(selectedSubscription)} className="action-button info">Send Notification</button>
                <button type="button" className="action-button ghost" onClick={() => (setSelectedLandlord(null), setSelectedSubscription(null))} disabled={notificationLoading}>Cancel</button>
              </div>
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