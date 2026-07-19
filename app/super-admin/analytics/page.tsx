'use client';

import { useEffect, useMemo, useState } from 'react';
import DonutChart from '../../components/DonutChart';
import { supabase } from '../../../lib/supabaseClient';

interface AnalyticsData {
  properties: number;
  occupiedUnits: number;
  vacantUnits: number;
  totalRentOwed: number;
  subscribedLandlords: number;
  totalLandlords: number;
  totalPayments: number;
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
    occupiedUnits: 0,
    vacantUnits: 0,
    totalRentOwed: 0,
    subscribedLandlords: 0,
    totalLandlords: 0,
    totalPayments: 0,
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

  const totalUnits = data.occupiedUnits + data.vacantUnits;
  const occupancyRate = totalUnits > 0 ? Math.round((data.occupiedUnits / totalUnits) * 100) : 0;
  const vacantUnits = Math.max(data.vacantUnits, 0);
  const totalRentOwed = Math.max(0, data.totalRentOwed || 0);

  const kpis = useMemo(() => [
    {
      title: 'Unit Occupancy',
      value: `${data.occupiedUnits}/${totalUnits}`,
      change: '+4.2%',
      trend: 'up' as const,
      tone: '#10b981',
    },
    {
      title: 'Occupancy Rate',
      value: `${occupancyRate}%`,
      change: '+2.1%',
      trend: 'up' as const,
      tone: '#2563eb',
    },
    {
      title: 'Vacant Units',
      value: String(vacantUnits),
      change: '-1.0%',
      trend: 'down' as const,
      tone: '#f59e0b',
    },
    {
      title: 'Total Rent Owed',
      value: `$${totalRentOwed.toLocaleString()}`,
      change: '+6.4%',
      trend: 'up' as const,
      tone: '#7c3aed',
    },
  ], [data.occupiedUnits, occupancyRate, totalRentOwed, totalUnits, vacantUnits]);

  const revenueSeries = [42, 58, 64, 73, 81, 89];
  const occupancySeries = [72, 74, 76, 79, 81, 85];
  const chartWidth = 420;
  const chartHeight = 220;
  const chartPadding = 24;
  const revenueMax = Math.max(...revenueSeries) * 1.15;
  const occupancyMax = Math.max(...occupancySeries);
  const occupancyMin = Math.min(...occupancySeries);

  const revenueBars = revenueSeries.map((value, index) => {
    const barWidth = 46;
    const gap = 20;
    const x = chartPadding + index * (barWidth + gap);
    const height = (value / revenueMax) * (chartHeight - chartPadding * 2);
    const y = chartHeight - chartPadding - height;
    return { x, y, height, value };
  });

  const occupancyPoints = occupancySeries.map((value, index) => {
    const x = chartPadding + index * ((chartWidth - chartPadding * 2) / (occupancySeries.length - 1));
    const y = chartHeight - chartPadding - ((value - occupancyMin) / (occupancyMax - occupancyMin || 1)) * (chartHeight - chartPadding * 2);
    return { x, y, value };
  });

  const occupancyPath = occupancyPoints.map((point, index) => `${index === 0 ? 'M' : 'L'} ${point.x} ${point.y}`).join(' ');
  const occupancyAreaPath = `${occupancyPath} L ${chartWidth - chartPadding} ${chartHeight - chartPadding} L ${chartPadding} ${chartHeight - chartPadding} Z`;

  const propertyRows: PropertyRow[] = [
    { name: 'Harbor View', occupancy: 96, rating: 4.8, revenue: '$24.2K', status: 'Stable' },
    { name: 'Lakeside Residences', occupancy: 88, rating: 4.6, revenue: '$18.9K', status: 'Stable' },
    { name: 'Maple Court', occupancy: 71, rating: 4.2, revenue: '$12.4K', status: 'Watch' },
    { name: 'Sunset Villas', occupancy: 63, rating: 3.9, revenue: '$8.7K', status: 'At Risk' },
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

        <section style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 16, marginBottom: 20 }}>
          {kpis.map((item) => (
            <article key={item.title} className="card" style={{ padding: 18, border: '1px solid rgba(16, 185, 129, 0.14)', boxShadow: '0 10px 25px rgba(16, 185, 129, 0.08)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
                <div className="card-label">{item.title}</div>
                <span style={{ color: item.tone, fontWeight: 700, fontSize: 13 }}>
                  {item.trend === 'up' ? '▲' : '▼'} {item.change}
                </span>
              </div>
              <h2 style={{ margin: 0, fontSize: 28 }}>{loading ? '—' : item.value}</h2>
            </article>
          ))}
        </section>

        <section style={{ display: 'grid', gridTemplateColumns: '1.4fr 0.9fr', gap: 20, marginBottom: 20 }}>
          <article className="card" style={{ padding: 18 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
              <div>
                <div className="card-label">Revenue</div>
                <h3 style={{ margin: '4px 0 0' }}>Collected vs Expected</h3>
              </div>
              <div style={{ fontSize: 13, color: '#047857', fontWeight: 700 }}>Target {period}</div>
            </div>
            <svg width="100%" height="240" viewBox={`0 0 ${chartWidth} ${chartHeight}`}>
              {[0, 1, 2, 3].map((line) => (
                <line key={line} x1={chartPadding} x2={chartWidth - chartPadding} y1={chartPadding + line * 45} y2={chartPadding + line * 45} stroke="#e5e7eb" strokeDasharray="4 4" />
              ))}
              {revenueBars.map((bar) => (
                <g key={bar.x}>
                  <rect x={bar.x} y={bar.y} width={46} height={bar.height} rx={10} fill="#10b981" opacity={0.9} />
                  <rect x={bar.x + 54} y={bar.y + 16} width={46} height={Math.max(18, (bar.value * 0.8) / revenueMax * (chartHeight - chartPadding * 2))} rx={10} fill="#93c5fd" opacity={0.9} />
                </g>
              ))}
            </svg>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, color: '#6b7280', marginTop: 4 }}>
              <span>Jan</span><span>Feb</span><span>Mar</span><span>Apr</span><span>May</span><span>Jun</span>
            </div>
          </article>

          <article className="card" style={{ padding: 18 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
              <div>
                <div className="card-label">Property Mix</div>
                <h3 style={{ margin: '4px 0 0' }}>Portfolio split</h3>
              </div>
            </div>
            <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: 18 }}>
              <DonutChart data={propertyMixData} size={140} thickness={24} centerLabel={`${data.properties || 12} props`} />
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {propertyMixData.map((item) => (
                  <div key={item.label} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <span style={{ width: 10, height: 10, borderRadius: 999, background: item.color }} />
                    <span style={{ fontSize: 13, color: '#374151' }}>{item.label} {item.value}%</span>
                  </div>
                ))}
              </div>
            </div>
          </article>
        </section>

        <section style={{ display: 'grid', gridTemplateColumns: '1.2fr 0.8fr', gap: 20 }}>
          <article className="card" style={{ padding: 18 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
              <div>
                <div className="card-label">Occupancy</div>
                <h3 style={{ margin: '4px 0 0' }}>Occupancy trend</h3>
              </div>
              <div style={{ color: '#047857', fontWeight: 700, fontSize: 13 }}>+13% over last 6 months</div>
            </div>
            <svg width="100%" height="240" viewBox={`0 0 ${chartWidth} ${chartHeight}`}>
              <path d={occupancyAreaPath} fill="rgba(16, 185, 129, 0.14)" />
              <path d={occupancyPath} fill="none" stroke="#10b981" strokeWidth="3" strokeLinecap="round" />
              {occupancyPoints.map((point) => (
                <circle key={point.x} cx={point.x} cy={point.y} r="5" fill="#fff" stroke="#10b981" strokeWidth="3" />
              ))}
            </svg>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, color: '#6b7280', marginTop: 4 }}>
              <span>Jan</span><span>Feb</span><span>Mar</span><span>Apr</span><span>May</span><span>Jun</span>
            </div>
          </article>

          <article className="card" style={{ padding: 18 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
              <div>
                <div className="card-label">Property performance</div>
                <h3 style={{ margin: '4px 0 0' }}>Top properties</h3>
              </div>
            </div>
            <div className="table-shell">
              <table className="landlord-table">
                <thead>
                  <tr>
                    <th>Property</th>
                    <th>Occupancy</th>
                    <th>Rating</th>
                    <th>Revenue</th>
                  </tr>
                </thead>
                <tbody>
                  {propertyRows.map((row) => (
                    <tr key={row.name}>
                      <td>
                        <div style={{ fontWeight: 700 }}>{row.name}</div>
                        <div style={{ fontSize: 12, color: '#6b7280' }}>{row.status}</div>
                      </td>
                      <td>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                          <div style={{ width: 72, height: 8, borderRadius: 999, background: '#e5e7eb' }}>
                            <div style={{ width: `${row.occupancy}%`, height: 8, borderRadius: 999, background: row.occupancy > 85 ? '#10b981' : row.occupancy > 70 ? '#f59e0b' : '#ef4444' }} />
                          </div>
                          <span>{row.occupancy}%</span>
                        </div>
                      </td>
                      <td>
                        <span style={{ color: '#f59e0b', letterSpacing: 1 }}>{'★'.repeat(Math.round(row.rating))}</span>
                        <span style={{ color: '#d1d5db' }}>{'★'.repeat(5 - Math.round(row.rating))}</span>
                      </td>
                      <td>{row.revenue}</td>
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
          <div className="footer-links"><a href="/">Home</a><a href="/super-admin">Dashboard</a></div>
          <div className="footer-copy">© 2026 Springfield Systems. All rights reserved.</div>
        </div>
      </footer>
    </>
  );
}