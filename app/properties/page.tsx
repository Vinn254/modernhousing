'use client';

import { useEffect, useRef, useState } from 'react';
import { supabase } from '../../lib/supabaseClient';

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
  const [form, setForm] = useState(emptyForm);
  const [editingProperty, setEditingProperty] = useState<Property | null>(null);
  const [selectedProperty, setSelectedProperty] = useState<Property | null>(null);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [userOrgId, setUserOrgId] = useState<string | null>(null);
  const [orgReady, setOrgReady] = useState(false);

  useEffect(() => {
    async function fetchUserOrg() {
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) {
          setOrgReady(true);
          return;
        }
        const { data: profile } = await supabase.from('profiles').select('organization_id, role').eq('user_id', user.id).single();
        setUserOrgId(profile?.organization_id ?? null);
        
        // If no org, create one
        if (!profile?.organization_id) {
          setError('Setting up your workspace...');
          const orgName = user.email?.split('@')[0] ?? 'Property Manager';
          
          // First create organization
          const { data: newOrg, error: orgError } = await supabase.from('organizations').insert({ name: `${orgName} Organization` }).select('id').single();
          if (orgError) {
            setError(`Failed to create workspace: ${orgError.message}`);
            setOrgReady(true);
            return;
          }
          
          // Then update or create profile
          if (profile) {
            await supabase.from('profiles').update({ organization_id: newOrg.id }).eq('user_id', user.id);
          } else {
            await supabase.from('profiles').insert({
              user_id: user.id,
              full_name: user.user_metadata?.full_name ?? user.email,
              email: user.email,
              role: 'project_manager',
              organization_id: newOrg.id,
              status: 'active',
            });
          }
          setUserOrgId(newOrg.id);
          setError('');
        }
        setOrgReady(true);
      } catch (err: any) {
        setError(err.message ?? 'Failed to setup workspace');
        setOrgReady(true);
      }
    }
    fetchUserOrg();
  }, []);

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

  useEffect(() => {
    if (orgReady) loadProperties();
  }, [orgReady]);

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
      </section>
    </main>
  );
}
