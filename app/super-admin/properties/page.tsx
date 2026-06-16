'use client';

import { useState } from 'react';
import Link from 'next/link';
import AdminTopNav from '../../components/AdminTopNav';

interface Property {
  id: string;
  name: string;
  address: string;
  units: number;
  tenants: number;
  admin: string;
  agent: string;
  rentRoll: number;
  lastUpdated: string;
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
  { id: '1', name: 'Sunset Apartments', address: '123 Main St', units: 24, tenants: 22, admin: 'Admin User', agent: 'John Smith', rentRoll: 2940000, lastUpdated: '2026-06-14' },
  { id: '2', name: 'Ocean View Residences', address: '456 Ocean Ave', units: 18, tenants: 16, admin: 'Admin User', agent: 'Jane Doe', rentRoll: 2210000, lastUpdated: '2026-06-12' },
  { id: '3', name: 'Greenwood Heights', address: '88 Garden Road', units: 30, tenants: 30, admin: 'Admin User', agent: 'Mark Lewis', rentRoll: 4350000, lastUpdated: '2026-06-10' },
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
  '3': [
    { id: '6', unit: 'D-301', tenant: 'Grace Mwangi', rent: 145000, status: 'active', comment: '' },
    { id: '7', unit: 'D-302', tenant: 'Brian Ochieng', rent: 145000, status: 'active', comment: '' },
  ],
};

function getOccupancyClass(property: Property) {
  return property.tenants === property.units ? 'status-active' : 'status-pending';
}

function getOccupancyLabel(property: Property) {
  return property.tenants === property.units ? 'Fully Occupied' : `${property.units - property.tenants} Vacancies`;
}

export default function PropertiesPage() {
  const [selectedProperty, setSelectedProperty] = useState<Property>(properties[0]);
  const [showModal, setShowModal] = useState(false);

  const totalUnits = properties.reduce((sum, property) => sum + property.units, 0);
  const totalTenants = properties.reduce((sum, property) => sum + property.tenants, 0);
  const totalVacancies = totalUnits - totalTenants;
  const totalRentRoll = properties.reduce((sum, property) => sum + property.rentRoll, 0);
  const occupancyRate = Math.round((totalTenants / totalUnits) * 100);
  const selectedUnits = propertyUnits[selectedProperty.id] ?? [];

  const handleViewProperty = (property: Property) => {
    setSelectedProperty(property);
    setShowModal(true);
  };

  return (
    <>
      <section className="hero">
        <nav className="nav">
          <Link href="/" className="logo">
            <span className="logo-mark">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M3 21h18"/><path d="M5 21V7l8-4v18"/><path d="M19 21V11l-6-4"/></svg>
            </span>
            Springfield Systems
          </Link>
          <AdminTopNav variant="super" />
        </nav>

        <div className="hero-inner">
          <span className="eyebrow">
            <span className="pulse"></span>
            Super Admin
          </span>

          <h1>Properties</h1>

          <p className="hero-sub">
            Monitor every landlord property, occupancy level, assigned agent, and unit status from one place.
          </p>
        </div>
      </section>

      <section className="landlord-section">
        <div className="property-stats">
          <article className="property-stat">
            <span>Total Properties</span>
            <strong>{properties.length}</strong>
            <p>Properties tracked across landlord workspaces.</p>
          </article>
          <article className="property-stat">
            <span>Total Units</span>
            <strong>{totalUnits}</strong>
            <p>Available rental units in the portfolio.</p>
          </article>
          <article className={`property-stat ${totalVacancies > 0 ? 'warning' : ''}`}>
            <span>Vacancies</span>
            <strong>{totalVacancies}</strong>
            <p>Units currently available for tenants.</p>
          </article>
          <article className="property-stat">
            <span>Occupancy</span>
            <strong>{occupancyRate}%</strong>
            <p>Overall rented unit percentage.</p>
          </article>
        </div>

        <div className="landlord-panel property-panel">
          <div className="landlord-panel-header">
            <div>
              <span className="landlord-kicker">Portfolio</span>
              <h2>Property Overview</h2>
            </div>
            <div className="property-summary">
              <div>
                <span>Rent Roll</span>
                <strong>KSH {totalRentRoll.toLocaleString()}</strong>
              </div>
              <div>
                <span>Active Units</span>
                <strong>{totalTenants}</strong>
              </div>
              <div>
                <span>Updated</span>
                <strong>Today</strong>
              </div>
            </div>
          </div>

          <div className="table-shell">
            <table className="property-table">
              <thead>
                <tr>
                  <th>Property</th>
                  <th>Location</th>
                  <th>Units</th>
                  <th>Tenants</th>
                  <th>Occupancy</th>
                  <th>Agent</th>
                  <th>Rent Roll</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {properties.map((property) => {
                  const occupancy = Math.round((property.tenants / property.units) * 100);
                  return (
                    <tr key={property.id}>
                      <td className="landlord-name">{property.name}</td>
                      <td>{property.address}</td>
                      <td>{property.units}</td>
                      <td>{property.tenants}</td>
                      <td>
                        <div className="property-meter" aria-label={`${occupancy}% occupied`}>
                          <span style={{ width: `${occupancy}%` }}></span>
                        </div>
                        <span className={`renewal-pill ${getOccupancyClass(property)}`}>{occupancy}% · {getOccupancyLabel(property)}</span>
                      </td>
                      <td>{property.agent}</td>
                      <td className="landlord-name">KSH {property.rentRoll.toLocaleString()}</td>
                      <td>
                        <div className="landlord-actions">
                          <button className="action-button primary" onClick={() => handleViewProperty(property)}>View</button>
                          <button className="action-button" onClick={() => setSelectedProperty(property)}>Preview</button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>

        <div className="landlord-panel notification-panel">
          <div className="landlord-panel-header">
            <div>
              <span className="landlord-kicker">Unit Snapshot</span>
              <h2>{selectedProperty.name}</h2>
            </div>
          </div>
          <p className="landlord-muted">{selectedProperty.address} · {selectedProperty.agent}</p>

          <div className="property-unit-grid">
            {selectedUnits.map((unit) => (
              <article className="property-unit-card" key={unit.id}>
                <div>
                  <strong>{unit.unit}</strong>
                  <span className={`renewal-pill ${unit.status === 'active' ? 'status-active' : 'status-pending'}`}>{unit.status}</span>
                </div>
                <p>{unit.tenant}</p>
                <small>KSH {unit.rent.toLocaleString()}</small>
                {unit.comment && <em>{unit.comment}</em>}
              </article>
            ))}
            {selectedUnits.length === 0 && <div className="landlord-empty">No units recorded for this property.</div>}
          </div>
        </div>
      </section>

      {showModal && (
        <div className="modal-overlay" onClick={(e) => e.target === e.currentTarget && setShowModal(false)}>
          <div className="modal-card landlord-modal property-modal">
            <div className="modal-title-row">
              <h3>{selectedProperty.name}</h3>
              <button className="icon-button" onClick={() => setShowModal(false)}>×</button>
            </div>

            <div className="detail-grid">
              <div className="detail-card">
                <span>Location</span>
                <strong>{selectedProperty.address}</strong>
              </div>
              <div className="detail-card">
                <span>Assigned Agent</span>
                <strong>{selectedProperty.agent}</strong>
              </div>
              <div className="detail-card">
                <span>Total Units</span>
                <strong>{selectedProperty.units}</strong>
              </div>
              <div className="detail-card">
                <span>Occupied Units</span>
                <strong>{selectedProperty.tenants}</strong>
              </div>
              <div className="detail-card">
                <span>Rent Roll</span>
                <strong>KSH {selectedProperty.rentRoll.toLocaleString()}</strong>
              </div>
              <div className="detail-card">
                <span>Last Updated</span>
                <strong>{selectedProperty.lastUpdated}</strong>
              </div>
            </div>

            <div className="property-unit-list">
              <div className="history-title">
                <span>Registered Units</span>
                <strong>{selectedUnits.length}</strong>
              </div>
              {selectedUnits.map((unit) => (
                <div className="notification-item" key={unit.id}>
                  <div>
                    <strong>{unit.unit} · {unit.tenant}</strong>
                    <span>{unit.comment || 'No open notes'}</span>
                  </div>
                  <small>KSH {unit.rent.toLocaleString()}</small>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

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
          <div className="footer-copy">© 2026 Springfield Systems. All rights reserved.</div>
        </div>
      </footer>
    </>
  );
}
