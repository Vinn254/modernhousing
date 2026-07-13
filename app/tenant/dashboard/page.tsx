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
  const [profilePicture, setProfilePicture] = useState<File | null>(null);
  const [uploadingPicture, setUploadingPicture] = useState(false);
  const [pictureMessage, setPictureMessage] = useState('');

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
      setPictureMessage('Profile picture uploaded.');
      setProfilePicture(null);
      loadDashboard(user);
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

<section className="dashboard-hero-stats">
         <div className="card" style={{ padding: '18px 16px', display: 'flex', alignItems: 'center', gap: 12 }}>
           <img src={tenant.picture_url || '/placeholder-avatar.png'} alt="Profile" style={{ width: 48, height: 48, borderRadius: '50%', objectFit: 'cover' }} onLoad={() => {}} key={tenant.picture_url || 'placeholder'} />
           <div>
             <div className="card-label">Apartment</div>
             <h3 style={{ margin: 0, fontSize: '18px' }}>{tenant.property_name}</h3>
             <p style={{ color: 'var(--ink-3)', margin: 0, fontSize: '13px' }}>Unit {tenant.unit_number}</p>
           </div>
         </div>
         <div className="card" style={{ padding: '18px 16px' }}>
           <div className="card-label">Next Payment</div>
           <h3 style={{ margin: 0, fontSize: '18px' }}>{tenant.next_payment_date || 'Pending'}</h3>
           <p style={{ color: 'var(--ink-3)', margin: 0, fontSize: '12px' }}>Every 30 days</p>
         </div>
         <div className="card" style={{ padding: '18px 16px' }}>
           <div className="card-label">Payments</div>
           <h3 style={{ margin: 0, fontSize: '18px' }}>{data.payments.length}</h3>
           <p style={{ color: 'var(--ink-3)', margin: 0, fontSize: '12px' }}>Transactions</p>
         </div>
         <div className="card" style={{ padding: '18px 16px' }}>
           <div className="card-label">Notifications</div>
           <h3 style={{ margin: 0, fontSize: '18px' }}>{data.notifications.length}</h3>
           <p style={{ color: 'var(--ink-3)', margin: 0, fontSize: '12px' }}>Notices</p>
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
             </div>
            <form onSubmit={handlePictureUpload} style={{ marginTop: 16 }}>
              <label style={{ fontSize: '12px', color: 'var(--ink-3)', marginBottom: 6, display: 'block' }}>Upload Profile Picture</label>
              <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                <input type="file" accept="image/*" onChange={(e) => setProfilePicture(e.target.files?.[0] ?? null)} style={{ flex: 1 }} />
                {profilePicture && <span style={{ fontSize: "12px", color: "var(--ink-3)" }}>{profilePicture.name} ({Math.round(profilePicture.size / 1024)}KB)</span>}
                <button type="submit" disabled={uploadingPicture || !profilePicture} style={{ padding: '6px 12px' }}>{uploadingPicture ? 'Uploading…' : 'Upload'}</button>
              </div>
              {pictureMessage && <p style={{ fontSize: '12px', marginTop: 8, color: pictureMessage.includes('failed') ? '#dc2626' : 'var(--accent)' }}>{pictureMessage}</p>}
            </form>
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

