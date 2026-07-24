'use client';

import { useEffect, useMemo, useState } from 'react';
import DonutChart from '../../components/DonutChart';
import { supabase } from '../../../lib/supabaseClient';

interface AnalyticsData {
  properties: number;
  subscribedLandlords: number;
  totalLandlords: number;
  totalSubscriptions: number;
  subscriptionOwed: number;
}

interface PropertyRow {
  name: string;
  occupancy: number;
  rating: number;
  revenue: string;
  status: 'Stable' | 'Watch' | 'At Risk';
}

const periodOptions = ['1M', '3M', '6M', '1Y'] as const;
type PeriodKey = (typeof periodOptions)[number];

export default function AnalyticsPage() {
  const [data, setData] = useState<AnalyticsData>({
    properties: 0,
    subscribedLandlords: 0,
    totalLandlords: 0,
    totalSubscriptions: 0,
    subscriptionOwed: 0,
  });
  const [loading, setLoading] = useState(true);
  const [period, setPeriod] = useState<PeriodKey>('3M');

  useEffect(() => {
    async function loadData() {
      const { data: { session } } = await supabase.auth.getSession();
      const headers: Record<string, string> = { 'Content-Type': 'application/json' };
      if (session?.access_token) headers.Authorization = `Bearer ${session.access_token}`;

      fetch('/api/dashboard', { headers })
        .then((response) => response.json())
        .then(setData)
        .catch(() => {})
        .finally(() => setLoading(false));
    }

    loadData();
    const interval = window.setInterval(loadData, 30000);
    return () => window.clearInterval(interval);
  }, []);

  const kpis = useMemo(() => [
    {
      title: 'Property Registered',
      value: String(data.properties),
      change: '+4.2%',
      trend: 'up' as const,
      tone: '#10b981',
    },
    {
      title: 'Subscription Owed',
      value: `KSH ${Math.max(0, data.subscriptionOwed || 0).toLocaleString()}`,
      change: '+2.1%',
      trend: 'up' as const,
      tone: '#2563eb',
    },
    {
      title: 'Total Subscriptions',
      value: `KSH ${data.totalSubscriptions.toLocaleString()}`,
      change: '+6.4%',
      trend: 'up' as const,
      tone: '#7c3aed',
    },
    {
      title: 'Active Landlords',
      value: `${data.subscribedLandlords}/${data.totalLandlords}`,
      change: '+8.1%',
      trend: 'up' as const,
      tone: '#0ea5e9',
    },
  ], [data.properties, data.subscriptionOwed, data.totalSubscriptions, data.subscribedLandlords, data.totalLandlords]);

  const revenueSeries = [42, 58, 64, 73, 81, 89];
  const chartWidth = 300;
  const chartHeight = 160;
  const chartPadding = 16;
  const revenueMax = Math.max(...revenueSeries) * 1.15;

  const revenueBars = revenueSeries.map((value, index) => {
    const barWidth = 34;
    const gap = 12;
    const x = chartPadding + index * (barWidth + gap);
    const height = (value / revenueMax) * (chartHeight - chartPadding * 2);
    const y = chartHeight - chartPadding - height;
    return { x, y, height, value };
  });

  const propertyRows: PropertyRow[] = [
    { name: 'Harbor View', occupancy: 96, rating: 4.8, revenue: 'KSH 24.2K', status: 'Stable' },
    { name: 'Lakeside Residences', occupancy: 88, rating: 4.6, revenue: 'KSH 18.9K', status: 'Stable' },
    { name: 'Maple Court', occupancy: 71, rating: 4.2, revenue: 'KSH 12.4K', status: 'Watch' },
    { name: 'Sunset Villas', occupancy: 63, rating: 3.9, revenue: 'KSH 8.7K', status: 'At Risk' },
  ];

  const propertyMixData = [
    { label: 'Residential', value: 58, color: '#10b981' },
    { label: 'Commercial', value: 22, color: '#3b82f6' },
    { label: 'Mixed Use', value: 20, color: '#f59e0b' },
  ];

  return (
    <>
      <main className="container admin-no-hero floral-bg">
        <div className="card-admin-header" style={{ marginBottom: 20 }}>
          <div>
            <p className="heading">Reports</p>
            <p className="subheading">Portfolio health, occupancy, revenue outlook, and property performance.</p>
          </div>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            {periodOptions.map((item) => (
              <button
                key={item}
                type="button"
                onClick={() => setPeriod(item)}
                style={{
                  border: period === item ? '1px solid #10b981' : '1px solid #d1d5db',
                  background: period === item ? '#ecfdf5' : '#fff',
                  color: period === item ? '#047857' : '#374151',
                  borderRadius: 999,
                  padding: '8px 12px',
                  fontWeight: 700,
                  cursor: 'pointer',
                }}
              >
                {item}
              </button>
            ))}
          </div>
        </div>

        <section style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 12, marginBottom: 20 }}>
          {kpis.map((item) => (
            <article key={item.title} className="card" style={{ padding: 14, border: '1px solid rgba(16, 185, 129, 0.14)', boxShadow: '0 6px 18px rgba(16, 185, 129, 0.06)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                <div className="card-label">{item.title}</div>
                <span style={{ color: item.tone, fontWeight: 700, fontSize: 12 }}>
                  {item.trend === 'up' ? '▲' : '▼'} {item.change}
                </span>
              </div>
              <div style={{ fontSize: 22, fontWeight: 700, margin: 0 }}>{loading ? '—' : item.value}</div>
            </article>
          ))}
        </section>

        <section style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: 16, marginBottom: 20 }}>
          <article className="card card-feat-10" style={{ padding: 14 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
              <div>
                <div className="card-label">Revenue</div>
                <div style={{ fontSize: 13, opacity: 0.8 }}>Collected vs Expected</div>
              </div>
              <div style={{ fontSize: 12, color: '#047857', fontWeight: 700 }}>Target {period}</div>
            </div>
            <svg width="100%" height="140" viewBox={`0 0 ${chartWidth} ${chartHeight}`}>
              {[0, 1, 2, 3].map((line) => (
                <line key={line} x1={chartPadding} x2={chartWidth - chartPadding} y1={chartPadding + line * 32} y2={chartPadding + line * 32} stroke="#e5e7eb" strokeDasharray="3 3" />
              ))}
              {revenueBars.map((bar) => (
                <g key={bar.x}>
                  <rect x={bar.x} y={bar.y} width={34} height={bar.height} rx={6} fill="#10b981" opacity={0.9} />
                  <rect x={bar.x + 46} y={bar.y + 10} width={34} height={Math.max(12, (bar.value * 0.8) / revenueMax * (chartHeight - chartPadding * 2))} rx={6} fill="#93c5fd" opacity={0.9} />
                </g>
              ))}
            </svg>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, color: '#6b7280', marginTop: 4 }}>
              <span>Jan</span><span>Feb</span><span>Mar</span><span>Apr</span><span>May</span><span>Jun</span>
            </div>
          </article>

          <article className="card card-feat-3" style={{ padding: 14 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
              <div>
                <div className="card-label">Property Mix</div>
                <div style={{ fontSize: 13, opacity: 0.8 }}>Portfolio split</div>
              </div>
            </div>
            <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: 12 }}>
              <DonutChart data={propertyMixData} size={100} thickness={16} centerLabel={`${data.properties || 12} props`} />
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                {propertyMixData.map((item) => (
                  <div key={item.label} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <span style={{ width: 8, height: 8, borderRadius: 999, background: item.color }} />
                    <span style={{ fontSize: 12, color: '#374151' }}>{item.label} {item.value}%</span>
                  </div>
                ))}
              </div>
            </div>
          </article>
        </section>

        <section style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: 16 }}>
          <article className="card card-feat-1" style={{ padding: 14 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
              <div>
                <div className="card-label">Occupancy</div>
                <div style={{ fontSize: 13, opacity: 0.8 }}>Occupancy trend</div>
              </div>
              <div style={{ color: '#047857', fontWeight: 700, fontSize: 12 }}>+13% last 6 months</div>
            </div>
            <svg width="100%" height="140" viewBox={`0 0 ${chartWidth} ${chartHeight}`}>
              <path d="M16 100 L70 84 L124 68 L178 52 L232 40 L286 32 L286 144 L16 144 Z" fill="rgba(16, 185, 129, 0.14)" />
              <path d="M16 100 L70 84 L124 68 L178 52 L232 40 L286 32" fill="none" stroke="#10b981" strokeWidth="2" strokeLinecap="round" />
              <circle cx="16" cy="100" r="3" fill="#fff" stroke="#10b981" strokeWidth="2" />
              <circle cx="70" cy="84" r="3" fill="#fff" stroke="#10b981" strokeWidth="2" />
              <circle cx="124" cy="68" r="3" fill="#fff" stroke="#10b981" strokeWidth="2" />
              <circle cx="178" cy="52" r="3" fill="#fff" stroke="#10b981" strokeWidth="2" />
              <circle cx="232" cy="40" r="3" fill="#fff" stroke="#10b981" strokeWidth="2" />
              <circle cx="286" cy="32" r="3" fill="#fff" stroke="#10b981" strokeWidth="2" />
            </svg>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, color: '#6b7280', marginTop: 4 }}>
              <span>Jan</span><span>Feb</span><span>Mar</span><span>Apr</span><span>May</span><span>Jun</span>
            </div>
          </article>

          <article className="card card-feat-2" style={{ padding: 14 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
              <div>
                <div className="card-label">Property performance</div>
                <div style={{ fontSize: 13, opacity: 0.8 }}>Top properties</div>
              </div>
            </div>
            <div style={{ maxHeight: '200px', overflowY: 'auto' }}>
              <table className="landlord-table" style={{ fontSize: '12px' }}>
                <thead>
                  <tr>
                    <th style={{ padding: '6px 8px' }}>Property</th>
                    <th style={{ padding: '6px 8px' }}>Rating</th>
                    <th style={{ padding: '6px 8px' }}>Revenue</th>
                  </tr>
                </thead>
                <tbody>
                  {propertyRows.map((row) => (
                    <tr key={row.name}>
                      <td style={{ padding: '6px 8px' }}>
                        <div style={{ fontWeight: 600 }}>{row.name}</div>
                      </td>
                      <td style={{ padding: '6px 8px' }}>
                        <span style={{ color: '#f59e0b' }}>{'★'.repeat(Math.round(row.rating))}</span>
                        <span style={{ color: '#d1d5db' }}>{'★'.repeat(5 - Math.round(row.rating))}</span>
                      </td>
                      <td style={{ padding: '6px 8px' }}>{row.revenue}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </article>
        </section>
      </main>

      <footer>
        <div className="footer-inner">
          <div className="footer-brand"><span className="logo-mark" style={{ width: 26, height: 26, borderRadius: 7 }}><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M3 21h18" /><path d="M5 21V7l8-4v18" /><path d="M19 21V11l-6-4" /></svg></span>Springfield Systems</div>
          <div className="footer-copy">© 2026 Springfield Systems. All rights reserved.</div>
        </div>
      </footer>
    </>
  );
}