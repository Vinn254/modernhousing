'use client';

import { useEffect, useState } from 'react';
import { supabase } from '../../../lib/supabaseClient';

interface Payment {
  id: string;
  invoice_type: string;
  description: string;
  amount: number;
  status: string;
  created_at: string;
  tenants?: { full_name: string };
}

interface Unit {
  id: string;
  unit_number: string;
  current_water_reading?: number;
  previous_water_reading?: number;
  tenant?: { id: string; full_name: string };
}

const utilityTypes = ['water', 'garbage', 'service_charge', 'parking', 'security', 'internet', 'laundry', 'pet_fees', 'other'];

export default function AgentUtilitiesPage() {
  const [tenants, setTenants] = useState<any[]>([]);
  const [payments, setPayments] = useState<Payment[]>([]);
  const [units, setUnits] = useState<Unit[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [utilityTenantId, setUtilityTenantId] = useState('');
  const [utilityType, setUtilityType] = useState('garbage');
  const [utilityAmount, setUtilityAmount] = useState('');
  const [utilityDescription, setUtilityDescription] = useState('');
  const [agentPropertyId, setAgentPropertyId] = useState('');
  const [waterMeterReadings, setWaterMeterReadings] = useState<{[unitId: string]: string}>({});
  const [waterMonthDue, setWaterMonthDue] = useState('');

const formatCurrency = (value: number) => new Intl.NumberFormat('en-KE', { style: 'currency', currency: 'KES' }).format(value);

  function calculateWaterBill(consumption: number): number {
    if (consumption <= 0) return 0;
    if (consumption <= 6) return consumption * 88;
    if (consumption <= 20) return consumption * 132;
    if (consumption <= 50) return consumption * 137;
    if (consumption <= 100) return consumption * 148;
    if (consumption <= 300) return consumption * 165;
    return consumption * 165;
  }

  async function loadData() {
    setLoading(true);
    setError('');
    try {
      const storedPropertyId = localStorage.getItem('agentPropertyId') || '';
      setAgentPropertyId(storedPropertyId);
      const [tenantsResponse, invoicesResponse, unitsResponse] = await Promise.all([
        fetch(`/api/tenants?propertyId=${storedPropertyId}`),
        fetch(`/api/invoices?propertyId=${storedPropertyId}`),
        fetch(`/api/units?propertyId=${storedPropertyId}`),
      ]);
      const tenantsResult = await tenantsResponse.json();
      const invoicesResult = await invoicesResponse.json();
      const unitsResult = await unitsResponse.json();
      if (tenantsResponse.ok) setTenants(tenantsResult.tenants ?? []);
      if (invoicesResponse.ok) setPayments((invoicesResult.invoices ?? []).filter((i: any) =>
        utilityTypes.includes(i.invoice_type)
      ));
      if (unitsResponse.ok) setUnits(unitsResult.units ?? []);
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

    // Create invoice instead of payment so tenant sees it in Utility Bills
    const response = await fetch('/api/invoices', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        tenantId: utilityTenantId,
        propertyId: agentPropertyId,
        invoiceType: utilityType,
        description: utilityDescription || `${utilityType} invoice`,
        amount: Number(utilityAmount),
        dueDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10),
      }),
    });

    const result = await response.json();

    if (!response.ok) {
      setError(result.message ?? 'Unable to record utility bill.');
      return;
    }

    setMessage('Utility bill recorded.');
    setUtilityTenantId(''); setUtilityType('garbage'); setUtilityAmount(''); setUtilityDescription('');
    loadData();
  }

  async function handleWaterMeterReading(unitId: string) {
    const reading = waterMeterReadings[unitId];
    if (!reading) return;

    const unit = units.find(u => u.id === unitId);
    const previousReading = unit?.previous_water_reading ?? 0;
    const consumption = Number(reading) - previousReading;
    const amount = calculateWaterBill(consumption);
    const waterRate = consumption <= 6 ? 88 : consumption <= 20 ? 132 : consumption <= 50 ? 137 : consumption <= 100 ? 148 : consumption <= 300 ? 165 : 165;

    const response = await fetch('/api/water', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ unitId, currentReading: Number(reading), monthDue: waterMonthDue, propertyId: agentPropertyId, calculatedAmount: amount }),
    });

    const result = await response.json();
    if (response.ok) {
      setMessage(`Water bill: ${consumption} units × ${waterRate} = ${amount.toLocaleString()} KES`);
      setWaterMeterReadings((prev) => ({ ...prev, [unitId]: '' }));
      loadData();
    } else {
      setError(result.message ?? 'Failed to record meter reading.');
    }
  }

  return (
    <main className="container admin-no-hero">
      <div className="card-admin-header">
        <div><p className="heading">Utility Payments</p><p className="subheading">Water meter readings and utility billing management.</p></div>
      </div>

      <section className="bento-section">
        <div className="bento">
          <article className="card">
            <div className="card-label">Water Meter Billing</div>
            <h3>Record Water Reading</h3>
            <p style={{ fontSize: '13px', color: 'var(--ink-3)', marginBottom: 12 }}>Water rates: 1-6 units = 88 KSH, 7-20 units = 132 KSH, 21-50 units = 137 KSH, 51-100 units = 148 KSH, 101-300 units = 165 KSH.</p>
            <input type="month" value={waterMonthDue} onChange={(event) => setWaterMonthDue(event.target.value)} placeholder="Billing month" style={{ marginBottom: 12 }} />
            {units.length === 0 ? (
              <p style={{ color: 'var(--ink-3)', fontSize: '13px' }}>No units available.</p>
            ) : (
              <div style={{ maxHeight: '240px', overflow: 'auto', marginBottom: 12, border: '1px solid var(--line)', borderRadius: '8px', padding: '8px' }}>
                {units.map((unit) => (
                  <div key={unit.id} style={{ display: 'flex', gap: 8, alignItems: 'center', padding: '8px 0', borderBottom: '1px solid var(--line-soft)' }}>
                    <span style={{ width: 100, fontSize: '13px' }}>Unit {unit.unit_number}</span>
                    <span style={{ width: 80, fontSize: '12px', color: 'var(--ink-3)' }}>{unit.previous_water_reading ?? 0} →</span>
                    <input type="number" value={waterMeterReadings[unit.id] || ''} onChange={(e) => setWaterMeterReadings((prev) => ({ ...prev, [unit.id]: e.target.value }))} placeholder="Current" style={{ flex: 1, padding: '6px' }} />
                    <span style={{ width: 100, fontSize: '12px', color: 'var(--ink-3)', textAlign: 'right' }}>
                      {waterMeterReadings[unit.id] ? `${calculateWaterBill(Number(waterMeterReadings[unit.id]) - (unit.previous_water_reading ?? 0)).toLocaleString()} KSH` : '\u00A0'}
                    </span>
                    <button type="button" onClick={() => handleWaterMeterReading(unit.id)} disabled={!waterMeterReadings[unit.id]} style={{ padding: '6px 12px', fontSize: '12px' }}>Bill</button>
                  </div>
                ))}
              </div>
            )}
            {message && <p className="landlord-success" style={{ marginTop: 16 }}>{message}</p>}
            {error && <p className="landlord-error" style={{ marginTop: 16 }}>{error}</p>}
          </article>

          <article className="card">
            <div className="card-label">Record Other Utilities</div>
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
              <button type="submit">Record Utility Bill</button>
            </form>
            <p style={{ fontSize: '11px', color: 'var(--ink-3)', marginTop: 8 }}>Creates invoice - tenants see this in Utility Bills tab</p>
            {message && <p className="landlord-success" style={{ marginTop: 16 }}>{message}</p>}
            {error && <p className="landlord-error" style={{ marginTop: 16 }}>{error}</p>}
          </article>

          <article className="card" style={{ gridColumn: 'span 2' }}>
            <div className="card-label">Other Utility Bills</div>
            <h3 style={{ marginBottom: 16 }}>Bill History</h3>
            {loading && <p className="landlord-muted">Loading utilities...</p>}
            {!loading && payments.filter(p => utilityTypes.includes(p.invoice_type)).length === 0 && <p className="landlord-empty">No utility bills recorded yet.</p>}
            {!loading && payments.filter(p => utilityTypes.includes(p.invoice_type)).length > 0 && (
              <div className="table-shell">
                <table className="landlord-table">
                  <thead><tr><th>Tenant</th><th>Utility</th><th>Amount</th><th>Status</th><th>Date</th></tr></thead>
                  <tbody>
                    {payments.filter(p => utilityTypes.includes(p.invoice_type)).map(payment => (
                      <tr key={payment.id}><td className="landlord-name">{payment.tenants?.full_name ?? '—'}</td><td>{payment.invoice_type}</td><td>{formatCurrency(payment.amount)}</td><td>{payment.status}</td><td>{payment.created_at ? new Date(payment.created_at).toLocaleDateString() : ''}</td></tr>
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
