'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
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

        <section className="kpi-row">
          <div className="kpi-tile kpi-tile-chart">
            <div className="card-label" style={{ justifyContent: 'center' }}><span className="badge badge-pm"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg></span>Unit Occupancy</div>
            <DonutChart 
              data={[
                { label: 'Occupied', value: occupiedUnits, color: '#10b981' },
                { label: 'Vacant', value: vacantUnits, color: '#9ca3af' },
              ]} 
              centerLabel={String(occupiedUnits) + '/' + String(occupiedUnits + vacantUnits)} 
            />
            <p style={{ color: 'var(--ink-3)', margin: 0, fontSize: '13px' }}>Occupied / Vacant</p>
          </div>

          {!loading && occupiedUnits + vacantUnits > 0 && (
            <div className="kpi-tile">
              <span className="kpi-tile-icon" style={{ background: 'linear-gradient(135deg, var(--accent), var(--accent-bright))' }}>
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="1" y="4" width="22" height="16" rx="2"/><line x1="1" y1="10" x2="23" y2="10"/></svg>
              </span>
              <div className="kpi-tile-body">
                <span className="kpi-tile-value">{Math.round((occupiedUnits / (occupiedUnits + vacantUnits)) * 100)}%</span>
                <span className="kpi-tile-label">Occupancy Rate</span>
                <span className="kpi-tile-caption">of units occupied</span>
              </div>
            </div>
          )}

          <button type="button" className="kpi-tile clickable" onClick={() => setShowVacantModal(true)}>
            <span className="kpi-tile-icon" style={{ background: 'linear-gradient(135deg, #9ca3af, #cbd5e1)' }}>
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="18" height="18" rx="2"/><path d="M15 3v18"/><path d="M9 3v18"/><path d="M3 9h18"/><path d="M3 15h18"/></svg>
            </span>
            <div className="kpi-tile-body">
              <span className="kpi-tile-value">{vacantUnits}</span>
              <span className="kpi-tile-label">Vacant Units</span>
              <span className="kpi-tile-caption">Available for rent</span>
            </div>
            <svg className="kpi-tile-arrow" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="5" y1="12" x2="19" y2="12"/><polyline points="12 5 19 12 12 19"/></svg>
          </button>

          <button type="button" className="kpi-tile clickable" onClick={() => setShowRentOwedModal(true)}>
            <span className="kpi-tile-icon" style={{ background: 'linear-gradient(135deg, #f59e0b, #fbbf24)' }}>
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 1v22"/><path d="M5 5h14"/><path d="M5 19h14"/></svg>
            </span>
            <div className="kpi-tile-body">
              <span className="kpi-tile-value" style={{ color: '#b91c1c' }}>{formatCurrency(totalOwed)}</span>
              <span className="kpi-tile-label">Total Rent Owed</span>
              <span className="kpi-tile-caption">Outstanding balances</span>
            </div>
            <svg className="kpi-tile-arrow" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="5" y1="12" x2="19" y2="12"/><polyline points="12 5 19 12 12 19"/></svg>
          </button>
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
          <div className="modal-overlay" onClick={() => setShowVacantModal(false)}>
            <div className="modal-card" style={{ maxWidth: '600px', maxHeight: '80vh', display: 'flex', flexDirection: 'column' }} onClick={e => e.stopPropagation()}>
              <div className="modal-card-header">
                <div>
                  <div className="card-label" style={{ marginBottom: 6 }}>Vacant Units</div>
                  <h3 style={{ margin: 0 }}>Available for Rent</h3>
                </div>
                <button onClick={() => setShowVacantModal(false)} className="modal-close" aria-label="Close">
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
                </button>
              </div>
              <div className="modal-card-body">
                {vacantUnitsList.length > 0 ? (
                  <div className="table-card">
                    <table>
                      <thead><tr><th>Unit</th><th>Property</th><th>Rent Amount</th></tr></thead>
                      <tbody>{vacantUnitsList.map((u, i) => <tr key={i}><td>{u.unit_number}</td><td>{u.property_name}</td><td>{formatCurrency(u.rent_amount)}</td></tr>)}</tbody>
                    </table>
                  </div>
                ) : <p className="table-empty">No vacant units — every unit is occupied.</p>}
              </div>
            </div>
          </div>
        )}

        {showRentOwedModal && (
          <div className="modal-overlay" onClick={() => setShowRentOwedModal(false)}>
            <div className="modal-card" style={{ maxWidth: '720px', maxHeight: '80vh', display: 'flex', flexDirection: 'column' }} onClick={e => e.stopPropagation()}>
              <div className="modal-card-header">
                <div>
                  <div className="card-label" style={{ marginBottom: 6 }}>Rent Owed</div>
                  <h3 style={{ margin: 0 }}>Tenants with Outstanding Balances</h3>
                </div>
                <button onClick={() => setShowRentOwedModal(false)} className="modal-close" aria-label="Close">
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
                </button>
              </div>
              <div className="modal-card-body">
                {rentOwedByTenant.some(t => t.balance_remaining > 0) ? (
                  <div className="table-card">
                    <table>
                      <thead><tr><th>Tenant</th><th>Unit</th><th>Total Paid</th><th>Balance</th><th>Last Payment</th></tr></thead>
                      <tbody>{rentOwedByTenant.filter(t => t.balance_remaining > 0).map(t => (
                        <tr key={t.id}>
                          <td>{t.full_name}</td>
                          <td>{t.unit}</td>
                          <td>{formatCurrency(t.total_paid)}</td>
                          <td><span className="pill pill-danger">{formatCurrency(t.balance_remaining)}</span></td>
                          <td>{t.last_payment ? new Date(t.last_payment).toLocaleDateString() : '—'}</td>
                        </tr>
                      ))}</tbody>
                    </table>
                  </div>
                ) : <p className="table-empty">All tenants are paid up — nothing owed.</p>}
              </div>
            </div>
          </div>
        )}

      </main>

      <footer>
        <div className="footer-inner">
          <div className="footer-brand"><span className="logo-mark" style={{ width: 26, height: 26, borderRadius: 7 }}><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M3 21h18"/><path d="M5 21V7l8-4v18"/><path d="M19 21V11l-6-4"/></svg></span>Springfield Systems</div>
          <div className="footer-links"><a href="/">Home</a><a href="/admin">Dashboard</a><a href="/help">Help</a></div>
          <div className="footer-copy">© 2026 Springfield Systems. All rights reserved.</div>
        </div>
      </footer>
    </>
  );
}