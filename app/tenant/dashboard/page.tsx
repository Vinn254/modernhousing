'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '../../../lib/supabaseClient';

interface TenantDashboardData {
  tenant: any;
  payments: any[];
  notifications: any[];
  comments: any[];
  documents: any[];
}

export default function TenantDashboardPage() {
  const router = useRouter();
  const [user, setUser] = useState<any>(null);
  const [data, setData] = useState<TenantDashboardData | null>(null);
  const [loading, setLoading] = useState(true);

  const formatCurrency = (value: number) => new Intl.NumberFormat('en-KE', { style: 'currency', currency: 'KES' }).format(value);

  async function loadDashboard(currentUser: any) {
    if (!currentUser?.email) return;

    const response = await fetch(`/api/tenant/dashboard?email=${encodeURIComponent(currentUser.email)}&userId=${encodeURIComponent(currentUser.id)}`);
    const result = await response.json();

    if (!response.ok) {
      setLoading(false);
      return;
    }

    setData(result);
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
          <p style={{ color: 'var(--ink-3)' }}>Transactions</p>
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
          <div style={{ display: 'grid', gap: 12 }}>
            <div><strong>Name:</strong> {tenant.full_name}</div>
            <div><strong>Email:</strong> {tenant.email}</div>
            <div><strong>Phone:</strong> {tenant.phone || '—'}</div>
            <div><strong>Lease:</strong> {tenant.lease_start} → {tenant.lease_end}</div>
          </div>
        </div>

        <div className="card">
          <div className="card-label">Quick Links</div>
          <h3 style={{ marginBottom: 16 }}>Navigate to:</h3>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            <a href="/tenant/payments" className="btn btn-ghost">View Payments</a>
            <a href="/tenant/documents" className="btn btn-ghost">Upload Documents</a>
            <a href="/tenant/complaints" className="btn btn-ghost">Raise Complaint</a>
            <a href="/tenant/notifications" className="btn btn-ghost">View Notifications</a>
          </div>
        </div>
      </section>
    </main>
  );
}