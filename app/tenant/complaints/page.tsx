'use client';

import { useEffect, useMemo, useState, type FormEvent, type KeyboardEvent } from 'react';
import { supabase } from '../../../lib/supabaseClient';

interface LandlordContext {
  landlord: { id: string; name: string; email: string } | null;
  tenantId: string;
  propertyId: string;
  propertyName: string;
  unitNumber: string;
}

interface NotificationItem {
  id: string;
  type: string;
  message: string;
  status: string;
  created_at: string;
  tenant_id?: string;
  property_id?: string;
  admin_email?: string;
}

interface ReplyItem {
  id: string;
  role: 'You' | 'Landlord';
  text: string;
  createdAt: string;
}

interface MessageItem extends NotificationItem {
  preview: string;
  isUnread: boolean;
  thread: ReplyItem[];
}

interface Complaint {
  id: string;
  message: string;
  status: string;
  created_at: string;
  category?: string;
  priority?: string;
}

const messageTypes = [
  { value: 'general', label: 'General Message' },
  { value: 'rent_inquiry', label: 'Rent Inquiry' },
  { value: 'maintenance_request', label: 'Maintenance Request' },
  { value: 'lease_question', label: 'Lease Question' },
  { value: 'other', label: 'Other' },
];

const alertTypes = ['overdue', 'reminder', 'lease_expired', 'lease_ending'];

export default function TenantCommunicationComplaintsPage() {
  const [user, setUser] = useState<any>(null);
  const [context, setContext] = useState<LandlordContext | null>(null);
  const [messages, setMessages] = useState<MessageItem[]>([]);
  const [complaints, setComplaints] = useState<Complaint[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [selectedMessageId, setSelectedMessageId] = useState('');
  const [replyDrafts, setReplyDrafts] = useState<Record<string, string>>({});
  const [starredIds, setStarredIds] = useState<string[]>([]);
  const [checkedIds, setCheckedIds] = useState<string[]>([]);
  const [deleting, setDeleting] = useState(false);
  const [sending, setSending] = useState(false);
  const [directForm, setDirectForm] = useState({ type: 'general', messageText: '' });
  const [complaintForm, setComplaintForm] = useState({
    category: 'maintenance',
    priority: 'medium',
    attachmentType: 'photo' as 'none' | 'photo' | 'video',
    attachmentLabel: '',
    messageText: '',
  });

  async function getAuthHeaders() {
    const { data } = await supabase.auth.getSession();
    const headers: Record<string, string> = { 'Content-Type': 'application/json' };
    if (data.session?.access_token) headers.Authorization = `Bearer ${data.session.access_token}`;
    return headers;
  }

  function buildMessageItem(item: NotificationItem, fallbackSelectedId?: string): MessageItem {
    return {
      ...item,
      preview: item.message,
      isUnread: item.id !== fallbackSelectedId,
      thread: [
        {
          id: `${item.id}-seed`,
          role: 'Landlord',
          text: item.message,
          createdAt: item.created_at || new Date().toISOString(),
        },
      ],
    };
  }

  async function loadContext(userId: string, email?: string) {
    try {
      const response = await fetch(`/api/tenant/landlord?userId=${encodeURIComponent(userId)}&email=${encodeURIComponent(email ?? '')}`, {
        headers: await getAuthHeaders(),
      });
      const result = await response.json();
      if (response.ok) setContext(result);
    } catch (e) {}
  }

  async function loadMessages(userId: string) {
    setLoading(true);
    setError('');

    try {
      const response = await fetch(`/api/tenant/notifications?userId=${encodeURIComponent(userId)}`, {
        headers: await getAuthHeaders(),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.message ?? 'Failed to load messages.');

      const incoming = (result.notifications ?? []) as NotificationItem[];
      const firstId = incoming[0]?.id || '';
      const nextMessages = incoming.map((item) => buildMessageItem(item, firstId));

      setMessages(nextMessages);
      setSelectedMessageId((current) => (current && nextMessages.some((item) => item.id === current) ? current : firstId));
      setReplyDrafts((prev) => {
        const draftMap: Record<string, string> = { ...prev };
        nextMessages.forEach((item) => {
          if (!draftMap[item.id]) draftMap[item.id] = '';
        });
        return draftMap;
      });
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  async function loadComplaints(userId: string) {
    try {
      const response = await fetch(`/api/tenant/complaints?userId=${encodeURIComponent(userId)}`, {
        headers: await getAuthHeaders(),
      });
      const result = await response.json();
      if (response.ok) setComplaints(result.comments ?? []);
    } catch (e) {}
  }

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      if (data.user) {
        setUser(data.user);
        loadContext(data.user.id, data.user.email);
        loadMessages(data.user.id);
        loadComplaints(data.user.id);
      }
    });
  }, []);

  const selectedMessage = useMemo(() => messages.find((item) => item.id === selectedMessageId) ?? messages[0] ?? null, [messages, selectedMessageId]);
  const unreadCount = messages.filter((item) => item.isUnread).length;
  const alertMessages = messages.filter((item) => alertTypes.includes(item.type));

  async function handleSendDirect(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setMessage('');
    setError('');

    if (!context?.tenantId || !context?.propertyId) {
      setError('Your tenancy details are not fully set up yet.');
      return;
    }
    if (!context.landlord?.email) {
      setError('No landlord is assigned to your property yet.');
      return;
    }

    setSending(true);
    const response = await fetch('/api/notifications', {
      method: 'POST',
      headers: await getAuthHeaders(),
      body: JSON.stringify({
        tenantId: context.tenantId,
        propertyId: context.propertyId,
        recipient: 'project_manager',
        type: directForm.type,
        message: directForm.messageText,
        adminEmail: context.landlord.email,
      }),
    });

    const result = await response.json();
    setSending(false);

    if (!response.ok) {
      setError(result.message ?? 'Failed to send message.');
      return;
    }

    setMessage(`Message sent to your landlord (${context.landlord.name}).`);
    setDirectForm({ type: 'general', messageText: '' });
  }

  async function handleComplaint(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setMessage('');
    setError('');

    if (!context?.tenantId || !context?.propertyId) {
      setError('Your tenancy details are not fully set up yet.');
      return;
    }

    setSending(true);
    const response = await fetch('/api/comments', {
      method: 'POST',
      headers: await getAuthHeaders(),
      body: JSON.stringify({
        tenantId: context.tenantId,
        propertyId: context.propertyId,
        recipientRole: 'landlord',
        recipientId: context.landlord?.id ?? null,
        message: complaintForm.messageText,
        category: complaintForm.category,
        priority: complaintForm.priority,
        attachmentType: complaintForm.attachmentType,
        attachmentLabel: complaintForm.attachmentLabel,
      }),
    });

    const result = await response.json();
    setSending(false);

    if (!response.ok) {
      setError(result.message ?? 'Unable to send complaint.');
      return;
    }

    setMessage(`Complaint submitted to your landlord${context.landlord?.name ? ` (${context.landlord.name})` : ''}.`);
    setComplaintForm({ category: 'maintenance', priority: 'medium', attachmentType: 'photo', attachmentLabel: '', messageText: '' });
    if (user) await loadComplaints(user.id);
  }

  async function handleDeleteNotification(messageId: string) {
    const headers = await getAuthHeaders();
    fetch(`/api/notifications?id=${encodeURIComponent(messageId)}`, { method: 'DELETE', headers }).catch(() => undefined);

    setMessages((current) => current.filter((item) => item.id !== messageId));
    setStarredIds((current) => current.filter((id) => id !== messageId));
    setCheckedIds((current) => current.filter((id) => id !== messageId));
    if (selectedMessageId === messageId) {
      const remaining = messages.filter((item) => item.id !== messageId);
      setSelectedMessageId(remaining[0]?.id || '');
    }
  }

  function handleToggleCheck(messageId: string) {
    setCheckedIds((current) => (current.includes(messageId) ? current.filter((id) => id !== messageId) : [...current, messageId]));
  }

  function handleToggleCheckAll() {
    setCheckedIds((current) => (current.length === messages.length ? [] : messages.map((m) => m.id)));
  }

  async function handleDeleteSelected() {
    if (checkedIds.length === 0) return;
    setDeleting(true);
    const headers = await getAuthHeaders();
    await Promise.all(checkedIds.map((id) => fetch(`/api/notifications?id=${encodeURIComponent(id)}`, { method: 'DELETE', headers }).catch(() => undefined)));
    setMessages((current) => current.filter((item) => !checkedIds.includes(item.id)));
    setStarredIds((current) => current.filter((id) => !checkedIds.includes(id)));
    if (checkedIds.includes(selectedMessageId)) {
      const remaining = messages.filter((item) => !checkedIds.includes(item.id));
      setSelectedMessageId(remaining[0]?.id || '');
    }
    setCheckedIds([]);
    setDeleting(false);
  }

  async function handleDeleteAll() {
    if (messages.length === 0) return;
    setDeleting(true);
    const headers = await getAuthHeaders();
    await Promise.all(messages.map((m) => fetch(`/api/notifications?id=${encodeURIComponent(m.id)}`, { method: 'DELETE', headers }).catch(() => undefined)));
    setMessages([]);
    setStarredIds([]);
    setCheckedIds([]);
    setSelectedMessageId('');
    setDeleting(false);
  }

  function handleToggleStar(messageId: string) {
    setStarredIds((current) => (current.includes(messageId) ? current.filter((id) => id !== messageId) : [...current, messageId]));
  }

  async function handleSendReply(messageId: string) {
    const draft = (replyDrafts[messageId] || '').trim();
    if (!draft) return;

    if (!context?.tenantId || !context?.propertyId || !context.landlord?.email) {
      setError('No landlord is assigned to your property yet.');
      return;
    }

    setReplyDrafts((current) => ({ ...current, [messageId]: '' }));
    setSelectedMessageId(messageId);
    setSending(true);

    const response = await fetch('/api/notifications', {
      method: 'POST',
      headers: await getAuthHeaders(),
      body: JSON.stringify({
        recipient: 'project_manager',
        tenantId: context.tenantId,
        propertyId: context.propertyId,
        type: 'reply',
        message: draft,
        adminEmail: context.landlord.email,
      }),
    });

    const result = await response.json();
    setSending(false);

    if (!response.ok) {
      setError(result.message ?? 'Unable to send reply to your landlord.');
      setReplyDrafts((current) => ({ ...current, [messageId]: draft }));
      return;
    }

    setMessages((current) => current.map((item) => item.id === messageId
      ? {
          ...item,
          isUnread: false,
          preview: draft,
          thread: [
            ...item.thread,
            {
              id: result.notification?.id || `${item.id}-reply-${Date.now()}`,
              role: 'You' as const,
              text: draft,
              createdAt: result.notification?.created_at || new Date().toISOString(),
            },
          ],
        }
      : item));
    setMessage('Reply sent to your landlord.');
  }

  function handleKeyDown(event: KeyboardEvent<HTMLTextAreaElement>, messageId: string) {
    if ((event.metaKey || event.ctrlKey) && event.key === 'Enter') {
      event.preventDefault();
      handleSendReply(messageId);
    }
  }

  return (
    <>
      <style jsx global>{`
        @media (max-width: 900px) {
          .communications-layout { grid-template-columns: 1fr !important; }
          .communications-sidebar { border-right: none !important; border-bottom: 1px solid var(--line) !important; }
        }
        @media (max-width: 600px) {
          th, td { padding: 8px 6px !important; font-size: 12px !important; }
          .table-shell { overflow-x: auto; }
        }
      `}</style>
      <main className="container admin-no-hero role-tenant">
        <div className="card-admin-header">
          <div>
            <p className="heading">Communication &amp; Complaints</p>
            <p className="subheading">
              Chat directly with your landlord{context?.landlord?.name ? ` (${context.landlord.name})` : ''}, receive rent and overdue alerts, and raise complaints.
            </p>
          </div>
        </div>

        <section className="card-grid" style={{ marginTop: 32, display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', alignItems: 'stretch', gap: 20, width: '100%' }}>
          <article className="card" style={{ minHeight: 260, display: 'flex', flexDirection: 'column', background: 'linear-gradient(135deg, #f0fdfa 0%, #ccfbf1 100%)' }}>
            <div className="card-label">
              <span className="badge badge-pm">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2-2z" /></svg>
              </span>
              Message My Landlord
            </div>
            <h3>Chat with your landlord</h3>
            <p className="landlord-muted" style={{ margin: '0 0 8px', fontSize: 12 }}>
              {context?.landlord ? `Goes only to your landlord — ${context.landlord.name}${context.propertyName ? ` (${context.propertyName}${context.unitNumber ? `, Unit ${context.unitNumber}` : ''})` : ''}.` : 'Resolving your landlord…'}
            </p>
            <form onSubmit={handleSendDirect} className="form-grid">
              <select value={directForm.type} onChange={(event) => setDirectForm((current) => ({ ...current, type: event.target.value }))} required>
                {messageTypes.map((type) => <option key={type.value} value={type.value}>{type.label}</option>)}
              </select>
              <textarea
                value={directForm.messageText}
                onChange={(event) => setDirectForm((current) => ({ ...current, messageText: event.target.value }))}
                required
                placeholder="Write a message to your landlord..."
                rows={4}
              />
              <button type="submit" disabled={sending || !context?.landlord}>{sending ? 'Sending…' : 'Send Message'}</button>
            </form>
            {message && <p className="landlord-success" style={{ marginTop: 16 }}>{message}</p>}
            {error && <p className="landlord-error" style={{ marginTop: 16 }}>{error}</p>}
          </article>

          <article className="card" style={{ minHeight: 260, display: 'flex', flexDirection: 'column', background: 'linear-gradient(135deg, #eff6ff 0%, #dbeafe 100%)' }}>
            <div className="card-label">
              <span className="badge badge-agent">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10" /><line x1="12" y1="8" x2="12" y2="12" /><line x1="12" y1="16" x2="12.01" y2="16" /></svg>
              </span>
              Raise a Complaint
            </div>
            <h3>Report a house issue</h3>
            <form onSubmit={handleComplaint} className="form-grid">
              <select value={complaintForm.category} onChange={(event) => setComplaintForm((current) => ({ ...current, category: event.target.value }))}>
                <option value="maintenance">Maintenance</option>
                <option value="plumbing">Plumbing</option>
                <option value="electrical">Electrical</option>
                <option value="security">Security</option>
                <option value="cleanliness">Cleanliness</option>
                <option value="other">Other</option>
              </select>
              <select value={complaintForm.priority} onChange={(event) => setComplaintForm((current) => ({ ...current, priority: event.target.value }))}>
                <option value="low">Low</option>
                <option value="medium">Medium</option>
                <option value="high">High</option>
              </select>
              <select value={complaintForm.attachmentType} onChange={(event) => setComplaintForm((current) => ({ ...current, attachmentType: event.target.value as 'none' | 'photo' | 'video' }))}>
                <option value="none">No media</option>
                <option value="photo">Attach a photo</option>
                <option value="video">Attach a video</option>
              </select>
              <input value={complaintForm.attachmentLabel} onChange={(event) => setComplaintForm((current) => ({ ...current, attachmentLabel: event.target.value }))} placeholder="Short note for the attached media" />
              <textarea
                value={complaintForm.messageText}
                onChange={(event) => setComplaintForm((current) => ({ ...current, messageText: event.target.value }))}
                required
                placeholder="Describe the issue in detail, including where it is and how urgent it feels..."
                rows={3}
              />
              <button type="submit" disabled={sending}>{sending ? 'Sending…' : 'Submit Complaint'}</button>
            </form>
            {complaints.length > 0 && (
              <div className="table-shell" style={{ overflowY: 'auto', flex: 1, maxHeight: 140, marginTop: 12 }}>
                <table className="landlord-table">
                  <thead>
                    <tr>
                      <th>Issue</th>
                      <th>Status</th>
                      <th>Date</th>
                    </tr>
                  </thead>
                  <tbody>
                    {complaints.map((complaint) => (
                      <tr key={complaint.id}>
                        <td>{complaint.message.slice(0, 60)}{complaint.message.length > 60 ? '…' : ''}</td>
                        <td><span className={`status-pill ${complaint.status === 'open' ? 'status-pending' : 'status-active'}`}>{complaint.status || 'open'}</span></td>
                        <td>{complaint.created_at ? new Date(complaint.created_at).toLocaleDateString() : ''}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </article>

          <article className="card" style={{ minHeight: 260, display: 'flex', flexDirection: 'column', background: 'linear-gradient(135deg, #fffbeb 0%, #fef3c7 100%)' }}>
            <div className="card-label">
              <span className="badge badge-pm">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M18 8a6 6 0 0 0-12 0c0 7-3 9-3 9h18s-3-2-3-9" /><path d="M13.73 21a2 2 0 0 1-3.46 0" /></svg>
              </span>
              Overdue &amp; Alerts
            </div>
            <h3>Messages needing attention</h3>
            {alertMessages.length === 0 ? (
              <p className="landlord-muted">No overdue or reminder alerts right now.</p>
            ) : (
              <div className="table-shell" style={{ overflowY: 'auto', flex: 1, maxHeight: 180 }}>
                <table className="landlord-table">
                  <thead>
                    <tr>
                      <th>Alert</th>
                      <th>Date</th>
                      <th>Type</th>
                    </tr>
                  </thead>
                  <tbody>
                    {alertMessages.map((item) => (
                      <tr key={item.id} style={{ cursor: 'pointer' }} onClick={() => {
                        setSelectedMessageId(item.id);
                        setMessages((current) => current.map((entry) => entry.id === item.id ? { ...entry, isUnread: false } : entry));
                      }}>
                        <td className="landlord-name">{item.message.slice(0, 45)}{item.message.length > 45 ? '…' : ''}</td>
                        <td>{new Date(item.created_at).toLocaleDateString()}</td>
                        <td>
                          <span className={`status-pill ${item.type === 'overdue' || item.type === 'lease_expired' ? 'status-active' : 'status-pending'}`}>
                            {item.type.replace(/_/g, ' ')}
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
              <h3 style={{ margin: '4px 0 0' }}>Messages from your landlord</h3>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <div style={{ fontSize: '13px', color: 'var(--ink-3)' }}>{unreadCount} unread</div>
            </div>
          </div>

          <div className="communications-layout" style={{ display: 'grid', gridTemplateColumns: 'minmax(280px, 360px) 1fr', minHeight: 520 }}>
            <aside className="communications-sidebar" style={{ borderRight: '1px solid var(--line)', background: '#f9fafb' }}>
              {loading && <p className="landlord-muted" style={{ padding: 16 }}>Loading messages…</p>}
              {!loading && messages.length === 0 && <p className="landlord-empty" style={{ padding: 16 }}>No messages yet.</p>}
              {!loading && messages.length > 0 && (
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, padding: '8px 12px', borderBottom: '1px solid #e5e7eb', background: '#f3f4f6' }}>
                  <label style={{ display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer', margin: 0 }}>
                    <input type="checkbox" checked={checkedIds.length === messages.length && messages.length > 0} onChange={handleToggleCheckAll} style={{ cursor: 'pointer', margin: 0 }} />
                    <span style={{ fontSize: 11, color: 'var(--ink-3)', fontWeight: 600 }}>Select all</span>
                  </label>
                  <div style={{ display: 'flex', gap: 6 }}>
                    {checkedIds.length > 0 && (
                      <button type="button" onClick={handleDeleteSelected} disabled={deleting} style={{ border: '1px solid #fecaca', borderRadius: 999, padding: '3px 10px', background: '#fff1f2', color: '#b91c1c', cursor: 'pointer', fontSize: 11, fontWeight: 700 }}>
                        {deleting ? 'Deleting…' : `Delete (${checkedIds.length})`}
                      </button>
                    )}
                    <button type="button" onClick={handleDeleteAll} disabled={deleting} style={{ border: '1px solid #fecaca', borderRadius: 999, padding: '3px 10px', background: '#fff', color: '#b91c1c', cursor: 'pointer', fontSize: 11, fontWeight: 700 }}>
                      Delete all
                    </button>
                  </div>
                </div>
              )}
              {!loading && messages.length > 0 && messages.map((item) => {
                const isSelected = selectedMessage?.id === item.id;
                const isChecked = checkedIds.includes(item.id);
                return (
                  <div
                    key={item.id}
                    style={{
                      position: 'relative',
                      borderBottom: '1px solid #e5e7eb',
                      background: isSelected ? '#eefdf3' : 'transparent',
                    }}
                  >
                    <button
                      type="button"
                      onClick={() => {
                        setSelectedMessageId(item.id);
                        setMessages((current) => current.map((entry) => entry.id === item.id ? { ...entry, isUnread: false } : entry));
                      }}
                      style={{
                        width: '100%',
                        textAlign: 'left',
                        border: 'none',
                        padding: '14px 44px 14px 16px',
                        background: 'transparent',
                        cursor: 'pointer',
                        display: 'flex',
                        flexDirection: 'column',
                        gap: 6,
                      }}
                    >
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8 }}>
                        <strong style={{ fontSize: '13px' }}>
                          Landlord
                          {context?.landlord?.name && (
                            <span style={{ fontSize: '11px', color: 'var(--ink-3)', fontWeight: 400 }}> — {context.landlord.name}</span>
                          )}
                        </strong>
                        <span style={{ fontSize: '11px', color: 'var(--ink-3)' }}>{new Date(item.created_at).toLocaleDateString()}</span>
                      </div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8 }}>
                        <span style={{ fontSize: '12px', color: '#111827', fontWeight: item.isUnread ? 700 : 500 }}>{item.preview.slice(0, 70)}{item.preview.length > 70 ? '…' : ''}</span>
                        {item.isUnread && <span style={{ width: 8, height: 8, borderRadius: '50%', background: '#10b981' }} />}
                      </div>
                    </button>
                    <input
                      type="checkbox"
                      checked={isChecked}
                      onChange={() => handleToggleCheck(item.id)}
                      onClick={(e) => e.stopPropagation()}
                      style={{ position: 'absolute', left: 4, top: 4, cursor: 'pointer', margin: 0, width: 12, height: 12, opacity: 0.55 }}
                    />
                    <button
                      type="button"
                      onClick={() => handleDeleteNotification(item.id)}
                      title="Delete message"
                      style={{ position: 'absolute', right: 10, top: 12, border: '1px solid #fecaca', borderRadius: 999, width: 24, height: 24, background: '#fff1f2', color: '#b91c1c', cursor: 'pointer', fontSize: 13, lineHeight: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 0 }}
                    >
                      ×
                    </button>
                  </div>
                );
              })}
            </aside>

            <div style={{ padding: 18, display: 'flex', flexDirection: 'column', gap: 16 }}>
              {selectedMessage ? (
                <>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12 }}>
                    <div>
                      <div style={{ fontSize: '12px', color: 'var(--ink-3)', textTransform: 'uppercase', letterSpacing: '0.08em' }}>Conversation</div>
                      <h4 style={{ margin: '4px 0 2px' }}>Landlord update</h4>
                      <p style={{ margin: 0, color: 'var(--ink-3)', fontSize: '13px' }}>{selectedMessage.type.replace(/_/g, ' ')}</p>
                    </div>
                    <div style={{ display: 'flex', gap: 8 }}>
                      <button type="button" onClick={() => handleToggleStar(selectedMessage.id)} style={{ border: '1px solid #d1d5db', borderRadius: 999, padding: '6px 10px', background: starredIds.includes(selectedMessage.id) ? '#fef3c7' : '#fff', cursor: 'pointer' }}>
                        {starredIds.includes(selectedMessage.id) ? '★ Starred' : '☆ Star'}
                      </button>
                      <button type="button" onClick={() => handleDeleteNotification(selectedMessage.id)} style={{ border: '1px solid #fecaca', borderRadius: 999, padding: '6px 10px', background: '#fff1f2', color: '#b91c1c', cursor: 'pointer' }}>
                        Delete
                      </button>
                    </div>
                  </div>

                  <div style={{ padding: 14, background: '#f8fafc', borderRadius: 12, border: '1px solid #e5e7eb' }}>
                    <div style={{ fontSize: '12px', fontWeight: 700, color: '#10b981', marginBottom: 6 }}>Message</div>
                    <p style={{ margin: 0, lineHeight: 1.6, color: '#111827' }}>{selectedMessage.message}</p>
                  </div>

                  <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                    {selectedMessage.thread.map((entry) => (
                      <div key={entry.id} style={{ padding: 12, borderRadius: 12, background: entry.role === 'You' ? '#ecfdf5' : '#ffffff', border: entry.role === 'You' ? '1px solid #a7f3d0' : '1px solid #e5e7eb' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                          <strong style={{ fontSize: '12px', color: '#111827' }}>{entry.role}</strong>
                          <span style={{ fontSize: '11px', color: 'var(--ink-3)' }}>{new Date(entry.createdAt).toLocaleString()}</span>
                        </div>
                        <p style={{ margin: 0, color: '#374151', lineHeight: 1.5 }}>{entry.text}</p>
                      </div>
                    ))}
                  </div>

                  <div style={{ padding: 12, border: '1px solid #d1fae5', borderRadius: 12, background: '#f0fdf4' }}>
                    <label style={{ display: 'block', fontSize: '12px', fontWeight: 700, color: '#047857', marginBottom: 8 }}>Reply to your landlord</label>
                    <textarea
                      value={replyDrafts[selectedMessage.id] || ''}
                      onChange={(event) => setReplyDrafts((current) => ({ ...current, [selectedMessage.id]: event.target.value }))}
                      onKeyDown={(event) => handleKeyDown(event, selectedMessage.id)}
                      placeholder="Reply with a quick follow-up…"
                      rows={4}
                      style={{ width: '100%', borderRadius: 10, border: '1px solid #a7f3d0', padding: '10px 12px', resize: 'vertical' }}
                    />
                    <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 8 }}>
                      <button type="button" onClick={() => handleSendReply(selectedMessage.id)} disabled={sending || !context?.landlord} style={{ padding: '8px 14px', borderRadius: 999, border: 'none', background: sending ? '#6ee7b7' : '#10b981', color: '#fff', cursor: 'pointer', fontWeight: 700 }}>
                        {sending ? 'Sending…' : 'Send reply'}
                      </button>
                    </div>
                    <p style={{ margin: '8px 0 0', fontSize: '11px', color: 'var(--ink-3)' }}>Tip: press ⌘/Ctrl + Enter to send instantly.</p>
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
          <div className="footer-links"><a href="/">Home</a><a href="/tenant/dashboard">Dashboard</a></div>
          <div className="footer-copy">© 2026 Springfield Systems. All rights reserved.</div>
        </div>
      </footer>
    </>
  );
}