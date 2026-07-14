'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import DonutChart from '../components/DonutChart';
import { supabase } from '../../lib/supabaseClient';

export default function AdminDashboard() {
  const [occupiedUnits, setOccupiedUnits] = useState(0);
  const [vacantUnits, setVacantUnits] = useState(0);
  const [vacantUnitsList, setVacantUnitsList] = useState<any[]>([]);
  const [rentOwedByTenant, setRentOwedByTenant] = useState<any[]>([]);
  const [totalOwed, setTotalOwed] = useState(0);
  const [loading, setLoading] = useState(true);
  const [firstName, setFirstName] = useState('');
  const [showVacantModal, setShowVacantModal] = useState(false);
  const [showRentOwedModal, setShowRentOwedModal] = useState(false);
  const router = useRouter();

  const formatCurrency = (value: number) => new Intl.NumberFormat('en-KE', { style: 'currency', currency: 'KES' }).format(value);

  useEffect(() => {
    async function loadData() {
      setLoading(true);
      const { data: { session } } = await supabase.auth.getSession();
      const headers: Record<string, string> = { 'Content-Type': 'application/json' };
      if (session?.access_token) headers.Authorization = `Bearer ${session.access_token}`;
      
      const name = session?.user?.user_metadata?.full_name || session?.user?.email || '';
      setFirstName(name.split(' ')[0].split('@')[0]);

      fetch('/api/dashboard', { headers })
        .then(r => r.json())
        .then(data => {
          setOccupiedUnits(data.occupiedUnits ?? 0);
          setVacantUnits(data.vacantUnits ?? 0);
          setVacantUnitsList(data.vacantUnitsList ?? []);
          setRentOwedByTenant(data.rentOwedByTenant ?? []);
          setTotalOwed((data.rentOwedByTenant ?? []).reduce((sum: number, t: any) => sum + (t.balance_remaining ?? 0), 0));
        })
        .catch(() => {})
        .finally(() => setLoading(false));
    }
    loadData();
  }, []);

  const hour = new Date().getHours();
  const timeGreeting = hour < 12 ? 'Good morning' : hour < 18 ? 'Good afternoon' : 'Good evening';

  const occupancyData = [
    { label: 'Occupied', value: occupiedUnits, color: '#10b981' },
    { label: 'Vacant', value: vacantUnits, color: '#9ca3af' },
  ];

  return (
    <>
      <main className="container admin-no-hero auth-pattern-bg">
        <div className="card-admin-header" style={{ marginBottom: '24px' }}>
          <div>
            <p className="heading">{firstName ? `${timeGreeting}, ${firstName} 👋` : 'Project Manager Dashboard'}</p>
            <p className="subheading">Manage your properties, agents, tenants, payments, and communications.</p>
          </div>
        </div>

        <section className="dashboard-hero-stats">
<article className="card" style={{ textAlign: 'center' }}>
            <div className="card-label"><span className="badge badge-pm"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg></span>Unit Occupancy</div>
            <DonutChart 
              data={[
                { label: 'Occupied', value: occupiedUnits, color: '#10b981' },
                { label: 'Vacant', value: vacantUnits, color: '#9ca3af' },
              ]} 
              centerLabel={String(occupiedUnits) + '/' + String(occupiedUnits + vacantUnits)} 
            />
            <p style={{ color: 'var(--ink-3)', marginTop: 8, fontSize: '13px' }}>Occupied / Vacant</p>
          </article>

          {!loading && occupiedUnits + vacantUnits > 0 && (
            <article className="card">
              <div className="card-label"><span className="badge badge-pm" style={{ background: 'var(--accent)' }}><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><rect x="1" y="4" width="22" height="16" rx="2"/><line x1="1" y1="10" x2="23" y2="10"/></svg></span>Quick Stats</div>
              <h3 style={{ marginBottom: 12 }}>Occupancy Rate</h3>
              <div style={{ fontSize: '28px', fontWeight: 700, color: 'var(--navy-900)' }}>
                {Math.round((occupiedUnits / (occupiedUnits + vacantUnits)) * 100)}%
              </div>
              <p style={{ color: 'var(--ink-3)', marginTop: 4 }}>of units occupied</p>
            </article>
          )}

<article className="card" style={{ textAlign: 'center', cursor: 'pointer' }} onClick={() => setShowVacantModal(true)}>
            <div className="card-label"><span className="badge badge-pm" style={{ background: '#9ca3af' }}><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinejoin="round"><rect x="3" y="3" width="18" height="18" rx="2"/><path d="M15 3v18"/><path d="M9 3v18"/><path d="M3 9h18"/><path d="M3 15h18"/></svg></span>Vacant Units</div>
            <div style={{ fontSize: '34px', fontWeight: 700, color: 'var(--navy-900)', margin: '8px 0' }}>{vacantUnits}</div>
            <p style={{ color: 'var(--ink-3)', fontSize: '13px', margin: 0 }}>Available for rent</p>
          </article>

          <article className="card" style={{ textAlign: 'center', cursor: 'pointer' }} onClick={() => setShowRentOwedModal(true)}>
            <div className="card-label"><span className="badge badge-pm" style={{ background: '#f59e0b' }}><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinejoin="round"><path d="M12 1v22"/><path d="M5 5h14"/><path d="M5 19h14"/></svg></span>Total Rent Owed</div>
            <div style={{ fontSize: '28px', fontWeight: 700, color: '#b91c1c', margin: '8px 0' }}>
              {formatCurrency(totalOwed)}
            </div>
            <p style={{ color: 'var(--ink-3)', fontSize: '13px', margin: 0 }}>Outstanding balances</p>
          </article>

          <article className="card" style={{ textAlign: 'center', cursor: 'pointer' }} onClick={() => router.push('#rent-owed')}>
            <div className="card-label"><span className="badge badge-pm" style={{ background: '#f59e0b' }}><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M12 1v22"/><path d="M5 5h14"/><path d="M5 19h14"/></svg></span>Total Rent Owed</div>
            <div style={{ fontSize: '28px', fontWeight: 700, color: '#b91c1c', margin: '8px 0' }}>
              {formatCurrency(totalOwed)}
            </div>
            <p style={{ color: 'var(--ink-3)', fontSize: '13px', margin: 0 }}>Outstanding balances</p>
          </article>

          <article className="card" style={{ textAlign: 'center', cursor: 'pointer' }} onClick={() => router.push('/?show=rent-owed')}>
            <div className="card-label"><span className="badge badge-pm" style={{ background: '#f59e0b' }}><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M12 1v22"/><path d="M5 5h14"/><path d="M5 19h14"/></svg></span>Total Rent Owed</div>
            <div style={{ fontSize: '28px', fontWeight: 700, color: '#b91c1c', margin: '8px 0' }}>
              {formatCurrency(totalOwed)}
            </div>
            <p style={{ color: 'var(--ink-3)', fontSize: '13px', margin: 0 }}>Outstanding balances</p>
          </article>
        </section>

        <section className="card-grid" style={{ marginBottom: '24px' }}>
          <article className="card">
            <div className="card-label"><span className="badge badge-pm"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg></span>Properties</div>
            <h3>Manage your properties and units.</h3>
            <p>Add properties, create units, and assign agents to specific properties.</p>
            <Link href="/properties" className="card-cta">Manage Properties</Link>
          </article>

          <article className="card">
            <div className="card-label"><span className="badge badge-agent"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M16 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="8.5" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13 a4 0 0 1 0 7.75"/></svg></span>Agents</div>
            <h3>Assign agents and monitor assignments.</h3>
            <p>View agents added by you, assigned properties, and active status.</p>
            <Link href="/admin/agents" className="card-cta">View Agents</Link>
          </article>

          <article className="card">
            <div className="feat-icon" style={{ background: 'var(--navy-700)' }}><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="1" y="4" width="22" height="16" rx="2"/><line x1="1" y1="10" x2="23" y2="10"/></svg></div>
            <h3>Tenants</h3>
            <p>View your tenants and manage occupancy.</p>
            <Link href="/admin/tenants" className="card-cta">View Tenants</Link>
          </article>

          <article className="card">
            <div className="feat-icon" style={{ background: 'var(--accent)' }}><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="1" y="4" width="22" height="16" rx="2"/><line x1="1" y1="10" x2="23" y2="10"/></svg></div>
            <h3>Payments</h3>
            <p>Review transaction records and balances.</p>
            <Link href="/payments" className="card-cta">View Payments</Link>
          </article>

          <article className="card">
            <div className="feat-icon" style={{ background: '#0ea5e9' }}><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2-2z"/></svg></div>
            <h3>Communications</h3>
            <p>Manage announcements and notices.</p>
            <Link href="/admin/communications" className="card-cta">Open</Link>
          </article>

          <article className="card">
            <div className="feat-icon" style={{ background: '#8b5cf6' }}><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg></div>
            <h3>Utilities</h3>
            <p>Manage utility services and payments.</p>
            <Link href="/admin/utilities" className="card-cta">Manage Utilities</Link>
          </article>

<article className="card">
             <div className="feat-icon" style={{ background: '#f59e0b' }}><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg></div>
             <h3>Tenant Documents</h3>
             <p>Review tenant-submitted documents.</p>
             <Link href="/admin/documents" className="card-cta">View Documents</Link>
           </article>

<article className="card">
              <div className="feat-icon" style={{ background: '#6366f1' }}><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><path d="M12 16v-4"/><path d="M12 8h.01"/></svg></div>
              <h3>System Audit</h3>
              <p>Monitor all system activities and security events.</p>
              <Link href="/admin/audit" className="card-cta">View Audit Logs</Link>
            </article>
          </section>

        {showVacantModal && (
          <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }} onClick={() => setShowVacantModal(false)}>
            <div className="card" style={{ maxWidth: '600px', width: '90%', maxHeight: '80vh', overflow: 'auto' }} onClick={e => e.stopPropagation()}>
              <div className="card-label">Vacant Units</div>
              <h3 style={{ marginBottom: 16 }}>Available for Rent</h3>
              {vacantUnitsList.length > 0 ? (
                <table className="landlord-table" style={{ width: '100%' }}>
                  <thead><tr><th>Unit</th><th>Property</th><th>Rent Amount</th></tr></thead>
                  <tbody>{vacantUnitsList.map((u, i) => <tr key={i}><td>{u.unit_number}</td><td>{u.property_name}</td><td>{formatCurrency(u.rent_amount)}</td></tr>)}</tbody>
                </table>
              ) : <p>No vacant units.</p>}
              <button onClick={() => setShowVacantModal(false)} style={{ marginTop: 16 }}>Close</button>
            </div>
          </div>
        )}

        {showRentOwedModal && (
          <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }} onClick={() => setShowRentOwedModal(false)}>
            <div className="card" style={{ maxWidth: '700px', width: '90%', maxHeight: '80vh', overflow: 'auto' }} onClick={e => e.stopPropagation()}>
              <div className="card-label">Rent Owed</div>
              <h3 style={{ marginBottom: 16 }}>Tenants with Outstanding Balances</h3>
              {rentOwedByTenant.some(t => t.balance_remaining > 0) ? (
                <table className="landlord-table" style={{ width: '100%' }}>
                  <thead><tr><th>Tenant</th><th>Unit</th><th>Total Paid</th><th>Balance</th><th>Last Payment</th></tr></thead>
                  <tbody>{rentOwedByTenant.filter(t => t.balance_remaining > 0).map(t => <tr key={t.id}><td>{t.full_name}</td><td>{t.unit}</td><td>{formatCurrency(t.total_paid)}</td><td style={{ color: 'var(--error)' }}>{formatCurrency(t.balance_remaining)}</td><td>{t.last_payment ? new Date(t.last_payment).toLocaleDateString() : '—'}</td></tr>)}</tbody>
                </table>
              ) : <p>All tenants have paid.</p>}
              <button onClick={() => setShowRentOwedModal(false)} style={{ marginTop: 16 }}>Close</button>
            </div>
          </div>
        )}

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