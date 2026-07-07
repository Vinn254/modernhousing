'use client';

import { useEffect, useState } from 'react';

interface Property {
  id: string;
  name: string;
  address: string;
  unit_count: number;
  tenant_count: number;
  rent_roll: number;
  created_at: string;
  organization_id?: string;
}

interface Unit {
  id: string;
  property_id: string;
  unit_number: string;
  rent_amount: number;
  occupancy_status: 'vacant' | 'occupied';
  created_at: string;
  tenant: string | null;
  tenant_email: string | null;
  lease_start: string | null;
  lease_end: string | null;
}

export default function PropertiesPage() {
  const [properties, setProperties] = useState<Property[]>([]);
  const [units, setUnits] = useState<Unit[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [selectedProperty, setSelectedProperty] = useState<Property | null>(null);
  const [showModal, setShowModal] = useState(false);
  const [showOccupiedOnly, setShowOccupiedOnly] = useState(false);

  async function loadData() {
    setLoading(true);
    const propertiesResponse = await fetch('/api/properties');
    const propertiesResult = await propertiesResponse.json();

    if (!propertiesResponse.ok) {
      setError(propertiesResult.message ?? 'Unable to load properties.');
      setLoading(false);
      return;
    }

    setProperties(propertiesResult.properties ?? []);
    setLoading(false);
  }

  async function loadPropertyUnits(propertyId: string) {
    const unitsResponse = await fetch(`/api/units?propertyId=${encodeURIComponent(propertyId)}`);
    const unitsResult = await unitsResponse.json();

    if (!unitsResponse.ok) {
      setError(unitsResult.message ?? 'Unable to load units.');
      return;
    }

    setUnits(unitsResult.units ?? []);
  }

  useEffect(() => {
    loadData();
  }, []);

  const handleViewProperty = async (property: Property) => {
    setSelectedProperty(property);
    setShowModal(true);
    await loadPropertyUnits(property.id);
  };

  const filteredUnits = showOccupiedOnly
    ? units.filter((unit) => unit.occupancy_status === 'occupied')
    : units;

  const totalUnits = properties.reduce((sum, property) => sum + property.unit_count, 0);
  const totalTenants = properties.reduce((sum, property) => sum + property.tenant_count, 0);
  const totalVacancies = totalUnits - totalTenants;
  const totalRentRoll = properties.reduce((sum, property) => sum + Number(property.rent_roll ?? 0), 0);
  const occupancyRate = totalUnits > 0 ? Math.round((totalTenants / totalUnits) * 100) : 0;

  return (
    <>
      <main className="container admin-no-hero" style={{ padding: '34px 0 80px' }}>
        <div className="card-admin-header">
          <div>
            <p className="heading">Properties</p>
            <p className="subheading">Monitor every project manager property, occupancy level, and unit status from one place.</p>
          </div>
        </div>

        <section className="bento-section">
          <div className="bento">
            <article className="card">
              <div className="landlord-stats">
                <article className="landlord-stat">
                  <span>Total Properties</span>
                  <strong>{properties.length}</strong>
                  <p>Properties tracked across workspaces.</p>
                </article>
                <article className="landlord-stat">
                  <span>Total Units</span>
                  <strong>{totalUnits}</strong>
                  <p>Available rental units in the portfolio.</p>
                </article>
                <article className={`landlord-stat ${totalVacancies > 0 ? 'expiring-stat' : ''}`}>
                  <span>Vacancies</span>
                  <strong>{totalVacancies}</strong>
                  <p>Units currently available for tenants.</p>
                </article>
                <article className="landlord-stat">
                  <span>Occupancy</span>
                  <strong>{occupancyRate}%</strong>
                  <p>Overall rented unit percentage.</p>
                </article>
              </div>

              <div className="landlord-panel">
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

                {loading && <p className="landlord-muted">Loading properties…</p>}
                {error && <p className="landlord-error">{error}</p>}

                <div className="table-shell">
                  <table className="property-table">
                    <thead>
                      <tr>
                        <th>Property</th>
                        <th>Location</th>
                        <th>Units</th>
                        <th>Tenants</th>
                        <th>Occupancy</th>
                        <th>Rent Roll</th>
                        <th>Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {properties.length === 0 && !loading ? (
                        <tr>
                          <td colSpan={7} className="landlord-empty">No properties found.</td>
                        </tr>
                      ) : properties.map((property) => {
                        const occupancy = property.unit_count > 0 ? Math.round((property.tenant_count / property.unit_count) * 100) : 0;
                        const isFullyOccupied = property.tenant_count === property.unit_count;
                        return (
                          <tr key={property.id}>
                            <td className="landlord-name">{property.name}</td>
                            <td>{property.address}</td>
                            <td>{property.unit_count}</td>
                            <td>{property.tenant_count}</td>
                            <td>
                              <div className="property-meter" aria-label={`${occupancy}% occupied`}>
                                <span style={{ width: `${occupancy}%` }}></span>
                              </div>
                              <span className={`renewal-pill ${isFullyOccupied ? 'status-active' : 'status-pending'}`}>{occupancy}% · {isFullyOccupied ? 'Fully Occupied' : `${property.unit_count - property.tenant_count} Vacancies`}</span>
                            </td>
                            <td className="landlord-name">KSH {Number(property.rent_roll ?? 0).toLocaleString()}</td>
                            <td>
                              <button className="action-button primary" onClick={() => handleViewProperty(property)}>View</button>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            </article>
          </div>
        </section>
      </main>

      {showModal && selectedProperty && (
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
                <span>Total Units</span>
                <strong>{selectedProperty.unit_count}</strong>
              </div>
              <div className="detail-card">
                <span>Occupied Units</span>
                <strong>{selectedProperty.tenant_count}</strong>
              </div>
              <div className="detail-card">
                <span>Rent Roll</span>
                <strong>KSH {Number(selectedProperty.rent_roll ?? 0).toLocaleString()}</strong>
              </div>
            </div>

            <div className="property-unit-list" style={{ marginTop: '20px' }}>
              <div className="history-title">
                <span>Registered Units</span>
                <strong>{units.length}</strong>
                <button className="action-button" onClick={() => setShowOccupiedOnly(!showOccupiedOnly)} style={{ marginLeft: 'auto' }}>
                  {showOccupiedOnly ? 'Show All Units' : 'Show Occupied Only'}
                </button>
              </div>
              {units.length === 0 ? (
                <div className="landlord-empty">No units recorded for this property.</div>
              ) : (
                <table className="landlord-table" style={{ marginTop: '10px' }}>
                  <thead>
                    <tr>
                      <th>Unit</th>
                      <th>Rent</th>
                      <th>Status</th>
                      <th>Tenant</th>
                      <th>Email</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredUnits.map((unit) => (
                      <tr key={unit.id}>
                        <td className="landlord-name">{unit.unit_number}</td>
                        <td>KSH {Number(unit.rent_amount).toLocaleString()}</td>
                        <td>
                          <span className={`renewal-pill ${unit.occupancy_status === 'occupied' ? 'status-active' : 'status-pending'}`}>
                            {unit.occupancy_status}
                          </span>
                        </td>
                        <td>{unit.tenant || '—'}</td>
                        <td>{unit.tenant_email || '—'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
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