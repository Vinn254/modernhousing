'use client';

import { useState } from 'react';
import Link from 'next/link';

interface Property {
  id: string;
  name: string;
  address: string;
  units: number;
  tenants: number;
  admin: string;
  agent: string;
}

interface Unit {
  id: string;
  unit: string;
  tenant: string;
  rent: number;
  status: string;
  comment: string;
}

const properties: Property[] = [
  { id: '1', name: 'Sunset Apartments', address: '123 Main St', units: 24, tenants: 22, admin: 'Admin User', agent: 'John Smith' },
  { id: '2', name: 'Ocean View Residences', address: '456 Ocean Ave', units: 18, tenants: 16, admin: 'Admin User', agent: 'Jane Doe' },
];

const propertyUnits: Record<string, Unit[]> = {
  '1': [
    { id: '1', unit: 'A-101', tenant: 'Mike Johnson', rent: 120000, status: 'active', comment: '' },
    { id: '2', unit: 'A-102', tenant: 'Sarah Wilson', rent: 120000, status: 'active', comment: 'Kitchen faucet leaking, urgent repair needed' },
    { id: '3', unit: 'B-201', tenant: 'Tom Brown', rent: 150000, status: 'active', comment: '' },
  ],
  '2': [
    { id: '4', unit: 'C-101', tenant: 'Lisa Davis', rent: 130000, status: 'active', comment: 'AC not cooling properly' },
    { id: '5', unit: 'C-102', tenant: 'Alex Chen', rent: 130000, status: 'active', comment: '' },
  ],
};

export default function PropertiesPage() {
  const [selectedProperty, setSelectedProperty] = useState<Property | null>(null);
  const [showModal, setShowModal] = useState(false);

  const handleViewProperty = (property: Property) => {
    setSelectedProperty(property);
    setShowModal(true);
  };

  return (
    <>
      {/* HERO */}
      <section className="hero">
        <nav className="nav">
          <Link href="/" className="logo">
            <span className="logo-mark">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M3 21h18"/><path d="M5 21V7l8-4v18"/><path d="M19 21V11l-6-4"/></svg>
            </span>
            Springfield Systems
          </Link>
          <div className="nav-links">
            <a href="/super-admin">Dashboard</a>
            <a href="/super-admin/admins">Admins</a>
            <a href="/super-admin/agents">Agents</a>
            <a href="/super-admin/tenants">Tenants</a>
            <a href="/super-admin/payments">Payments</a>
          </div>
        </nav>

        <div className="hero-inner">
          <span className="eyebrow">
            <span className="pulse"></span>
            Super Admin
          </span>

          <h1>Properties</h1>

          <p className="hero-sub">
            Monitor all properties and their tenant distributions.
          </p>
        </div>
      </section>

      {/* BENTO */}
      <section className="bento-section">
        <div className="bento">

          <article className="card card-pm" style={{ gridColumn: 'span 12' }}>
            <div className="card-label">
              <span className="badge badge-pm">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><rect x="1" y="4" width="22" height="16" rx="2"/><line x1="1" y1="10" x2="23" y2="10"/></svg>
              </span>
              All Properties
            </div>
            <h3 style={{ marginBottom: 16 }}>Properties Overview</h3>

            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '14px' }}>
                <thead>
                  <tr style={{ borderBottom: '1px solid var(--line)' }}>
                    <th style={{ textAlign: 'left', padding: '12px 12px', fontWeight: 600, color: 'var(--ink-2)' }}>Name</th>
                    <th style={{ textAlign: 'left', padding: '12px 12px', fontWeight: 600, color: 'var(--ink-2)' }}>Address</th>
                    <th style={{ textAlign: 'left', padding: '12px 12px', fontWeight: 600, color: 'var(--ink-2)' }}>Units</th>
                    <th style={{ textAlign: 'left', padding: '12px 12px', fontWeight: 600, color: 'var(--ink-2)' }}>Tenants</th>
                    <th style={{ textAlign: 'left', padding: '12px 12px', fontWeight: 600, color: 'var(--ink-2)' }}>Agent</th>
                    <th style={{ textAlign: 'left', padding: '12px 12px', fontWeight: 600, color: 'var(--ink-2)' }}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {properties.map((property) => (
                    <tr key={property.id} style={{ borderBottom: '1px solid var(--line-soft)' }}>
                      <td style={{ padding: '16px 12px 16px 0', fontWeight: 500 }}>{property.name}</td>
                      <td style={{ padding: '16px 12px', color: 'var(--ink-3)' }}>{property.address}</td>
                      <td style={{ padding: '16px 12px' }}>{property.units}</td>
                      <td style={{ padding: '16px 12px' }}>{property.tenants}</td>
                      <td style={{ padding: '16px 12px', color: 'var(--accent-bright)', fontWeight: 500 }}>{property.agent}</td>
                      <td style={{ padding: '16px 12px' }}>
                        <button onClick={() => handleViewProperty(property)} className="btn btn-primary" style={{ fontSize: '12px', padding: '6px 12px' }}>View</button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </article>

        </div>
      </section>

      {showModal && selectedProperty && (
        <div className="modal-overlay" onClick={(e) => e.target === e.currentTarget && setShowModal(false)}>
          <div className="modal-card" style={{ maxWidth: 500, width: '90%' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
              <h3 style={{ margin: 0 }}>{selectedProperty.name}</h3>
              <button onClick={() => setShowModal(false)} className="btn btn-ghost" style={{ fontSize: '18px', padding: '4px 8px' }}>✕</button>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <div style={{ padding: 16, background: 'var(--line-soft)', borderRadius: 10 }}>
                <div style={{ fontSize: 12, color: 'var(--ink-3)', textTransform: 'uppercase', letterSpacing: 0.05, marginBottom: 4 }}>Location</div>
                <div style={{ fontSize: 16, fontWeight: 600, color: 'var(--ink)' }}>{selectedProperty.address}</div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <div style={{ padding: 16, background: 'var(--accent-soft)', borderRadius: 10, textAlign: 'center' }}>
                  <div style={{ fontSize: 24, fontWeight: 700, color: 'var(--accent)' }}>{selectedProperty.units}</div>
                  <div style={{ fontSize: 11, color: 'var(--ink-3)', textTransform: 'uppercase' }}>Units</div>
                </div>
                <div style={{ padding: 16, background: 'var(--line-soft)', borderRadius: 10, textAlign: 'center' }}>
                  <div style={{ fontSize: 24, fontWeight: 700, color: 'var(--ink)' }}>{selectedProperty.tenants}</div>
                  <div style={{ fontSize: 11, color: 'var(--ink-3)', textTransform: 'uppercase' }}>Tenants</div>
                </div>
              </div>

              <div style={{ padding: 16, background: selectedProperty.tenants === selectedProperty.units ? 'var(--accent-soft)' : 'rgba(245,158,11,0.1)', borderRadius: 10, textAlign: 'center' }}>
                <span style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '6px',
                  padding: '4px 12px',
                  borderRadius: '999px',
                  fontSize: '12px',
                  fontWeight: 500,
                  backgroundColor: selectedProperty.tenants === selectedProperty.units ? 'var(--accent-soft)' : 'rgba(245,158,11,0.1)',
                  color: selectedProperty.tenants === selectedProperty.units ? 'var(--accent)' : 'var(--amber)'
                }}>
                  <span style={{
                    width: '6px',
                    height: '6px',
                    borderRadius: '50%',
                    backgroundColor: selectedProperty.tenants === selectedProperty.units ? 'var(--accent)' : 'var(--amber)'
                  }}></span>
                  {selectedProperty.tenants === selectedProperty.units ? 'Fully Occupied' : 'Vacancies'}
                </span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* FOOTER */}
      <footer>
        <div className="footer-inner">
          <div className="footer-brand">
            <span className="logo-mark" style={{width:26,height:26,borderRadius:7}}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M3 21h18"/><path d="M5 21V7l8-4v18"/><path d="M19 21V11l-6-4"/></svg>
            </span>
            Springfield Systems
          </div>
          <div className="footer-links">
            <a href="/">Home</a>
            <a href="/super-admin">Dashboard</a>
          </div>
          <div className="footer-copy">© 2024 Springfield Systems. All rights reserved.</div>
        </div>
      </footer>
    </>
  );
}