'use client';

import { useState } from 'react';

export default function PropertiesPage() {
  const [name, setName] = useState('');
  const [address, setAddress] = useState('');
  const [size, setSize] = useState('');
  const [amenities, setAmenities] = useState('');
  const [ownershipInfo, setOwnershipInfo] = useState('');
  const [message, setMessage] = useState('');

  async function handleCreate(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setMessage('');

    const response = await fetch('/api/properties', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, address, size, amenities, ownershipInfo }),
    });

    if (response.ok) {
      setMessage('Property created successfully.');
      setName('');
      setAddress('');
      setSize('');
      setAmenities('');
      setOwnershipInfo('');
    } else {
      const result = await response.json();
      setMessage(result.message || 'Unable to create property.');
    }
  }

  return (
    <main className="container">
      <div className="card" style={{ marginBottom: 24 }}>
        <header className="header">
          <div>
            <p className="heading">Properties</p>
            <p className="subheading">Add and manage properties in your portfolio</p>
          </div>
        </header>
      </div>

      <div className="card" style={{ maxWidth: '700px' }}>
        <form onSubmit={handleCreate} className="grid" style={{ gap: 16 }}>
          <div className="grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '16px' }}>
            <label style={{ gridColumn: 'span 2' }}>
              Property name
              <input value={name} onChange={(event) => setName(event.target.value)} required placeholder="Sunset Apartments" />
            </label>
            <label>
              Address
              <input value={address} onChange={(event) => setAddress(event.target.value)} required placeholder="123 Main Street, City" />
            </label>
            <label>
              Size
              <input value={size} onChange={(event) => setSize(event.target.value)} placeholder="e.g. 5 buildings, 120 units" />
            </label>
            <label style={{ gridColumn: 'span 2' }}>
              Amenities
              <input value={amenities} onChange={(event) => setAmenities(event.target.value)} placeholder="e.g. parking, gym, pool" />
            </label>
            <label style={{ gridColumn: 'span 2' }}>
              Ownership info
              <input value={ownershipInfo} onChange={(event) => setOwnershipInfo(event.target.value)} placeholder="Ownership or management details" />
            </label>
          </div>

          {message ? <p style={{ color: 'var(--accent)', fontWeight: 500 }}>{message}</p> : null}

          <button type="submit">Create Property</button>
        </form>
      </div>
    </main>
  );
}