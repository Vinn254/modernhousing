'use client';

import { useEffect, useMemo, useState } from 'react';
import { supabase } from '../../../lib/supabaseClient';

interface Notification {
  id: string;
  message: string;
  created_at: string;
  type?: string;
  admin_email?: string;
  admin_name?: string;
  agent_id?: string;
  status?: string;
  recipient?: string;
}

export default function TenantNotificationsPage() {
  const [user, setUser] = useState<any>(null);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(true);
  const [replyDraft, setReplyDraft] = useState('');
  const [selectedMessageId, setSelectedMessageId] = useState('');
  const [sending, setSending] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [newMessageDraft, setNewMessageDraft] = useState('');
  const [recipientTarget, setRecipientTarget] = useState<'landlord' | 'agent'>('landlord');

  async function loadNotifications(userId: string) {
    setLoading(true);
    const { data: { session } } = await supabase.auth.getSession();
    const response = await fetch(`/api/tenant/notifications?userId=${encodeURIComponent(userId)}`, {
      headers: session?.access_token ? { Authorization: `Bearer ${session.access_token}` } : undefined,
    });
    const result = await response.json();
    if (response.ok) {
      const nextMessages = result.notifications ?? [];
      setNotifications(nextMessages);
      setSelectedMessageId((current) => (current && nextMessages.some((item: Notification) => item.id === current) ? current : nextMessages[0]?.id || ''));
    }
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

  const selectedMessage = useMemo(() => notifications.find((item) => item.id === selectedMessageId) ?? notifications[0] ?? null, [notifications, selectedMessageId]);
  const senderLabel = selectedMessage?.agent_id ? 'Agent' : 'Landlord';

  async function handleSendReply() {
    if (!user?.id || !selectedMessage) return;
    const tenantId = user?.user_metadata?.tenant_id || '';
    const draft = replyDraft.trim();
    if (!draft || !tenantId) {
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
        recipient: selectedMessage.agent_id ? 'agent' : 'project_manager',
        tenantId,
        adminEmail: selectedMessage.admin_email || user.email || '',
        agentId: selectedMessage.agent_id || null,
        adminName: selectedMessage.admin_name || (selectedMessage.agent_id ? 'Agent' : 'Landlord'),
        type: 'reply',
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
    setMessage(selectedMessage.agent_id ? 'Reply sent to your agent.' : 'Reply sent to your landlord.');
    await loadNotifications(user.id);
  }

  async function handleSendNewMessage() {
    if (!user?.id) return;
    const tenantId = user?.user_metadata?.tenant_id || '';
    const draft = newMessageDraft.trim();
    if (!draft || !tenantId) {
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
        recipient: recipientTarget === 'agent' ? 'agent' : 'project_manager',
        tenantId,
        adminEmail: user.email || '',
        type: 'reply',
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
    setRecipientTarget('landlord');
    setMessage(recipientTarget === 'agent' ? 'Message sent to your agent.' : 'Message sent to your landlord.');
    await loadNotifications(user.id);
  }

  return (
    <>
      <style jsx global>{`
        @media (max-width: 760px) {
          .tenant-inbox-layout { grid-template-columns: 1fr !important; }
          .tenant-inbox-sidebar { border-right: none !important; border-bottom: 1px solid var(--line) !important; }
        }
      `}</style>
      <main className="container page-layout">
        <div className="card-admin-header">
          <div><p className="heading">Communications</p><p className="subheading">Send direct messages to your landlord or agent and keep every reply in one place.</p></div>
        </div>

        <section className="card" style={{ padding: 0, overflow: 'hidden', border: '1px solid rgba(16, 185, 129, 0.18)', boxShadow: '0 0 20px rgba(16, 185, 129, 0.08)' }}>
          <div style={{ padding: 16, borderBottom: '1px solid var(--line)', background: 'linear-gradient(135deg, rgba(240,253,244,0.95), rgba(255,255,255,0.98))' }}>
            <div className="card-label">Inbox</div>
            <h3 style={{ margin: '4px 0' }}>Your messages</h3>
          </div>

          <div className="tenant-inbox-layout" style={{ display: 'grid', gridTemplateColumns: 'minmax(280px, 340px) 1fr', minHeight: 560 }}>
            <aside className="tenant-inbox-sidebar" style={{ borderRight: '1px solid var(--line)', background: '#f9fafb' }}>
            {loading && <p className="landlord-muted" style={{ padding: 16 }}>Loading communications…</p>}
            {!loading && notifications.length === 0 && <p className="landlord-empty" style={{ padding: 16 }}>No messages yet.</p>}
            {!loading && notifications.length > 0 && notifications.map((item) => {
              const isSelected = selectedMessage?.id === item.id;
              const contactLabel = item.agent_id ? 'Agent' : 'Landlord';
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => setSelectedMessageId(item.id)}
                  style={{ width: '100%', textAlign: 'left', border: 'none', borderBottom: '1px solid #e5e7eb', padding: '14px 16px', background: isSelected ? '#eefdf3' : 'transparent', cursor: 'pointer' }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8 }}>
                    <strong style={{ fontSize: '13px' }}>{contactLabel}</strong>
                    <span style={{ fontSize: '11px', color: 'var(--ink-3)' }}>{new Date(item.created_at).toLocaleDateString()}</span>
                  </div>
                  <div style={{ marginTop: 6, fontSize: '12px', color: '#111827' }}>{item.message.slice(0, 70)}{item.message.length > 70 ? '…' : ''}</div>
                </button>
              );
            })}
          </aside>

          <div style={{ padding: 18, display: 'flex', flexDirection: 'column', gap: 16 }}>
            <div style={{ padding: 12, borderRadius: 12, border: '1px solid #d1fae5', background: '#f0fdf4' }}>
              <label style={{ display: 'block', fontSize: '12px', fontWeight: 700, color: '#047857', marginBottom: 8 }}>Start a direct message</label>
              <select value={recipientTarget} onChange={(event) => setRecipientTarget(event.target.value as 'landlord' | 'agent')} style={{ width: '100%', borderRadius: 10, border: '1px solid #a7f3d0', padding: '10px 12px', marginBottom: 8 }}>
                <option value="landlord">Landlord</option>
                <option value="agent">Agent</option>
              </select>
              <textarea
                value={newMessageDraft}
                onChange={(event) => setNewMessageDraft(event.target.value)}
                rows={3}
                placeholder={recipientTarget === 'agent' ? 'Send a note to your agent...' : 'Send a note to your landlord...'}
                style={{ width: '100%', borderRadius: 10, border: '1px solid #a7f3d0', padding: '10px 12px', resize: 'vertical' }}
              />
              <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 8 }}>
                <button type="button" onClick={handleSendNewMessage} disabled={sending} style={{ padding: '8px 14px', borderRadius: 999, border: 'none', background: '#10b981', color: '#fff', cursor: 'pointer', fontWeight: 700 }}>
                  {sending ? 'Sending…' : 'Send message'}
                </button>
              </div>
            </div>

            {selectedMessage ? (
              <>
                <div style={{ padding: 14, borderRadius: 12, background: '#f8fafc', border: '1px solid #e5e7eb' }}>
                  <div style={{ fontSize: '12px', fontWeight: 700, color: '#10b981', marginBottom: 6 }}>Message from {senderLabel}</div>
                  <p style={{ margin: 0, lineHeight: 1.6, color: '#111827' }}>{selectedMessage.message}</p>
                </div>

                <div style={{ padding: 12, borderRadius: 12, border: '1px solid #d1fae5', background: '#f0fdf4' }}>
                  <label style={{ display: 'block', fontSize: '12px', fontWeight: 700, color: '#047857', marginBottom: 8 }}>Reply to {senderLabel}</label>
                  <textarea
                    value={replyDraft}
                    onChange={(event) => setReplyDraft(event.target.value)}
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
      </section>
    </main>
    </>
  );
}