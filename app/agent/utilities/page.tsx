'use client';

import { useEffect, useState } from 'react';
import { supabase } from '../../../lib/supabaseClient';

interface Payment {
  id: string;
  tenant: string;
  tenant_email: string;
  property: string;
  amount: number;
  balance_remaining: number;
  created_at: string;
  transaction_type: string;
  description: string;
}

const utilityTypes = ['water', 'garbage', 'service_charge', 'parking', 'security', 'other'];

export default function AgentUtilitiesPage() {
  const [tenants, setTenants] = useState<any[]>([]);
  const [payments, setPayments] = useState<Payment[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [utilityTenantId, setUtilityTenantId] = useState('');
  const [utilityType, setUtilityType] = useState('water');
  const [utilityAmount, setUtilityAmount] = useState('');
  const [utilityDescription, setUtilityDescription] = useState('');
  const [agentPropertyId, setAgentPropertyId] = useState('');

  const formatCurrency = (value: number) => new Intl.NumberFormat('en-KE', { style: 'currency', currency: 'KES' }).format(value);

  async function loadData() {
    setLoading(true);
    setError('');
    try {
      const storedPropertyId = localStorage.getItem('agentPropertyId') || '';
      setAgentPropertyId(storedPropertyId);
      const [tenantsResponse, paymentsResponse] = await Promise.all([
        fetch(`/api/tenants?propertyId=${storedPropertyId}`),
        fetch(`/api/payments?propertyId=${storedPropertyId}`),
      ]);
      const tenantsResult = await tenantsResponse.json();
      const paymentsResult = await paymentsResponse.json();
      if (tenantsResponse.ok) setTenants(tenantsResult.tenants ?? []);
      if (paymentsResponse.ok) setPayments(paymentsResult.payments ?? []);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { loadData(); }, []);

  async function handleAddUtility(event: React.FormEvent) {
    event.preventDefault();
    setMessage('');
    setError('');

    const response = await fetch('/api/payments', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        tenantId: utilityTenantId,
        propertyId: agentPropertyId,
        description: utilityDescription || `${utilityType} payment`,
        transactionType: utilityType,
        amount: Number(utilityAmount),
        balanceRemaining: 0,
      }),
    });

    const result = await response.json();

    if (!response.ok) {
      setError(result.message ?? 'Unable to record utility payment.');
      return;
    }

    setMessage('Utility payment recorded.');
    setUtilityTenantId(''); setUtilityType('water'); setUtilityAmount(''); setUtilityDescription('');
    loadData();
  }

  return (
    <main className="container admin-no-hero" style={{ padding: '34px 0 80px' }}>
      <div className="card-admin-header">
        <div><p className="heading">Utility Payments</p><p className="subheading">Manage water, garbage, service charges, parking, and security fees for tenants.</p></div>
      </div>

      <section className="bento-section">
        <div className="bento">
          <article className="card">
            <div className="card-label">Record Utility Payment</div>
            <h3>Utility Billing</h3>
            <form onSubmit={handleAddUtility} className="form-grid">
              <select value={utilityTenantId} onChange={(event) => setUtilityTenantId(event.target.value)} required>
                <option value="">Select tenant</option>
                {tenants.map((tenant) => <option key={tenant.id} value={tenant.id}>{tenant.full_name} — {tenant.property}</option>)}
              </select>
              <select value={utilityType} onChange={(event) => setUtilityType(event.target.value)} required>
                <option value="">Utility type</option>
                {utilityTypes.map((type) => <option key={type} value={type}>{type.replace('_', ' ')}</option>)}
              </select>
              <input type="number" value={utilityAmount} onChange={(event) => setUtilityAmount(event.target.value)} required placeholder="Amount (KSH)" />
              <input value={utilityDescription} onChange={(event) => setUtilityDescription(event.target.value)} placeholder="Description (optional)" />
              <button type="submit">Record Utility Payment</button>
            </form>
            {message && <p className="landlord-success" style={{ marginTop: 16 }}>{message}</p>}
            {error && <p className="landlord-error" style={{ marginTop: 16 }}>{error}</p>}
          </article>

          <article className="card">
            <div className="card-label">Utility Records</div>
            <h3 style={{ marginBottom: 16 }}>Payment History</h3>
            {loading && <p className="landlord-muted">Loading utilities...</p>}
            {!loading && payments.filter(p => utilityTypes.includes(p.transaction_type)).length === 0 && <p className="landlord-empty">No utility payments recorded yet.</p>}
            {!loading && payments.filter(p => utilityTypes.includes(p.transaction_type)).length > 0 && (
              <div className="table-shell">
                <table className="landlord-table">
                  <thead><tr><th>Tenant</th><th>Utility</th><th>Amount</th><th>Date</th></tr></thead>
                  <tbody>
                    {payments.filter(p => utilityTypes.includes(p.transaction_type)).map(payment => (
                      <tr key={payment.id}><td className="landlord-name">{payment.tenant}</td><td>{payment.transaction_type}</td><td>{formatCurrency(payment.amount)}</td><td>{payment.created_at ? new Date(payment.created_at).toLocaleDateString() : ''}</td></tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </article>
        </div>
      </section>
    </main>
  );
}