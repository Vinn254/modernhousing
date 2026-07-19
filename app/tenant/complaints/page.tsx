'use client';

import { useEffect, useMemo, useState, type ChangeEvent, type FormEvent } from 'react';
import { supabase } from '../../../lib/supabaseClient';

interface Comment {
  id: string;
  message: string;
  status: string;
  created_at: string;
  category?: string;
  priority?: string;
  recipient_role?: string;
  attachment_type?: string;
}

export default function TenantComplaintsPage() {
  const [user, setUser] = useState<any>(null);
  const [comments, setComments] = useState<Comment[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [complaint, setComplaint] = useState('');
  const [category, setCategory] = useState('maintenance');
  const [priority, setPriority] = useState('medium');
  const [recipientRole, setRecipientRole] = useState<'landlord' | 'agent'>('agent');
  const [attachmentType, setAttachmentType] = useState<'none' | 'photo' | 'video'>('photo');
  const [attachmentLabel, setAttachmentLabel] = useState('');
  const [submitting, setSubmitting] = useState(false);

  async function loadComments(userId: string) {
    setLoading(true);
    const { data: { session } } = await supabase.auth.getSession();
    const response = await fetch(`/api/tenant/complaints?userId=${encodeURIComponent(userId)}`, {
      headers: session?.access_token ? { Authorization: `Bearer ${session.access_token}` } : undefined,
    });
    const result = await response.json();
    if (response.ok) setComments(result.comments ?? []);
    setLoading(false);
  }

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      if (data.user) {
        setUser(data.user);
        loadComments(data.user.id);
      }
    });
  }, []);

  const summary = useMemo(() => {
    const label = recipientRole === 'agent' ? 'Agent' : 'Landlord';
    const attachmentHint = attachmentType === 'none' ? 'No media attached' : attachmentType === 'video' ? 'Video attachment planned' : 'Photo attachment planned';
    return `${label} • ${category} • ${priority} • ${attachmentHint}`;
  }, [attachmentType, category, priority, recipientRole]);

  async function handleComplaint(event: FormEvent) {
    event.preventDefault();
    setSubmitting(true);
    setError('');

    const { data: { session } } = await supabase.auth.getSession();
    const response = await fetch('/api/comments', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        tenantId: session?.user?.user_metadata?.tenant_id,
        propertyId: session?.user?.user_metadata?.property_id,
        recipientRole,
        message: complaint,
        category,
        priority,
        attachmentType,
        attachmentLabel,
      }),
    });

    const result = await response.json();

    if (!response.ok) {
      setError(result.message ?? 'Unable to send complaint.');
      setSubmitting(false);
      return;
    }

    setComplaint('');
    setCategory('maintenance');
    setPriority('medium');
    setRecipientRole('agent');
    setAttachmentType('photo');
    setAttachmentLabel('');
    setMessage(`Complaint submitted to your ${recipientRole === 'agent' ? 'agent' : 'landlord'}.`);
    await loadComments(user.id);
    setSubmitting(false);
  }

  return (
    <main className="container page-layout">
      <div className="card-admin-header">
        <div><p className="heading">Complaints</p><p className="subheading">Report house problems clearly, choose who should act, and attach visuals when needed.</p></div>
      </div>

      <section className="card-grid">
        <div className="card" style={{ border: '1px solid rgba(16, 185, 129, 0.16)', boxShadow: '0 10px 25px rgba(16, 185, 129, 0.08)' }}>
          <div className="card-label">New report</div>
          <h3 style={{ marginBottom: 12 }}>Raise a house issue</h3>
          <form onSubmit={handleComplaint} className="form-grid">
            <select value={recipientRole} onChange={(event) => setRecipientRole(event.target.value as 'landlord' | 'agent')} style={{ gridColumn: 'span 2' }}>
              <option value="agent">Send to my agent</option>
              <option value="landlord">Send to my landlord</option>
            </select>
            <select value={category} onChange={(event) => setCategory(event.target.value)} style={{ gridColumn: 'span 2' }}>
              <option value="maintenance">Maintenance</option>
              <option value="plumbing">Plumbing</option>
              <option value="electrical">Electrical</option>
              <option value="security">Security</option>
              <option value="cleanliness">Cleanliness</option>
              <option value="other">Other</option>
            </select>
            <select value={priority} onChange={(event) => setPriority(event.target.value)} style={{ gridColumn: 'span 2' }}>
              <option value="low">Low</option>
              <option value="medium">Medium</option>
              <option value="high">High</option>
            </select>
            <select value={attachmentType} onChange={(event) => setAttachmentType(event.target.value as 'none' | 'photo' | 'video')} style={{ gridColumn: 'span 2' }}>
              <option value="none">No media</option>
              <option value="photo">Attach a photo</option>
              <option value="video">Attach a video</option>
            </select>
            <input value={attachmentLabel} onChange={(event) => setAttachmentLabel(event.target.value)} placeholder="Short note for the attached media" style={{ gridColumn: 'span 2' }} />
            <textarea value={complaint} onChange={(event) => setComplaint(event.target.value)} required placeholder="Describe the issue in detail, including where it is and how urgent it feels..." style={{ gridColumn: 'span 2', minHeight: 120, padding: 12, borderRadius: 10, border: '1px solid var(--line)', background: 'var(--surface)' }} />
            <div style={{ gridColumn: 'span 2', padding: '10px 12px', borderRadius: 10, background: '#f0fdf4', color: '#047857', fontSize: '13px' }}>{summary}</div>
            <button type="submit" disabled={submitting} style={{ gridColumn: 'span 2' }}>{submitting ? 'Sending…' : 'Submit complaint'}</button>
          </form>
          {message && <p style={{ color: 'var(--accent)', marginTop: 12 }}>{message}</p>}
          {error && <p style={{ color: '#dc2626', marginTop: 12 }}>{error}</p>}
        </div>

        <div className="card">
          <h3 style={{ marginBottom: 12 }}>Your complaints</h3>
          {loading && <p className="landlord-muted">Loading complaints…</p>}
          {!loading && comments.length === 0 && <p>No complaints submitted yet.</p>}
          {!loading && comments.length > 0 && (
            <div className="table-shell">
              <table className="landlord-table">
                <thead><tr><th>Issue</th><th>Status</th><th>Date</th></tr></thead>
                <tbody>
                  {comments.map(c => (
                    <tr key={c.id}>
                      <td>{c.message}</td>
                      <td><span className={`status-pill ${c.status === 'open' ? 'status-pending' : 'status-active'}`}>{c.status || 'open'}</span></td>
                      <td>{c.created_at ? new Date(c.created_at).toLocaleDateString() : ''}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </section>
    </main>
  );
}