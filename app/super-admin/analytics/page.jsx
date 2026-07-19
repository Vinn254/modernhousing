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
    const formatCurrency = (value) => new Intl.NumberFormat('en-KE', { style: 'currency', currency: 'KES' }).format(value);
    return (<>
      <style jsx global>{`
        @media (max-width: 600px) {
          .bento-grid { grid-template-columns: 1fr !important; }
        }
      `}</style>
      <main className="container admin-no-hero floral-bg">
        <div className="card-admin-header">
          <div>
            <p className="heading">Analytics</p>
            <p className="subheading">System-wide statistics and performance metrics.</p>
          </div>
        </div>

        <div className="bento-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 16 }}>
          <div className="bento-card" style={{ padding: '14px 16px', display: 'flex', alignItems: 'center', gap: 12 }}>
            <div style={{ width: 48, height: 48, borderRadius: '50%', background: 'rgba(30,58,138,0.12)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#1e3a8a" strokeWidth="2"><path d="M3 21h18"/><path d="M5 21V7l8-4v18"/><path d="M19 21V11l-6-4"/></svg>
            </div>
            <div>
              <div className="card-label">Properties</div>
              <h3 style={{ margin: 0 }}>{loading ? '—' : data.properties}</h3>
              <Sparkline data={[1, 3, data.properties]} color="#1e3a8a" w={80} h={24}/>
              <p style={{ margin: 0, color: 'var(--ink-3)', fontSize: '13px' }}>total</p>
            </div>
          </div>

          <div className="bento-card" style={{ padding: '14px 16px', display: 'flex', alignItems: 'center', gap: 12 }}>
            <div style={{ width: 48, height: 48, borderRadius: '50%', background: 'rgba(245,158,11,0.12)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="var(--amber)" strokeWidth="2"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/></svg>
            </div>
            <div>
              <div className="card-label">Subscribers</div>
              <h3 style={{ margin: 0 }}>{data.subscribedLandlords}</h3>
              <Sparkline data={[data.subscribedLandlords, data.totalLandlords - data.subscribedLandlords, data.subscribedLandlords + 2]} color="var(--amber)" w={80} h={24}/>
              <p style={{ margin: 0, color: 'var(--ink-3)', fontSize: '13px' }}>active subscriptions</p>
            </div>
          </div>

          <div className="bento-card" style={{ padding: '14px 16px', display: 'flex', alignItems: 'center', gap: 12 }}>
            <div style={{ width: 48, height: 48, borderRadius: '50%', background: 'rgba(16,185,129,0.12)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="var(--accent)" strokeWidth="2"><path d="M22 11.08V12a10 12 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 8 10.01"/></svg>
            </div>
            <div>
              <div className="card-label">Collections</div>
              <h3 style={{ margin: 0 }}>{formatCurrency(data.totalPayments)}</h3>
              <Sparkline data={[50000, 100000, data.totalPayments]} color="var(--accent)" w={80} h={24}/>
              <p style={{ margin: 0, color: 'var(--ink-3)', fontSize: '13px' }}>total payments</p>
            </div>
          </div>
        </div>
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