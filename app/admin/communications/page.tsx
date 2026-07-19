'use client';

import { useEffect, useMemo, useState, type FormEvent, type KeyboardEvent } from 'react';
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
  admin_id?: string;
  admin_name?: string;
  admin_email?: string;
  agent_id?: string;
  type: string;
  message: string;
  status: string;
  created_at: string;
  recipient?: string;
  tenant_id?: string;
  tenant_name?: string;
  tenant_email?: string;
}

interface ReplyItem {
  id: string;
  role: 'You' | 'Landlord' | 'Agent' | 'Tenant' | 'System';
  text: string;
  createdAt: string;
}

interface MessageItem extends Notification {
  roleLabel: 'Landlord' | 'Agent' | 'Tenant';
  preview: string;
  isUnread: boolean;
  thread: ReplyItem[];
}

export default function CommunicationsPage() {
  const [messages, setMessages] = useState<MessageItem[]>([]);
  const [tenants, setTenants] = useState<Tenant[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [selectedMessageId, setSelectedMessageId] = useState('');
  const [replyDrafts, setReplyDrafts] = useState<Record<string, string>>({});
  const [starredIds, setStarredIds] = useState<string[]>([]);
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

  function resolveRole(item: Notification): MessageItem['roleLabel'] {
    if (item.recipient === 'tenant' || item.tenant_id) return 'Tenant';
    if (item.agent_id) return 'Agent';
    return 'Landlord';
  }

  function buildMessageItem(item: Notification, fallbackSelectedId?: string): MessageItem {
    const roleLabel = resolveRole(item);
    const thread: ReplyItem[] = [
      {
        id: `${item.id}-seed`,
        role: roleLabel,
        text: item.message,
        createdAt: item.created_at || new Date().toISOString(),
      },
    ];

    return {
      ...item,
      roleLabel,
      preview: item.message,
      isUnread: item.id !== fallbackSelectedId,
      thread,
    };
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
      const incoming = (result.notifications ?? []) as Notification[];
      const firstId = incoming[0]?.id || '';
      const nextMessages = incoming.map((item) => buildMessageItem(item, firstId));

      setMessages(nextMessages);
      setSelectedMessageId((current) => (current && nextMessages.some((message) => message.id === current) ? current : firstId));
      setReplyDrafts((prev) => {
        const draftMap: Record<string, string> = { ...prev };
        nextMessages.forEach((message) => {
          if (!draftMap[message.id]) draftMap[message.id] = '';
        });
        return draftMap;
      });
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

  const selectedMessage = useMemo(() => messages.find((message) => message.id === selectedMessageId) ?? messages[0] ?? null, [messages, selectedMessageId]);
  const unreadCount = messages.filter((message) => message.isUnread).length;

  async function handleSendNotification(event: FormEvent<HTMLFormElement>) {
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

    if (notificationForm.tenantId) {
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

  function handleDeleteNotification(messageId: string) {
    setMessages((current) => current.filter((message) => message.id !== messageId));
    setStarredIds((current) => current.filter((id) => id !== messageId));
    if (selectedMessageId === messageId) {
      const remaining = messages.filter((message) => message.id !== messageId);
      setSelectedMessageId(remaining[0]?.id || '');
    }
  }

  function handleToggleStar(messageId: string) {
    setStarredIds((current) => (current.includes(messageId) ? current.filter((id) => id !== messageId) : [...current, messageId]));
  }

  function handleSendReply(messageId: string) {
    const draft = (replyDrafts[messageId] || '').trim();
    if (!draft) return;

    setMessages((current) => current.map((message) => message.id === messageId
      ? {
          ...message,
          isUnread: false,
          preview: draft,
          thread: [
            ...message.thread,
            {
              id: `${message.id}-reply-${Date.now()}`,
              role: 'You',
              text: draft,
              createdAt: new Date().toISOString(),
            },
          ],
        }
      : message));

    setReplyDrafts((current) => ({ ...current, [messageId]: '' }));
    setSelectedMessageId(messageId);
    setMessage('Reply sent to the thread.');
  }

  function handleKeyDown(event: KeyboardEvent<HTMLTextAreaElement>, messageId: string) {
    if ((event.metaKey || event.ctrlKey) && event.key === 'Enter') {
      event.preventDefault();
      handleSendReply(messageId);
    }
  }

  const notificationTypes = [
    { value: 'announcement', label: 'Announcement' },
    { value: 'reminder', label: 'Reminder' },
    { value: 'overdue', label: 'Overdue Alert' },
    { value: 'lease_expired', label: 'Lease Expired' },
    { value: 'lease_ending', label: 'Lease Ending' },
  ];

  const today = new Date().toISOString().slice(0, 10);
  const nextWeek = new Date();
  nextWeek.setDate(nextWeek.getDate() + 7);
  const nextWeekStr = nextWeek.toISOString().slice(0, 10);
  const overdueTenants = tenants.filter((tenant) => tenant.lease_end <= nextWeekStr);

  return (
    <>
      <style jsx global>{`
        @media (max-width: 900px) {
          .communications-shell {
            grid-template-columns: 1fr !important;
          }
          .communications-sidebar {
            border-right: none !important;
            border-bottom: 1px solid var(--line) !important;
          }
          .card-grid {
            grid-template-columns: 1fr !important;
          }
          .communications-inbox-grid {
            grid-template-columns: 1fr !important;
            min-height: auto !important;
          }
        }
        @media (max-width: 600px) {
          .card-shell, .table-shell {
            overflow-x: auto;
          }
          table {
            font-size: 12px;
          }
          th, td {
            padding: 8px 6px !important;
          }
          .communications-form-row {
            grid-template-columns: 1fr !important;
          }
        }
      `}</style>
      <main className="container admin-no-hero">
        <div className="card-admin-header">
          <div>
            <p className="heading">Communications</p>
            <p className="subheading">A shared inbox for landlord, agent, and tenant conversations.</p>
          </div>
        </div>

        <section className="card-grid" style={{ gap: 20, gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))' }}>
          <article className="card">
            <div className="card-label">
              <span className="badge badge-pm">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2-2z" /></svg>
              </span>
              Send Notification
            </div>
            <h3>Create a message</h3>
            <form onSubmit={handleSendNotification} className="form-grid" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))' }}>
              <select value={notificationForm.type} onChange={(event) => setNotificationForm((current) => ({ ...current, type: event.target.value }))} required>
                {notificationTypes.map((type) => <option key={type.value} value={type.value}>{type.label}</option>)}
              </select>
              <select value={notificationForm.tenantId} onChange={(event) => setNotificationForm((current) => ({ ...current, tenantId: event.target.value }))}>
                <option value="">All tenants (broadcast)</option>
                {tenants.map((tenant) => (
                  <option key={tenant.id} value={tenant.id}>
                    {tenant.full_name}
                  </option>
                ))}
              </select>
              <textarea
                value={notificationForm.messageText}
                onChange={(event) => setNotificationForm((current) => ({ ...current, messageText: event.target.value }))}
                required
                placeholder="Write a notice, reminder, or update..."
                rows={4}
                style={{ gridColumn: '1 / -1' }}
              />
              <button type="submit" disabled={sending} style={{ gridColumn: '1 / -1' }}>{sending ? 'Sending…' : 'Send Notification'}</button>
            </form>
            {message && <p className="landlord-success" style={{ marginTop: 16 }}>{message}</p>}
            {error && <p className="landlord-error" style={{ marginTop: 16 }}>{error}</p>}
          </article>

          <article className="card">
            <div className="card-label">
              <span className="badge badge-agent">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2-2z" /></svg>
              </span>
              Follow-up Queue
            </div>
            <h3>Tenants needing attention</h3>
            {overdueTenants.length === 0 ? (
              <p className="landlord-muted">No tenants with leases ending soon.</p>
            ) : (
              <div className="table-shell" style={{ maxHeight: '200px', overflowY: 'auto' }}>
                <table className="landlord-table">
                  <thead>
                    <tr>
                      <th style={{ padding: '8px 6px' }}>Tenant</th>
                      <th style={{ padding: '8px 6px' }}>Lease End</th>
                      <th style={{ padding: '8px 6px' }}>Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {overdueTenants.map((tenant) => (
                      <tr key={tenant.id}>
                        <td className="landlord-name" style={{ padding: '8px 6px' }}>{tenant.full_name}</td>
                        <td style={{ padding: '8px 6px' }}>{tenant.lease_end}</td>
                        <td style={{ padding: '8px 6px' }}>
                          <span className={`status-pill ${tenant.lease_end < today ? 'status-active' : 'status-pending'}`}>
                            {tenant.lease_end < today ? 'Overdue' : 'Ending Soon'}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </article>
        </section>

        <section className="card" style={{ marginTop: 24, padding: 0, overflow: 'hidden', border: '1px solid rgba(16, 185, 129, 0.2)', boxShadow: '0 0 20px rgba(16, 185, 129, 0.10)' }}>
          <div style={{ padding: 16, borderBottom: '1px solid var(--line)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: 'linear-gradient(135deg, rgba(240,253,244,0.95), rgba(255,255,255,0.98))' }}>
            <div>
              <div className="card-label">Inbox</div>
              <h3 style={{ margin: '4px 0 0' }}>Shared communications</h3>
            </div>
            <div style={{ fontSize: '13px', color: 'var(--ink-3)' }}>{unreadCount} unread</div>
          </div>

          <div className="communications-inbox-grid" style={{ display: 'grid', gridTemplateColumns: 'minmax(280px, 360px) 1fr', minHeight: 400 }}>
            <aside style={{ borderRight: '1px solid var(--line)', background: '#f9fafb', maxHeight: '400px', overflowY: 'auto' }}>
              {loading && <p className="landlord-muted" style={{ padding: 16 }}>Loading communications…</p>}
              {!loading && messages.length === 0 && <p className="landlord-empty" style={{ padding: 16 }}>No communications yet.</p>}
              {!loading && messages.length > 0 && messages.map((message) => {
                const isSelected = selectedMessage?.id === message.id;
                return (
                  <button
                    key={message.id}
                    type="button"
                    onClick={() => {
                      setSelectedMessageId(message.id);
                      setMessages((current) => current.map((item) => item.id === message.id ? { ...item, isUnread: false } : item));
                    }}
                    style={{
                      width: '100%',
                      textAlign: 'left',
                      border: 'none',
                      borderBottom: '1px solid #e5e7eb',
                      padding: '12px 14px',
                      background: isSelected ? '#eefdf3' : 'transparent',
                      cursor: 'pointer',
                      display: 'flex',
                      flexDirection: 'column',
                      gap: 4,
                    }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                      <strong style={{ fontSize: '12px' }}>{message.roleLabel}</strong>
                      <span style={{ fontSize: '11px', color: 'var(--ink-3)' }}>{new Date(message.created_at).toLocaleDateString()}</span>
                    </div>
                    <span style={{ fontSize: '12px', color: '#111827', fontWeight: message.isUnread ? 700 : 500 }}>{message.preview.slice(0, 50)}{message.preview.length > 50 ? '…' : ''}</span>
                    {message.isUnread && <span style={{ width: 8, height: 8, borderRadius: '50%', background: '#10b981', alignSelf: 'flex-start' }} />}
                  </button>
                );
              })}
            </aside>

            <div style={{ padding: 16, display: 'flex', flexDirection: 'column', gap: 12 }}>
              {selectedMessage ? (
                <>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12, flexWrap: 'wrap' }}>
                    <div>
                      <div style={{ fontSize: '12px', color: 'var(--ink-3)', textTransform: 'uppercase', letterSpacing: '0.08em' }}>Conversation</div>
                      <h4 style={{ margin: '4px 0 2px' }}>{selectedMessage.roleLabel}</h4>
                      <p style={{ margin: 0, color: 'var(--ink-3)', fontSize: '13px' }}>{selectedMessage.type}</p>
                    </div>
                    <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                      <button type="button" onClick={() => handleToggleStar(selectedMessage.id)} style={{ border: '1px solid #d1d5db', borderRadius: 999, padding: '6px 10px', background: starredIds.includes(selectedMessage.id) ? '#fef3c7' : '#fff', cursor: 'pointer', fontSize: '12px' }}>
                        {starredIds.includes(selectedMessage.id) ? '★' : '☆'}
                      </button>
                      <button type="button" onClick={() => handleDeleteNotification(selectedMessage.id)} style={{ border: '1px solid #fecaca', borderRadius: 999, padding: '6px 10px', background: '#fff1f2', color: '#b91c1c', cursor: 'pointer', fontSize: '12px' }}>
                        Delete
                      </button>
                    </div>
                  </div>

                  <div style={{ padding: 12, background: '#f8fafc', borderRadius: 12, border: '1px solid #e5e7eb' }}>
                    <div style={{ fontSize: '12px', fontWeight: 700, color: '#10b981', marginBottom: 6 }}>Message</div>
                    <p style={{ margin: 0, lineHeight: 1.6, color: '#111827' }}>{selectedMessage.message}</p>
                  </div>

                  <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                    {selectedMessage.thread.map((entry) => (
                      <div key={entry.id} style={{ padding: 10, borderRadius: 10, background: entry.role === 'You' ? '#ecfdf5' : '#ffffff', border: entry.role === 'You' ? '1px solid #a7f3d0' : '1px solid #e5e7eb' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4, flexWrap: 'wrap' }}>
                          <strong style={{ fontSize: '12px', color: '#111827' }}>{entry.role}</strong>
                          <span style={{ fontSize: '11px', color: 'var(--ink-3)' }}>{new Date(entry.createdAt).toLocaleString()}</span>
                        </div>
                        <p style={{ margin: 0, color: '#374151', lineHeight: 1.5 }}>{entry.text}</p>
                      </div>
                    ))}
                  </div>

                  <div style={{ padding: 12, border: '1px solid #d1fae5', borderRadius: 12, background: '#f0fdf4' }}>
                    <label style={{ display: 'block', fontSize: '12px', fontWeight: 700, color: '#047857', marginBottom: 8 }}>Reply</label>
                    <textarea
                      value={replyDrafts[selectedMessage.id] || ''}
                      onChange={(event) => setReplyDrafts((current) => ({ ...current, [selectedMessage.id]: event.target.value }))}
                      onKeyDown={(event) => handleKeyDown(event, selectedMessage.id)}
                      placeholder="Reply with a quick follow-up…"
                      rows={3}
                      style={{ width: '100%', borderRadius: 10, border: '1px solid #a7f3d0', padding: '10px 12px', resize: 'vertical', fontSize: '14px' }}
                    />
                    <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 8 }}>
                      <button type="button" onClick={() => handleSendReply(selectedMessage.id)} style={{ padding: '8px 14px', borderRadius: 999, border: 'none', background: '#10b981', color: '#fff', cursor: 'pointer', fontWeight: 700, fontSize: '13px' }}>
                        Send reply
                      </button>
                    </div>
                    <p style={{ margin: '8px 0 0', fontSize: '11px', color: 'var(--ink-3)' }}>Tip: press ⌘/Ctrl + Enter to send.</p>
                  </div>
                </>
              ) : (
                <p className="landlord-empty">Select a message to view the details.</p>
              )}
            </div>
          </div>
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