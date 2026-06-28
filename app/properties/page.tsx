'use client';

import { useEffect, useRef, useState } from 'react';
import { supabase } from '../../lib/supabaseClient';

interface Unit {
  id: string;
  property_id: string;
  unit_number: string;
  rent_amount: number;
  occupancy_status: string;
  tenant?: string;
}

interface Property {
  id: string;
  name: string;
  address: string;
  size?: string;
  amenities?: string;
  ownership_info?: string;
  created_at?: string;
  unit_count?: number;
  occupied_units?: number;
  tenant_count?: number;
  rent_roll?: number;
}

const emptyForm = {
  name: '',
  address: '',
  size: '',
  amenities: '',
  ownershipInfo: '',
};

async function getAuthHeaders() {
  const { data } = await supabase.auth.getSession();
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (data.session?.access_token) headers.Authorization = `Bearer ${data.session.access_token}`;
  return headers;
}

export default function PropertiesPage() {
  const formRef = useRef<HTMLDivElement>(null);
  const [properties, setProperties] = useState<Property[]>([]);
  const [units, setUnits] = useState<Unit[]>([]);
  const [form, setForm] = useState(emptyForm);
  const [unitForm, setUnitForm] = useState({ propertyId: '', unitNumber: '', rentAmount: '', occupancyStatus: 'vacant' as const });
  const [editingProperty, setEditingProperty] = useState<Property | null>(null);
  const [selectedProperty, setSelectedProperty] = useState<Property | null>(null);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  async function loadProperties() {
    setLoading(true);
    setError('');

    const response = await fetch('/api/properties', {
      headers: await getAuthHeaders(),
    });
    const result = await response.json();

    if (!response.ok) {
      setError(result.message ?? 'Unable to load properties.');
      setLoading(false);
      return;
    }

    setProperties(result.properties ?? []);
    setLoading(false);
  }

  async function loadUnits() {
    try {
      const response = await fetch('/api/units', { headers: await getAuthHeaders() });
      const result = await response.json();
      if (response.ok) setUnits(result.units ?? []);
    } catch (e) {}
  }

  useEffect(() => {
    Promise.all([loadProperties(), loadUnits()]);
  }, []);

  useEffect(() => {
    if (!selectedProperty) return;
    const refreshed = properties.find((property) => property.id === selectedProperty.id);
    if (refreshed) setSelectedProperty(refreshed);
  }, [properties, selectedProperty]);

  function updateForm(field: keyof typeof form, value: string) {
    setForm((current) => ({ ...current, [field]: value }));
  }

  function resetForm() {
    setForm(emptyForm);
    setEditingProperty(null);
    setMessage('');
    setError('');
  }

  function scrollToForm() {
    formRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setMessage('');
    setError('');
    setSaving(true);

    const body = editingProperty ? { ...form, id: editingProperty.id } : form;

    const response = await fetch('/api/properties', {
      method: editingProperty ? 'PATCH' : 'POST',
      headers: await getAuthHeaders(),
      body: JSON.stringify(body),
    });

    const result = await response.json();
    setSaving(false);

    if (!response.ok) {
      setError(result.message || (editingProperty ? 'Unable to update property.' : 'Unable to create property.'));
      return;
    }

    setMessage(editingProperty ? 'Property updated successfully.' : 'Property created successfully.');
    resetForm();
    await loadProperties();
  }

  async function handleEdit(property: Property) {
    setEditingProperty(property);
    setForm({
      name: property.name,
      address: property.address,
      size: property.size ?? '',
      amenities: property.amenities ?? '',
      ownershipInfo: property.ownership_info ?? '',
    });
    setMessage('');
    setError('');
    scrollToForm();
  }

  async function handleRemove(propertyId: string) {
    if (!confirm('Remove this property? Units and tenants assigned to it will also be removed.')) return;

    const response = await fetch(`/api/properties?id=${encodeURIComponent(propertyId)}`, {
      method: 'DELETE',
      headers: await getAuthHeaders(),
    });
    const result = await response.json();

    if (!response.ok) {
      setError(result.message || 'Unable to remove property.');
      return;
    }

    setMessage('Property removed.');
    if (selectedProperty?.id === propertyId) setSelectedProperty(null);
    await loadProperties();
  }

  async function handleAddUnit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setMessage('');
    setError('');

    const response = await fetch('/api/units', {
      method: 'POST',
      headers: await getAuthHeaders(),
      body: JSON.stringify({
        propertyId: unitForm.propertyId,
        unitNumber: unitForm.unitNumber,
        rentAmount: Number(unitForm.rentAmount) || 0,
        occupancyStatus: unitForm.occupancyStatus,
      }),
    });

    const result = await response.json();

    if (!response.ok) {
      setError(result.message || 'Unable to add unit.');
      return;
    }

    setMessage('Unit added successfully.');
    setUnitForm({ propertyId: '', unitNumber: '', rentAmount: '', occupancyStatus: 'vacant' });
    await Promise.all([loadProperties(), loadUnits()]);
  }

  const totalUnits = properties.reduce((sum, property) => sum + Number(property.unit_count ?? 0), 0);
  const occupiedUnits = properties.reduce((sum, property) => sum + Number(property.occupied_units ?? 0), 0);
  const totalTenants = properties.reduce((sum, property) => sum + Number(property.tenant_count ?? 0), 0);
  const rentRoll = properties.reduce((sum, property) => sum + Number(property.rent_roll ?? 0), 0);
  const occupancyRate = totalUnits > 0 ? Math.round((occupiedUnits / totalUnits) * 100) : 0;

  return (
    <main className="container property-page-main">
      <div className="card-admin-header property-hero-card">
        <div>
          <span className="landlord-kicker">Project Manager Workspace</span>
          <h1 className="property-page-title">Properties</h1>
          <p className="property-page-subtitle">Build your portfolio, track units, and keep every property ready for agents and tenants.</p>
        </div>
        <div className="property-header-metrics">
          <div>
            <span>Properties</span>
            <strong>{properties.length}</strong>
          </div>
          <div>
            <span>Units</span>
            <strong>{totalUnits}</strong>
          </div>
          <div>
            <span>Occupancy</span>
            <strong>{occupancyRate}%</strong>
          </div>
        </div>
      </div>

      {message && <p className="landlord-success property-alert">{message}</p>}
      {error && <p className="landlord-error property-alert">{error}</p>}

      <section className="landlord-section property-section">
        <div className="property-stats">
          <article className="property-stat">
            <span>Portfolio</span>
            <strong>{properties.length}</strong>
            <p>Active properties in your workspace.</p>
          </article>
          <article className="property-stat">
            <span>Total Units</span>
            <strong>{totalUnits}</strong>
            <p>Units recorded across all properties.</p>
          </article>
          <article className={`property-stat ${totalUnits > occupiedUnits ? 'warning' : ''}`}>
            <span>Vacant Units</span>
            <strong>{Math.max(totalUnits - occupiedUnits, 0)}</strong>
            <p>Available units waiting for tenants.</p>
          </article>
          <article className="property-stat">
            <span>Rent Roll</span>
            <strong>KSH {rentRoll.toLocaleString()}</strong>
            <p>Monthly rent from recorded units.</p>
          </article>
        </div>

        <div className="property-page-grid">
          <div ref={formRef} className="card property-form-card">
            <div className="card-label">
              <span className="badge badge-pm">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M12 5v14"/><path d="M5 12h14"/></svg>
              </span>
              {editingProperty ? 'Edit Property' : 'Add Property'}
            </div>
            <h3>{editingProperty ? 'Update Property Details' : 'Create New Property'}</h3>
            <form onSubmit={handleSubmit} className="form-grid">
              <div className="field-group">
                <label>Property name</label>
                <input value={form.name} onChange={(event) => updateForm('name', event.target.value)} required placeholder="Sunset Apartments" />
              </div>
              <div className="field-group">
                <label>Address</label>
                <input value={form.address} onChange={(event) => updateForm('address', event.target.value)} required placeholder="123 Main Street" />
              </div>
              <div className="field-group">
                <label>Size / units</label>
                <input value={form.size} onChange={(event) => updateForm('size', event.target.value)} placeholder="24 units" />
              </div>
              <div className="field-group">
                <label>Amenities</label>
                <input value={form.amenities} onChange={(event) => updateForm('amenities', event.target.value)} placeholder="Parking, water, security" />
              </div>
              <div className="field-group field-group-wide">
                <label>Ownership info</label>
                <textarea value={form.ownershipInfo} onChange={(event) => updateForm('ownershipInfo', event.target.value)} placeholder="Owner details, title deed notes, or management notes" rows={4} />
              </div>
              <div className="modal-actions property-form-actions">
                <button type="submit" disabled={saving}>{saving ? 'Saving…' : editingProperty ? 'Update Property' : 'Create Property'}</button>
                {editingProperty && <button type="button" className="secondary-button" onClick={resetForm}>Cancel Edit</button>}
              </div>
            </form>

            <div className="card-label" style={{ marginTop: 32 }}>
              <span className="badge badge-pm">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><rect x="1" y="4" width="22" height="16" rx="2"/><line x1="1" y1="10" x2="23" y2="10"/></svg>
              </span>
              Add Unit
            </div>
            <h3>Add Unit to Property</h3>
            <form onSubmit={handleAddUnit} className="form-grid">
              <select value={unitForm.propertyId} onChange={(e) => setUnitForm(f => ({ ...f, propertyId: e.target.value }))} required>
                <option value="">Select property</option>
                {properties.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
              </select>
              <input value={unitForm.unitNumber} onChange={(e) => setUnitForm(f => ({ ...f, unitNumber: e.target.value }))} required placeholder="Unit number (e.g., A1, B2)" />
              <input type="number" value={unitForm.rentAmount} onChange={(e) => setUnitForm(f => ({ ...f, rentAmount: e.target.value }))} placeholder="Rent amount (KSH)" />
              <select value={unitForm.occupancyStatus} onChange={(e) => setUnitForm(f => ({ ...f, occupancyStatus: e.target.value as any }))}>
                <option value="vacant">Vacant</option>
                <option value="occupied">Occupied</option>
              </select>
              <button type="submit">Add Unit</button>
            </form>

            {selectedProperty && (
              <div className="property-detail-card">
                <div className="history-title">
                  <span>Selected Property</span>
                  <strong>{selectedProperty.name}</strong>
                </div>
                <p>{selectedProperty.address}</p>
                <div className="detail-grid">
                  <div className="detail-card"><span>Units</span><strong>{selectedProperty.unit_count ?? 0}</strong></div>
                  <div className="detail-card"><span>Tenants</span><strong>{selectedProperty.tenant_count ?? 0}</strong></div>
                </div>
              </div>
            )}
          </div>

          <div className="card property-list-card">
            <div className="landlord-panel-header property-list-header">
              <div>
                <span className="landlord-kicker">All Properties</span>
                <h2>Portfolio Records</h2>
              </div>
              <button className="landlord-add-button" onClick={scrollToForm}>Add Property</button>
            </div>

            {loading ? <p className="landlord-muted">Loading properties…</p> : properties.length === 0 ? (
              <div className="landlord-empty property-empty">No properties added yet. Create your first property to start tracking units and tenants.</div>
            ) : (
              <div className="table-shell">
                <table className="landlord-table property-table">
                  <thead>
                    <tr>
                      <th>Property</th>
                      <th>Address</th>
                      <th>Units</th>
                      <th>Tenants</th>
                      <th>Occupancy</th>
                      <th>Rent Roll</th>
                      <th>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {properties.map((property) => {
                      const unitCount = Number(property.unit_count ?? 0);
                      const occupiedCount = Number(property.occupied_units ?? 0);
                      const occupancy = unitCount > 0 ? Math.round((occupiedCount / unitCount) * 100) : 0;
                      return (
                        <tr key={property.id}>
                          <td className="landlord-name">
                            {property.name}
                            <small>{property.size || 'No size recorded'}</small>
                          </td>
                          <td>{property.address}</td>
                          <td>{unitCount}</td>
                          <td>{property.tenant_count ?? 0}</td>
                          <td>
                            <div className="property-meter" aria-label={`${occupancy}% occupied`}>
                              <span style={{ width: `${occupancy}%` }}></span>
                            </div>
                            <span className={`renewal-pill ${unitCount === occupiedCount ? 'status-active' : 'status-pending'}`}>{occupancy}%</span>
                          </td>
                          <td className="landlord-name">KSH {Number(property.rent_roll ?? 0).toLocaleString()}</td>
                          <td>
                            <div className="landlord-actions">
                              <button className="action-button" onClick={() => setSelectedProperty(property)}>View</button>
                              <button className="action-button primary" onClick={() => handleEdit(property)}>Edit</button>
                              <button className="action-button danger" onClick={() => handleRemove(property.id)}>Remove</button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>

        <div className="card property-list-card" style={{ marginTop: 24 }}>
          <div className="landlord-panel-header property-list-header">
            <div>
              <span className="landlord-kicker">All Units</span>
              <h2>Unit Records</h2>
            </div>
          </div>

          {units.length === 0 ? (
            <p className="landlord-muted">No units added. Add units above after creating properties.</p>
          ) : (
            <div className="table-shell">
              <table className="landlord-table">
<thead>
                    <tr>
                      <th>Unit</th>
                      <th>Property</th>
                      <th>Rent</th>
                      <th>Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {units.map((unit) => {
                      const property = properties.find(p => p.id === unit.property_id);
                      return (
                        <tr key={unit.id}>
                          <td className="landlord-name">{unit.unit_number}</td>
                          <td>{property?.name ?? '—'}</td>
                          <td>KSH {Number(unit.rent_amount ?? 0).toLocaleString()}</td>
<td>
                            <span className={`status-pill ${unit.occupancy_status === 'occupied' ? 'status-active' : 'status-pending'}`}>
                              {unit.occupancy_status}
                            </span>
                          </td>
                        </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </section>
    </main>
  );
}