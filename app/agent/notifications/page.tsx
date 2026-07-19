'use client';

import { useEffect, useMemo, useState } from 'react';
import { supabase } from '../../../lib/supabaseClient';

interface Notification {
  id: string;
  tenant: string;
  tenant_email: string;
  tenant_id?: string;
  message: string;
  status?: string;
  created_at: string;
  type?: string;
  recipient?: string;
  admin_email?: string;
  admin_name?: string;
  agent_id?: string;
}

interface Tenant {
  id: string;
  full_name: string;
  email: string;
}

export default function AgentNotificationsPage() {
  const [user, setUser] = useState<any>(null);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [tenants, setTenants] = useState<Tenant[]>([]);
  const [loading, setLoading] = useState(true);
  const [replyDraft, setReplyDraft] = useState('');
  const [selectedMessageId, setSelectedMessageId] = useState('');
  const [sending, setSending] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [newMessageDraft, setNewMessageDraft] = useState('');
  const [recipientTenant, setRecipientTenant] = useState<string>('');

  async function loadNotifications(agentId: string, propertyId: string) {
    setLoading(true);
    const { data: { session } } = await supabase.auth.getSession();
    const headers: Record<string, string> = { 'Content-Type': 'application/json' };
    if (session?.access_token) headers.Authorization = `Bearer ${session.access_token}`;

    const response = await fetch(`/api/notifications?agentId=${agentId}&propertyId=${propertyId}`, { headers });
    const result = await response.json();
    if (response.ok) {
      const mapped = (result.notifications ?? []).map((item: any) => ({
        ...item,
        tenant_id: item.tenant_id ?? item.tenants?.id ?? '',
        tenant: item.tenants?.full_name ?? item.tenant ?? '',
      }));
      setNotifications(mapped);
      setSelectedMessageId((current) => (current && mapped.some((item: Notification) => item.id === current) ? current : mapped[0]?.id || ''));
    }
    setLoading(false);
  }

  async function loadTenants(propertyId: string) {
    const { data: { session } } = await supabase.auth.getSession();
    const headers: Record<string, string> = { 'Content-Type': 'application/json' };
    if (session?.access_token) headers.Authorization = `Bearer ${session.access_token}`;

    const response = await fetch(`/api/tenants?propertyId=${propertyId}`, { headers });
    const result = await response.json();
    if (response.ok) {
      setTenants(result.tenants ?? []);
    }
  }

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      if (data.user) {
        setUser(data.user);
        const propertyId = data.user?.user_metadata?.property_id || '';
        loadNotifications(data.user.id, propertyId);
        loadTenants(propertyId);
      }
    });
  }, []);

  const selectedMessage = useMemo(() => notifications.find((item) => item.id === selectedMessageId) ?? notifications[0] ?? null, [notifications, selectedMessageId]);

  async function handleSendReply() {
    if (!user?.id || !selectedMessage?.tenant_id) return;
    const draft = replyDraft.trim();
    if (!draft) {
      setError('Please write a reply before sending.');
      return;
    }

    setSending(true);
    setError('');
    setMessage('');

    const { data: { session } } = await supabase.auth.getSession();
    const response = await fetch('/api/notifications', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(session?.access_token ? { Authorization: `Bearer ${session.access_token}` } : {}),
      },
      body: JSON.stringify({
        recipient: 'tenant',
        tenantId: selectedMessage.tenant_id,
        propertyId: user.user_metadata?.property_id || '',
        agentId: user.id,
        adminEmail: user.email || '',
        adminName: user.user_metadata?.full_name || 'Agent',
        type: 'agent_reply',
        message: draft,
      }),
    });

    const result = await response.json();
    setSending(false);

    if (!response.ok) {
      setError(result.message ?? 'Unable to send reply.');
      return;
    }

    setReplyDraft('');
    setMessage('Reply sent to tenant.');
    await loadNotifications(user.id, user.user_metadata?.property_id || '');
  }

  async function handleSendNewMessage() {
    if (!user?.id || !recipientTenant) return;
    const draft = newMessageDraft.trim();
    if (!draft) {
      setError('Please write a message before sending.');
      return;
    }

    setSending(true);
    setError('');
    setMessage('');

    const { data: { session } } = await supabase.auth.getSession();
    const response = await fetch('/api/notifications', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(session?.access_token ? { Authorization: `Bearer ${session.access_token}` } : {}),
      },
      body: JSON.stringify({
        recipient: 'tenant',
        tenantId: recipientTenant,
        propertyId: user.user_metadata?.property_id || '',
        agentId: user.id,
        adminEmail: user.email || '',
        adminName: user.user_metadata?.full_name || 'Agent',
        type: 'agent_message',
        message: draft,
      }),
    });

    const result = await response.json();
    setSending(false);

    if (!response.ok) {
      setError(result.message ?? 'Unable to send message.');
      return;
    }

    setNewMessageDraft('');
    setRecipientTenant('');
    setMessage('Message sent to tenant.');
    await loadNotifications(user.id, user.user_metadata?.property_id || '');
  }

  return (
    <>
      <style jsx global>{`
        @media (max-width: 760px) {
          .agent-inbox-layout {
            display: flex !important;
            flex-direction: column !important;
          }
          .agent-inbox-compose { order: 1 !important; }
          .agent-inbox-sidebar {
            order: 2 !important;
            border-right: none !important;
            border-bottom: 1px solid var(--line) !important;
            grid-column: auto !important;
            grid-row: auto !important;
          }
          .agent-inbox-thread { order: 3 !important; grid-column: auto !important; grid-row: auto !important; }
        }
      `}</style>
      <main className="container page-layout">
        <div className="card-admin-header">
          <div><p className="heading">Tenant Communications</p><p className="subheading">Reply to tenants and send direct messages.</p></div>
        </div>

        <section className="card" style={{ padding: 0, overflow: 'hidden', border: '1px solid rgba(16, 185, 129, 0.18)', boxShadow: '0 0 20px rgba(16, 185, 129, 0.08)' }}>
          <div style={{ padding: 16, borderBottom: '1px solid var(--line)', background: 'linear-gradient(135deg, rgba(240,253,244,0.95), rgba(255,255,255,0.98))' }}>
            <div className="card-label">Inbox</div>
            <h3 style={{ margin: '4px 0' }}>Tenant Messages</h3>
          </div>

          <div className="agent-inbox-layout" style={{ display: 'grid', gridTemplateColumns: 'minmax(280px, 340px) 1fr', minHeight: 560 }}>
            <aside className="agent-inbox-sidebar" style={{ borderRight: '1px solid var(--line)', background: '#f9fafb' }}>
              {loading && <p className="landlord-muted" style={{ padding: 16 }}>Loading communications…</p>}
              {!loading && notifications.length === 0 && <p className="landlord-empty" style={{ padding: 16 }}>No messages yet.</p>}
              {!loading && notifications.length > 0 && notifications.map((item) => {
                const isSelected = selectedMessage?.id === item.id;
                return (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => setSelectedMessageId(item.id)}
                    style={{ width: '100%', textAlign: 'left', border: 'none', borderBottom: '1px solid #e5e7eb', padding: '14px 16px', background: isSelected ? '#eefdf3' : 'transparent', cursor: 'pointer' }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8 }}>
                      <strong style={{ fontSize: '13px' }}>{item.tenant || 'Tenant'}</strong>
                      <span style={{ fontSize: '11px', color: 'var(--ink-3)' }}>{item.created_at ? new Date(item.created_at).toLocaleDateString() : ''}</span>
                    </div>
                    <div style={{ marginTop: 6, fontSize: '12px', color: '#111827' }}>{item.message.slice(0, 70)}{item.message.length > 70 ? '…' : ''}</div>
                  </button>
                );
              })}
            </aside>

            <div className="agent-inbox-compose" style={{ padding: 18 }}>
              <div style={{ padding: 12, borderRadius: 12, border: '1px solid #d1fae5', background: '#f0fdf4', marginBottom: 16 }}>
                <label style={{ display: 'block', fontSize: '12px', fontWeight: 700, color: '#047857', marginBottom: 8 }}>Start a new message</label>
                <select value={recipientTenant} onChange={(e) => setRecipientTenant(e.target.value)} style={{ width: '100%', borderRadius: 10, border: '1px solid #a7f3d0', padding: '10px 12px', marginBottom: 8 }}>
                  <option value="">Select a tenant</option>
                  {tenants.map((t) => (
                    <option key={t.id} value={t.id}>{t.full_name}</option>
                  ))}
                </select>
                <textarea
                  value={newMessageDraft}
                  onChange={(e) => setNewMessageDraft(e.target.value)}
                  rows={3}
                  placeholder="Type your message to tenant..."
                  style={{ width: '100%', borderRadius: 10, border: '1px solid #a7f3d0', padding: '10px 12px', resize: 'vertical' }}
                />
                <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 8 }}>
                  <button type="button" onClick={handleSendNewMessage} disabled={sending || !recipientTenant} style={{ padding: '8px 14px', borderRadius: 999, border: 'none', background: '#10b981', color: '#fff', cursor: 'pointer', fontWeight: 700 }}>
                    {sending ? 'Sending…' : 'Send message'}
                  </button>
                </div>
              </div>

              <div className="agent-inbox-thread">
                {selectedMessage ? (
                  <>
                    <div style={{ padding: 14, borderRadius: 12, background: '#f8fafc', border: '1px solid #e5e7eb' }}>
                      <div style={{ fontSize: '12px', fontWeight: 700, color: '#10b981', marginBottom: 6 }}>Message from {selectedMessage.tenant || 'Tenant'}</div>
                      <p style={{ margin: 0, lineHeight: 1.6, color: '#111827' }}>{selectedMessage.message}</p>
                    </div>

                    <div style={{ padding: 12, borderRadius: 12, border: '1px solid #d1fae5', background: '#f0fdf4', marginTop: 16 }}>
                      <label style={{ display: 'block', fontSize: '12px', fontWeight: 700, color: '#047857', marginBottom: 8 }}>Reply to tenant</label>
                      <textarea
                        value={replyDraft}
                        onChange={(e) => setReplyDraft(e.target.value)}
                        rows={4}
                        placeholder="Type your reply here..."
                        style={{ width: '100%', borderRadius: 10, border: '1px solid #a7f3d0', padding: '10px 12px', resize: 'vertical' }}
                      />
                      <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 8 }}>
                        <button type="button" onClick={handleSendReply} disabled={sending} style={{ padding: '8px 14px', borderRadius: 999, border: 'none', background: '#10b981', color: '#fff', cursor: 'pointer', fontWeight: 700 }}>
                          {sending ? 'Sending…' : 'Send reply'}
                        </button>
                      </div>
                      {message && <p style={{ margin: '10px 0 0', color: 'var(--accent)' }}>{message}</p>}
                      {error && <p style={{ margin: '10px 0 0', color: '#dc2626' }}>{error}</p>}
                    </div>
                  </>
                ) : (
                  <p className="landlord-empty">Select a message to reply.</p>
                )}
              </div>
            </div>
          </div>
        </section>
      </main>
    </>
  );
}