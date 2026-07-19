'use client';
import { useEffect, useState } from 'react';
import DonutChart from '../../components/DonutChart';
import Sparkline from '../../components/Sparkline';
import { supabase } from '../../../lib/supabaseClient';
export default function AnalyticsPage() {
    const [data, setData] = useState({
        properties: 0,
        occupiedUnits: 0,
        vacantUnits: 0,
        subscribedLandlords: 0,
        totalLandlords: 0,
        totalPayments: 0,
    });
    const [loading, setLoading] = useState(true);
    useEffect(() => {
        async function loadData() {
            const { data: { session } } = await supabase.auth.getSession();
            const headers = { 'Content-Type': 'application/json' };
            if (session?.access_token)
                headers.Authorization = `Bearer ${session.access_token}`;
            fetch('/api/dashboard', { headers })
                .then(r => r.json())
                .then(setData)
                .catch(() => { })
                .finally(() => setLoading(false));
        }
        loadData();
        const interval = window.setInterval(loadData, 30000);
        return () => window.clearInterval(interval);
    }, []);
    const unitOccupancyData = [
        { label: 'Occupied', value: data.occupiedUnits, color: '#10b981' },
        { label: 'Vacant', value: data.vacantUnits, color: '#9ca3af' },
    ];
    const subscriptionData = [
        { label: 'Subscribed', value: data.subscribedLandlords, color: '#10b981' },
        { label: 'Unsubscribed', value: data.totalLandlords - data.subscribedLandlords, color: '#f43f5e' },
    ];
    return (<>
      <main className="container admin-no-hero floral-bg">
        <div className="card-admin-header">
          <div>
            <p className="heading">Analytics</p>
            <p className="subheading">System-wide statistics and performance metrics.</p>
          </div>
        </div>

        <section className="bento-grid">
          <article className="bento-card" style={{ padding: '14px 16px', display: 'flex', alignItems: 'center', gap: 12 }}>
            <div style={{ width: 48, height: 48, borderRadius: '50%', background: 'rgba(16,185,129,0.12)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="var(--accent)" strokeWidth="2"><path d="M3 21h18"/><path d="M5 21V7l8-4v18"/><path d="M19 21V11l-6-4"/></svg>
            </div>
            <div>
              <div className="card-label">Units Occupancy</div>
              <h3 style={{ margin: 0 }}>{loading ? '—' : data.occupiedUnits + data.vacantUnits}</h3>
              <DonutChart data={unitOccupancyData} centerLabel={String(data.occupiedUnits) + '/' + String(data.occupiedUnits + data.vacantUnits)}/>
              <Sparkline data={[data.occupiedUnits - 2, data.occupiedUnits - 1, data.occupiedUnits]} color="#10b981" w={80} h={24}/>
              <p style={{ margin: 0, color: 'var(--ink-3)', fontSize: '13px' }}>Occupied / Vacant</p>
            </div>
          </article>

          <article className="bento-card" style={{ padding: '14px 16px', display: 'flex', alignItems: 'center', gap: 12 }}>
            <div style={{ width: 48, height: 48, borderRadius: '50%', background: 'rgba(99,102,241,0.12)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#6366f1" strokeWidth="2"><circle cx="12" cy="12" r="10"/><path d="M12 16v-4"/><path d="M12 8h.01"/></svg>
            </div>
            <div>
              <div className="card-label">Landlord Subscriptions</div>
              <h3 style={{ margin: 0 }}>{data.subscribedLandlords}</h3>
              <DonutChart data={subscriptionData} centerLabel={String(data.subscribedLandlords)}/>
              <Sparkline data={[data.subscribedLandlords, data.totalLandlords - data.subscribedLandlords, data.subscribedLandlords + 2]} color="#6366f1" w={80} h={24}/>
              <p style={{ margin: 0, color: 'var(--ink-3)', fontSize: '13px' }}>Active Subscriptions</p>
            </div>
          </article>

          <article className="bento-card" style={{ padding: '14px 16px', display: 'flex', alignItems: 'center', gap: 12 }}>
            <div style={{ width: 48, height: 48, borderRadius: '50%', background: 'rgba(245,158,11,0.12)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="var(--amber)" strokeWidth="2"><path d="M12 1v22"/><path d="M5 5h14"/><path d="M5 19h14"/></svg>
            </div>
            <div>
              <div className="card-label">Total Payments</div>
              <h3 style={{ margin: 0 }}>{data.totalPayments}</h3>
              <Sparkline data={[data.totalPayments - 100, data.totalPayments - 50, data.totalPayments]} color="#f59e0b" w={80} h={24}/>
              <p style={{ margin: 0, color: 'var(--ink-3)', fontSize: '13px' }}>Payment transactions</p>
            </div>
          </article>
        </section>
      </main>

      <footer>
        <div className="footer-inner">
          <div className="footer-brand"><span className="logo-mark" style={{ width: 26, height: 26, borderRadius: 7 }}><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M3 21h18"/><path d="M5 21V7l8-4v18"/><path d="M19 21V11l-6-4"/></svg></span>Springfield Systems</div>
          <div className="footer-links"><a href="/">Home</a><a href="/super-admin">Dashboard</a></div>
          <div className="footer-copy">© 2026 Springfield Systems. All rights reserved.</div>
        </div>
      </footer>
    </>);
}
