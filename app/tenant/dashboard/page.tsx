'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '../../../lib/supabaseClient';

interface TenantDashboardData {
  tenant: any;
  payments: any[];
  notifications: any[];
  comments: any[];
}

export default function TenantDashboardPage() {
  const router = useRouter();
  const [user, setUser] = useState<any>(null);
  const [data, setData] = useState<TenantDashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [editing, setEditing] = useState(false);
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [leaseStart, setLeaseStart] = useState('');
  const [leaseEnd, setLeaseEnd] = useState('');
  const [complaint, setComplaint] = useState('');

  async function loadDashboard(currentUser: any) {
    if (!currentUser?.email) return;

    const response = await fetch(`/api/tenant/dashboard?email=${encodeURIComponent(currentUser.email)}&userId=${encodeURIComponent(currentUser.id)}`);
    const result = await response.json();

    if (!response.ok) {
      setError(result.message ?? 'Unable to load tenant dashboard.');
      setLoading(false);
      return;
    }

    setData(result);
    const tenant = result.tenant;
    if (tenant) {
      setFullName(tenant.full_name);
      setEmail(tenant.email);
      setPhone(tenant.phone || '');
      setLeaseStart(tenant.lease_start || '');
      setLeaseEnd(tenant.lease_end || '');
    }
    setLoading(false);
  }

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      setUser(data.user);
      if (!data.user) {
        router.push('/login');
        return;
      }
      loadDashboard(data.user);
    });
  }, [router]);

  async function handleUpdateProfile(event: React.FormEvent) {
    event.preventDefault();
    if (!data?.tenant) return;

    const response = await fetch(`/api/tenants?id=${encodeURIComponent(data.tenant.id)}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ fullName, email, phone, leaseStart, leaseEnd }),
    });

    const result = await response.json();

    if (!response.ok) {
      setError(result.message ?? 'Unable to update profile.');
      return;
    }

    setData((current) => current ? { ...current, tenant: result.tenant } : current);
    setEditing(false);
    setMessage('Profile updated successfully.');
  }

  async function handleComplaint(event: React.FormEvent) {
    event.preventDefault();
    if (!data?.tenant) return;

    const response = await fetch('/api/comments', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        tenantId: data.tenant.id,
        propertyId: data.tenant.property_id,
        recipientRole: 'agent',
        message: complaint,
      }),
    });

    const result = await response.json();

    if (!response.ok) {
      setError(result.message ?? 'Unable to send complaint.');
      return;
    }

    setComplaint('');
    setMessage('Complaint sent to your agent.');
    await loadDashboard(user);
  }

  const formatCurrency = (value: number) => new Intl.NumberFormat('en-KE', { style: 'currency', currency: 'KES' }).format(value);

  if (loading) {
    return (
      <main className="container page-layout">
        <div className="card">Loading tenant dashboard…</div>
      </main>
    );
  }

  if (!data?.tenant) {
    return (
      <main className="container page-layout">
        <div className="card">
          <h1>Welcome</h1>
          <p>No tenant record was found for this account.</p>
          <p style={{ color: 'var(--ink-3)' }}>Please confirm with your agent that this exact email was used when adding you as a tenant.</p>
        </div>
      </main>
    );
  }

  const tenant = data.tenant;

  return (
    <main className="container page-layout">
      <div className="card-admin-header">
        <p className="heading">Welcome, {tenant.full_name}</p>
        <p className="subheading">Your apartment, payments, notices, and support requests in one place.</p>
      </div>

      {(message || error) && <p style={{ color: error ? '#dc2626' : 'var(--accent)', fontWeight: 700, marginBottom: 16 }}>{message || error}</p>}

      <section style={{ display: 'grid', gridTemplateColumns: 'repeat(4, minmax(0, 1fr))', gap: 18, marginBottom: 24 }}>
        <div className="card">
          <div className="card-label">Apartment</div>
          <h3 style={{ margin: 0 }}>{tenant.property_name}</h3>
          <p style={{ color: 'var(--ink-3)' }}>Unit {tenant.unit_number}</p>
        </div>
        <div className="card">
          <div className="card-label">Next Payment</div>
          <h3 style={{ margin: 0 }}>{tenant.next_payment_date || 'Pending'}</h3>
          <p style={{ color: 'var(--ink-3)' }}>Calculated every 30 days</p>
        </div>
        <div className="card">
          <div className="card-label">Payments</div>
          <h3 style={{ margin: 0 }}>{data.payments.length}</h3>
          <p style={{ color: 'var(--ink-3)' }}>Recorded transactions</p>
        </div>
        <div className="card">
          <div className="card-label">Notifications</div>
          <h3 style={{ margin: 0 }}>{data.notifications.length}</h3>
          <p style={{ color: 'var(--ink-3)' }}>Notices from agent</p>
        </div>
      </section>

      <section style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 18 }}>
        <div className="card">
          <div className="card-label">Personal Details</div>
          <h3 style={{ marginBottom: 16 }}>My Profile</h3>
          {editing ? (
            <form onSubmit={handleUpdateProfile} className="form-grid">
              <input value={fullName} onChange={(e) => setFullName(e.target.value)} required placeholder="Full name" />
              <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required placeholder="Email" />
              <input value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="Phone" />
              <input type="date" value={leaseStart} onChange={(e) => setLeaseStart(e.target.value)} required />
              <input type="date" value={leaseEnd} onChange={(e) => setLeaseEnd(e.target.value)} required />
              <button type="submit" style={{ gridColumn: 'span 2' }}>Save Details</button>
              <button type="button" className="btn btn-ghost" onClick={() => setEditing(false)} style={{ gridColumn: 'span 2' }}>Cancel</button>
            </form>
          ) : (
            <div style={{ display: 'grid', gap: 12 }}>
              <div><strong>Name:</strong> {tenant.full_name}</div>
              <div><strong>Email:</strong> {tenant.email}</div>
              <div><strong>Phone:</strong> {tenant.phone || '—'}</div>
              <div><strong>Lease:</strong> {tenant.lease_start} → {tenant.lease_end}</div>
              <button className="btn btn-ghost" onClick={() => setEditing(true)}>Edit Details</button>
            </div>
          )}
        </div>

        <div className="card">
          <div className="card-label">Raise Complaint</div>
          <h3 style={{ marginBottom: 16 }}>House Problem</h3>
          <form onSubmit={handleComplaint} className="form-grid">
            <textarea
              value={complaint}
              onChange={(e) => setComplaint(e.target.value)}
              required
              placeholder="Describe the house problem..."
              style={{ gridColumn: 'span 2', minHeight: 110, padding: 12, borderRadius: 10, border: '1px solid var(--line)', background: 'var(--surface)' }}
            />
            <button type="submit" style={{ gridColumn: 'span 2' }}>Send to Agent</button>
          </form>
        </div>
      </section>

      <section style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 18, marginTop: 24 }}>
        <div className="card">
          <div className="card-label">All Transactions</div>
          <h3 style={{ marginBottom: 16 }}>Payment History</h3>
          {data.payments.length === 0 ? <p style={{ color: 'var(--ink-3)' }}>No payments recorded yet.</p> : data.payments.map((payment) => (
            <div key={payment.id} style={{ padding: '12px 0', borderBottom: '1px solid var(--line-soft)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <strong>{formatCurrency(payment.amount)}</strong>
                <span style={{ color: payment.balance_remaining > 0 ? '#dc2626' : 'var(--accent)', fontWeight: 700 }}>{formatCurrency(payment.balance_remaining)}</span>
              </div>
              <div style={{ color: 'var(--ink-3)', fontSize: '13px' }}>{payment.description} · {payment.created_at ? new Date(payment.created_at).toLocaleDateString() : ''}</div>
            </div>
          ))}
        </div>

        <div className="card">
          <div className="card-label">Notifications</div>
          <h3 style={{ marginBottom: 16 }}>Messages from Agent</h3>
          {data.notifications.length === 0 ? <p style={{ color: 'var(--ink-3)' }}>No notices yet.</p> : data.notifications.map((notice) => (
            <div key={notice.id} style={{ padding: '12px 0', borderBottom: '1px solid var(--line-soft)' }}>
              <strong>{notice.message}</strong>
              <div style={{ color: 'var(--ink-3)', fontSize: '13px' }}>{notice.created_at ? new Date(notice.created_at).toLocaleDateString() : ''}</div>
            </div>
          ))}
        </div>
      </section>

      <section className="card" style={{ marginTop: 24 }}>
        <div className="card-label">Complaints</div>
        <h3 style={{ marginBottom: 16 }}>House Problems Raised to Agent</h3>
        {data.comments.length === 0 ? <p style={{ color: 'var(--ink-3)' }}>No complaints raised yet.</p> : data.comments.map((comment) => (
          <div key={comment.id} style={{ padding: '12px 0', borderBottom: '1px solid var(--line-soft)' }}>
            <strong>{comment.message}</strong>
            <div style={{ color: 'var(--ink-3)', fontSize: '13px' }}>{comment.created_at ? new Date(comment.created_at).toLocaleDateString() : ''} · {comment.status || 'open'}</div>
          </div>
        ))}
      </section>
    </main>
  );
}
