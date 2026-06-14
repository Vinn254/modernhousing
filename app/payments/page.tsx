'use client';

import { useState } from 'react';

export default function PaymentsPage() {
  const [tenantId, setTenantId] = useState('');
  const [description, setDescription] = useState('');
  const [transactionType, setTransactionType] = useState('rent');
  const [amount, setAmount] = useState('');
  const [balanceRemaining, setBalanceRemaining] = useState('');
  const [message, setMessage] = useState('');

  async function handleCreate(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setMessage('');

    const response = await fetch('/api/payments', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        tenantId,
        description,
        transactionType,
        amount: Number(amount),
        balanceRemaining: Number(balanceRemaining),
      }),
    });

    if (response.ok) {
      setMessage('Payment recorded successfully.');
      setTenantId('');
      setDescription('');
      setTransactionType('rent');
      setAmount('');
      setBalanceRemaining('');
    } else {
      const result = await response.json();
      setMessage(result.message || 'Unable to record payment.');
    }
  }

  return (
    <main className="container">
      <div className="card" style={{ marginBottom: 24 }}>
        <header className="header">
          <div>
            <p className="heading">Payments</p>
            <p className="subheading">Register payments and track tenant balances</p>
          </div>
        </header>
      </div>

      <div className="card" style={{ maxWidth: '700px' }}>
        <form onSubmit={handleCreate} className="grid" style={{ gap: 16 }}>
          <div className="grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '16px' }}>
            <label>
              Tenant ID
              <input value={tenantId} onChange={(event) => setTenantId(event.target.value)} required placeholder="Tenant ID" />
            </label>
            <label>
              Description
              <input value={description} onChange={(event) => setDescription(event.target.value)} required placeholder="Rent, overdue settlement" />
            </label>
            <label>
              Transaction type
              <select value={transactionType} onChange={(event) => setTransactionType(event.target.value)}>
                <option value="rent">Rent</option>
                <option value="overdue">Overdue</option>
                <option value="other">Other</option>
              </select>
            </label>
            <label>
              Amount
              <input type="number" step="0.01" value={amount} onChange={(event) => setAmount(event.target.value)} required placeholder="0.00" />
            </label>
            <label>
              Balance remaining
              <input type="number" step="0.01" value={balanceRemaining} onChange={(event) => setBalanceRemaining(event.target.value)} required placeholder="0.00" />
            </label>
          </div>

          {message ? <p style={{ color: 'var(--accent)', fontWeight: 500 }}>{message}</p> : null}

          <button type="submit">Record Payment</button>
        </form>
      </div>
    </main>
  );
}