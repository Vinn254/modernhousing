'use client';

import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '../../../lib/supabaseClient';

interface TenantDashboardData {
  tenant: any;
  payments: any[];
  notifications: any[];
  comments: any[];
  documents: any[];
}

function StatIcon({ path, bg }: { path: React.ReactNode; bg: string }) {
  return (
    <span className="stat-icon" style={{ background: bg }}>
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">{path}</svg>
    </span>
  );
}

export default function TenantDashboardPage() {
  const router = useRouter();
  const [user, setUser] = useState<any>(null);
  const [data, setData] = useState<TenantDashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [profilePicture, setProfilePicture] = useState<File | null>(null);
  const [uploadingPicture, setUploadingPicture] = useState(false);
  const [pictureMessage, setPictureMessage] = useState('');
  const channelRef = useRef<any>(null);

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

  async function handlePictureUpload(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!profilePicture || !user?.id) return;

    setUploadingPicture(true);
    setPictureMessage('');

    const formData = new FormData();
    formData.append('file', profilePicture);
    formData.append('userId', user.id);

    const response = await fetch('/api/profile/upload', { method: 'POST', body: formData });
    const result = await response.json();

    if (response.ok) {
      setData((prev) => prev ? {
        ...prev,
        tenant: { ...prev.tenant, picture_url: (result as any).pictureUrl ?? prev.tenant.picture_url }
      } : prev);
      setPictureMessage('Profile picture uploaded.');
      setProfilePicture(null);
    } else {
      setPictureMessage(result.message ?? 'Upload failed.');
    }
    setUploadingPicture(false);
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

  useEffect(() => {
    if (!user?.id || !data?.tenant?.id) return;

    const channel = supabase.channel(`tenant-dashboard-${user.id}`);

    channel.on('postgres_changes', { event: '*', schema: 'public', table: 'bills', filter: `tenant_id=eq.${data.tenant.id}` }, () => {
      loadDashboard(user);
    });

    channel.on('postgres_changes', { event: '*', schema: 'public', table: 'payments', filter: `tenant_id=eq.${data.tenant.id}` }, () => {
      loadDashboard(user);
    });

    channel.subscribe();
    channelRef.current = channel;

    return () => {
      if (channelRef.current) {
        supabase.removeChannel(channelRef.current);
        channelRef.current = null;
      }
    };
  }, [user?.id, data?.tenant?.id]);

  if (loading) {
    return (
      <main className="container page-layout auth-pattern-bg">
        <div className="card">Loading tenant dashboard…</div>
      </main>
    );
  }

  if (!data?.tenant) {
    return (
      <main className="container page-layout auth-pattern-bg">
        <div className="card">
          <h1>Welcome</h1>
          <p>No tenant record was found for this account.</p>
          <p style={{ color: 'var(--ink-3)' }}>Please confirm with your agent that this exact email was used when adding you as a tenant.</p>
        </div>
      </main>
    );
  }

const tenant = data.tenant;
  const tenantFirstName = tenant.full_name?.split(' ')[0] || 'there';
  const hour = new Date().getHours();
  const timeGreeting = hour < 12 ? 'Good morning' : hour < 18 ? 'Good afternoon' : 'Good evening';

  return (
    <main className="container page-layout auth-pattern-bg">
      <div className="card-admin-header">
        <p className="heading">{timeGreeting}, {tenantFirstName} 👋</p>
        <p className="subheading">Your apartment, payments, notices, and support requests in one place.</p>
      </div>

<section className="kpi-row">
          <div className="kpi-tile">
            <img
              src={tenant.picture_url || '/placeholder-avatar.png'}
              alt="Profile"
              className="avatar-ring"
              style={{ width: 46, height: 46, flexShrink: 0 }}
              key={tenant.picture_url || 'placeholder'}
            />
            <div className="kpi-tile-body">
              <span className="kpi-tile-value" style={{ fontSize: 16 }}>{tenant.property_name}</span>
              <span className="kpi-tile-label">Unit {tenant.unit_number}</span>
            </div>
          </div>
          <div className="kpi-tile">
            <span className="kpi-tile-icon" style={{ background: 'linear-gradient(135deg, #10b981, #34d399)' }}><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="4" width="18" height="18" rx="2" /><line x1="16" y1="2" x2="16" y2="6" /><line x1="8" y1="2" x2="8" y2="6" /><line x1="3" y1="10" x2="21" y2="10" /></svg></span>
            <div className="kpi-tile-body">
              <span className="kpi-tile-value" style={{ fontSize: 16 }}>{tenant.next_payment_date || 'Pending'}</span>
              <span className="kpi-tile-label">Next payment</span>
            </div>
          </div>
          <div className="kpi-tile">
            <span className="kpi-tile-icon" style={{ background: 'linear-gradient(135deg, #0ea5e9, #38bdf8)' }}><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="1.5" y="5" width="21" height="14" rx="2.5" /><path d="M1.5 10h21" /></svg></span>
            <div className="kpi-tile-body">
              <span className="kpi-tile-value">{data.payments.length}</span>
              <span className="kpi-tile-label">Payments recorded</span>
            </div>
          </div>
          <div className="kpi-tile">
            <span className="kpi-tile-icon" style={{ background: 'linear-gradient(135deg, #f59e0b, #fbbf24)' }}><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M18 8a6 6 0 0 0-12 0c0 7-3 9-3 9h18s-3-2-3-9" /><path d="M13.73 21a2 2 0 0 1-3.46 0" /></svg></span>
            <div className="kpi-tile-body">
              <span className="kpi-tile-value">{data.notifications.length}</span>
              <span className="kpi-tile-label">Notices</span>
            </div>
          </div>
        </section>

<section className="card-grid">
          <div className="card">
            <div className="card-label">Personal Details</div>
            <h3 style={{ marginBottom: 16 }}>My Profile</h3>
<div style={{ display: 'grid', gap: 12 }}>
               <div><strong>Name:</strong> {tenant.full_name}</div>
               <div><strong>Email:</strong> {tenant.email}</div>
               <div><strong>Phone:</strong> {tenant.phone || '—'}</div>
               {tenant.next_of_kin_name && <div><strong>Next of Kin:</strong> {tenant.next_of_kin_name}</div>}
               {tenant.next_of_kin_phone && <div><strong>Next of Kin Phone:</strong> {tenant.next_of_kin_phone}</div>}
             </div>
            <form onSubmit={handlePictureUpload} style={{ marginTop: 16 }}>
              <label style={{ fontSize: '12px', color: 'var(--ink-3)', marginBottom: 6, display: 'block' }}>Upload Profile Picture</label>
              <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
                <input type="file" accept="image/*" onChange={(e) => setProfilePicture(e.target.files?.[0] ?? null)} style={{ flex: 1, minWidth: 160 }} />
                {profilePicture && <span style={{ fontSize: '12px', color: 'var(--ink-3)' }}>{profilePicture.name} ({Math.round(profilePicture.size / 1024)}KB)</span>}
                <button type="submit" disabled={uploadingPicture || !profilePicture} className="btn btn-ghost" style={{ color: 'var(--ink)', border: '1px solid var(--line)', padding: '8px 14px' }}>
                  {uploadingPicture ? 'Uploading…' : 'Upload'}
                </button>
              </div>
              {pictureMessage && <p style={{ fontSize: '12px', marginTop: 8, color: pictureMessage.includes('failed') ? '#dc2626' : 'var(--accent)' }}>{pictureMessage}</p>}
            </form>
          </div>

          <div className="card">
            <div className="card-label">Quick Links</div>
            <h3 style={{ marginBottom: 16 }}>Navigate to</h3>
            <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
              <a href="/tenant/payments" className="card-cta quick-link-btn">
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="1.5" y="5" width="21" height="14" rx="2.5" /><path d="M1.5 10h21" /></svg>
                Payments
              </a>
              <a href="/tenant/documents" className="card-cta quick-link-btn">
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" /><path d="M14 2v6h6" /></svg>
                Documents
              </a>
              <a href="/tenant/complaints" className="card-cta quick-link-btn">
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10" /><line x1="12" y1="8" x2="12" y2="12" /><line x1="12" y1="16" x2="12.01" y2="16" /></svg>
                Raise Complaint
              </a>
              <a href="/tenant/notifications" className="card-cta quick-link-btn">
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M18 8a6 6 0 0 0-12 0c0 7-3 9-3 9h18s-3-2-3-9" /><path d="M13.73 21a2 2 0 0 1-3.46 0" /></svg>
                Notifications
              </a>
            </div>
          </div>
        </section>
     </main>
    );
}

