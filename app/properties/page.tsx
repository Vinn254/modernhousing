'use client';

import { useEffect, useState } from 'react';

interface Property {
  id: string;
  name: string;
  address: string;
  size?: string;
  amenities?: string;
  ownership_info?: string;
  created_at?: string;
}

export default function PropertiesPage() {
  const [properties, setProperties] = useState<Property[]>([]);
  const [name, setName] = useState('');
  const [address, setAddress] = useState('');
  const [size, setSize] = useState('');
  const [amenities, setAmenities] = useState('');
  const [ownershipInfo, setOwnershipInfo] = useState('');
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);

  async function loadProperties() {
    const response = await fetch('/api/properties');
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
    loadProperties();
  }, []);

  async function handleCreate(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setMessage('');
    setError('');

    const response = await fetch('/api/properties', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, address, size, amenities, ownershipInfo }),
    });

    const result = await response.json();

    if (!response.ok) {
      setError(result.message || 'Unable to create property.');
      return;
    }

    setMessage('Property created successfully.');
    setName('');
    setAddress('');
    setSize('');
    setAmenities('');
    setOwnershipInfo('');
    await loadProperties();
  }

  async function handleRemove(propertyId: string) {
    if (!confirm('Remove this property?')) return;

    const response = await fetch(`/api/properties?id=${encodeURIComponent(propertyId)}`, { method: 'DELETE' });
    const result = await response.json();

    if (!response.ok) {
      setError(result.message || 'Unable to remove property.');
      return;
    }

    setMessage('Property removed.');
    await loadProperties();
  }

  return (
    <main className="container" style={{ padding: '34px 0 80px' }}>
      <div className="card-admin-header">
        <p className="heading">Properties</p>
        <p className="subheading">Add properties, track units, and prepare assignments for agents and tenants.</p>
      </div>

      {message && <p style={{ color: 'var(--accent)', fontWeight: 700, marginBottom: 16 }}>{message}</p>}
      {error && <p style={{ color: '#dc2626', fontWeight: 700, marginBottom: 16 }}>{error}</p>}

      <section style={{ display: 'grid', gridTemplateColumns: 'minmax(280px, 380px) 1fr', gap: 20, alignItems: 'start' }}>
        <div className="card">
          <div className="card-label">Property Setup</div>
          <h3 style={{ marginBottom: 16 }}>Add Property</h3>
          <form onSubmit={handleCreate} className="form-grid">
            <input value={name} onChange={(event) => setName(event.target.value)} required placeholder="Property name" />
            <input value={address} onChange={(event) => setAddress(event.target.value)} required placeholder="Address" />
            <input value={size} onChange={(event) => setSize(event.target.value)} placeholder="Size / units" />
            <input value={amenities} onChange={(event) => setAmenities(event.target.value)} placeholder="Amenities" />
            <input value={ownershipInfo} onChange={(event) => setOwnershipInfo(event.target.value)} placeholder="Ownership info" />
            <button type="submit" style={{ gridColumn: 'span 2' }}>Create Property</button>
          </form>
        </div>

        <div className="card">
          <div className="card-label">Portfolio</div>
          <h3 style={{ marginBottom: 16 }}>All Properties</h3>
          {loading ? <p style={{ color: 'var(--ink-3)' }}>Loading properties…</p> : properties.length === 0 ? (
            <p style={{ color: 'var(--ink-3)' }}>No properties added yet.</p>
          ) : (
            <div style={{ display: 'grid', gap: 14 }}>
              {properties.map((property) => (
                <div key={property.id} style={{ display: 'grid', gridTemplateColumns: '1fr auto', gap: 12, alignItems: 'center', padding: '14px 0', borderBottom: '1px solid var(--line-soft)' }}>
                  <div>
                    <strong>{property.name}</strong>
                    <div style={{ color: 'var(--ink-3)', fontSize: '13px' }}>{property.address}</div>
                    {property.size && <div style={{ color: 'var(--ink-3)', fontSize: '13px' }}>{property.size}</div>}
                  </div>
                  <button className="btn btn-ghost" style={{ fontSize: '12px', padding: '6px 12px', background: 'rgba(220,38,38,0.1)', color: '#7f1212' }} onClick={() => handleRemove(property.id)}>Remove</button>
                </div>
              ))}
            </div>
          )}
        </div>
      </section>
    </main>
  );
}
