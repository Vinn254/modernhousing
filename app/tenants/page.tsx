'use client';

import { useState } from 'react';

export default function TenantsPage() {
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [unitId, setUnitId] = useState('');
  const [leaseStart, setLeaseStart] = useState('');
  const [leaseEnd, setLeaseEnd] = useState('');
  const [depositAmount, setDepositAmount] = useState('');
  const [message, setMessage] = useState('');

  async function handleCreate(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setMessage('');

    const response = await fetch('/api/tenants', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ fullName, email, phone, unitId, leaseStart, leaseEnd, depositAmount: Number(depositAmount) }),
    });

    if (response.ok) {
      setMessage('Tenant created successfully.');
      setFullName('');
      setEmail('');
      setPhone('');
      setUnitId('');
      setLeaseStart('');
      setLeaseEnd('');
      setDepositAmount('');
    } else {
      const result = await response.json();
      setMessage(result.message || 'Unable to create tenant.');
    }
  }

  return (
    <main className="container">
      <div className="card" style={{ marginBottom: 24 }}>
        <header className="header">
          <div>
            <p className="heading">Tenants</p>
            <p className="subheading">Add tenants and manage lease details</p>
          </div>
        </header>
      </div>

      <div className="card" style={{ maxWidth: '700px' }}>
        <form onSubmit={handleCreate} className="grid" style={{ gap: 16 }}>
          <div className="grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '16px' }}>
            <label style={{ gridColumn: 'span 2' }}>
              Tenant full name
              <input value={fullName} onChange={(event) => setFullName(event.target.value)} required placeholder="John Doe" />
            </label>
            <label>
              Email address
              <input type="email" value={email} onChange={(event) => setEmail(event.target.value)} required placeholder="tenant@example.com" />
            </label>
            <label>
              Phone number
              <input value={phone} onChange={(event) => setPhone(event.target.value)} placeholder="+1 (555) 123-4567" />
            </label>
            <label>
              Unit ID
              <input value={unitId} onChange={(event) => setUnitId(event.target.value)} required placeholder="A-101" />
            </label>
            <label>
              Lease start
              <input type="date" value={leaseStart} onChange={(event) => setLeaseStart(event.target.value)} required />
            </label>
            <label>
              Lease end
              <input type="date" value={leaseEnd} onChange={(event) => setLeaseEnd(event.target.value)} required />
            </label>
            <label style={{ gridColumn: 'span 2' }}>
              Security deposit amount
              <input type="number" value={depositAmount} onChange={(event) => setDepositAmount(event.target.value)} placeholder="0" />
            </label>
          </div>

          {message ? <p style={{ color: 'var(--accent)', fontWeight: 500 }}>{message}</p> : null}

          <button type="submit">Create Tenant</button>
        </form>
      </div>
    </main>
  );
}