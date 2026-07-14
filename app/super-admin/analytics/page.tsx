'use client';

import { useEffect, useState } from 'react';
import DonutChart from '../../components/DonutChart';
import { supabase } from '../../../lib/supabaseClient';

interface AnalyticsData {
  properties: number;
  occupiedUnits: number;
  vacantUnits: number;
  subscribedLandlords: number;
  totalLandlords: number;
  totalPayments: number;
}

export default function AnalyticsPage() {
  const [data, setData] = useState<AnalyticsData>({
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
      const headers: Record<string, string> = { 'Content-Type': 'application/json' };
      if (session?.access_token) headers.Authorization = `Bearer ${session.access_token}`;
      
      fetch('/api/dashboard', { headers })
        .then(r => r.json())
        .then(setData)
        .catch(() => {})
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

  return (
    <>
      <main className="container admin-no-hero">
        <div className="card-admin-header">
          <div>
            <p className="heading">Analytics</p>
            <p className="subheading">System-wide statistics and performance metrics.</p>
          </div>
        </div>

        <section className="bento-section">
          <div className="bento">
            <article className="card card-pm" style={{ textAlign: 'center' }}>
              <div className="card-label">Units Occupancy</div>
              <DonutChart data={unitOccupancyData} centerLabel={String(data.occupiedUnits) + '/' + String(data.occupiedUnits + data.vacantUnits)} />
              <p style={{ color: 'var(--ink-3)', marginTop: 12, fontSize: '13px' }}>Occupied vs Vacant Units</p>
            </article>

            <article className="card card-agent" style={{ textAlign: 'center' }}>
              <div className="card-label">Landlord Subscriptions</div>
              <DonutChart data={subscriptionData} centerLabel={String(data.subscribedLandlords)} />
              <p style={{ color: 'var(--ink-3)', marginTop: 12, fontSize: '13px' }}>Active Subscriptions</p>
            </article>

            <article className="card card-feat card-feat-1" style={{ textAlign: 'center' }}>
              <div className="card-label">Total Payments</div>
              <h3 style={{ fontSize: '36px', fontWeight: 700, margin: '8px 0 4px' }}>{data.totalPayments}</h3>
              <p style={{ color: 'var(--ink-3)', margin: 0, fontSize: '14px' }}>Payment transactions</p>
            </article>
          </div>
        </section>
      </main>

      <footer>
        <div className="footer-inner">
          <div className="footer-brand"><span className="logo-mark" style={{width:26,height:26,borderRadius:7}}><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M3 21h18"/><path d="M5 21V7l8-4v18"/><path d="M19 21V11l-6-4"/></svg></span>Springfield Systems</div>
          <div className="footer-links"><a href="/">Home</a><a href="/super-admin">Dashboard</a></div>
          <div className="footer-copy">© 2026 Springfield Systems. All rights reserved.</div>
        </div>
      </footer>
    </>
  );
}