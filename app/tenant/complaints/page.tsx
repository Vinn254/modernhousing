'use client';

import { useEffect, useState } from 'react';
import { supabase } from '../../../lib/supabaseClient';

interface Comment {
  id: string;
  message: string;
  status: string;
  created_at: string;
}

export default function TenantComplaintsPage() {
  const [user, setUser] = useState<any>(null);
  const [comments, setComments] = useState<Comment[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [complaint, setComplaint] = useState('');
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

  async function handleComplaint(event: React.FormEvent) {
    event.preventDefault();
    setSubmitting(true);

    const { data: { session } } = await supabase.auth.getSession();
    const response = await fetch('/api/comments', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        tenantId: session?.user?.user_metadata?.tenant_id,
        propertyId: session?.user?.user_metadata?.property_id,
        recipientRole: 'agent',
        message: complaint,
      }),
    });

    const result = await response.json();

    if (!response.ok) {
      setError(result.message ?? 'Unable to send complaint.');
      setSubmitting(false);
      return;
    }

    setComplaint('');
    setMessage('Complaint submitted to your agent.');
    loadComments(user.id);
    setSubmitting(false);
  }

  return (
    <main className="container page-layout">
      <div className="card-admin-header">
        <div><p className="heading">Complaints</p><p className="subheading">Report maintenance issues or concerns to your agent.</p></div>
      </div>

      <section className="card" style={{ marginTop: 24 }}>
        <h3 style={{ marginBottom: 12 }}>Raise New Complaint</h3>
        <form onSubmit={handleComplaint} className="form-grid">
          <textarea value={complaint} onChange={(e) => setComplaint(e.target.value)} required placeholder="Describe the issue..." style={{ gridColumn: 'span 2', minHeight: 110, padding: 12, borderRadius: 10, border: '1px solid var(--line)', background: 'var(--surface)' }} />
          <button type="submit" disabled={submitting} style={{ gridColumn: 'span 2' }}>Submit Complaint</button>
        </form>
        {message && <p style={{ color: 'var(--accent)', marginTop: 12 }}>{message}</p>}
        {error && <p style={{ color: '#dc2626', marginTop: 12 }}>{error}</p>}
      </section>

      <section className="card" style={{ marginTop: 24 }}>
        <h3 style={{ marginBottom: 12 }}>Your Complaints</h3>
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
      </section>
    </main>
  );
}