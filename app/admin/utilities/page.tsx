'use client';

import { useEffect, useState } from 'react';
import { supabase } from '../../../lib/supabaseClient';
import DonutChart from '../../components/DonutChart';

interface Property {
  id: string;
  name: string;
  address: string;
  unit_count?: number;
}

interface Tenant {
  id: string;
  full_name: string;
  email: string;
  unit: string;
  property: string;
  property_id?: string;
}

interface UtilityPayment {
  id: string;
  invoice_type: string;
  description: string;
  amount: number;
  status: string;
  created_at: string;
  due_date?: string;
  tenants?: { full_name: string };
}

interface Unit {
  id: string;
  unit_number: string;
  current_water_reading?: number;
  previous_water_reading?: number;
  property_id: string;
  tenant?: { id: string; full_name: string };
}

export default function UtilitiesPage() {
  const [properties, setProperties] = useState<Property[]>([]);
  const [tenants, setTenants] = useState<Tenant[]>([]);
  const [units, setUnits] = useState<Unit[]>([]);
  const [utilityPayments, setUtilityPayments] = useState<UtilityPayment[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [utilityForm, setUtilityForm] = useState({
    tenantId: '',
    propertyId: '',
    utilityType: '',
    amount: '',
    description: '',
  });
  const [waterMeterReadings, setWaterMeterReadings] = useState<{[unitId: string]: string}>({});
  const [waterMonthDue, setWaterMonthDue] = useState('');
  const [waterForm, setWaterForm] = useState({
    tenantId: '',
    amount: '',
    description: '',
  });

  const utilityTypes = [
    { value: 'garbage', label: 'Garbage Collection' },
    { value: 'service_charge', label: 'Service Charge' },
    { value: 'parking', label: 'Parking Fee' },
    { value: 'security', label: 'Security Fee' },
    { value: 'other', label: 'Other' },
  ];

  async function getAuthHeaders() {
    const { data } = await supabase.auth.getSession();
    const headers: Record<string, string> = { 'Content-Type': 'application/json' };
    if (data.session?.access_token) headers.Authorization = `Bearer ${data.session.access_token}`;
    return headers;
  }

  async function loadData() {
    setLoading(true);
    setError('');

    try {
      const [propsResponse, tenantsResponse, invoicesResponse, unitsResponse] = await Promise.all([
        fetch('/api/properties', { headers: await getAuthHeaders() }),
        fetch('/api/tenants', { headers: await getAuthHeaders() }),
        fetch('/api/invoices', { headers: await getAuthHeaders() }),
        fetch('/api/units', { headers: await getAuthHeaders() }),
      ]);

      const propsResult = await propsResponse.json();
      const tenantsResult = await tenantsResponse.json();
      const invoicesResult = await invoicesResponse.json();
      const unitsResult = await unitsResponse.json();

      setProperties(propsResult.properties ?? []);
      setTenants(tenantsResult.tenants ?? []);
      setUtilityPayments((invoicesResult.invoices ?? []).filter((i: any) =>
        ['garbage', 'service_charge', 'parking', 'security', 'other', 'utility', 'water'].includes(i.invoice_type)
      ));
      setUnits(unitsResult.units ?? []);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadData();
  }, []);

  async function handleAddUtility(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setMessage('');
    setError('');

    if (!utilityForm.tenantId || !utilityForm.utilityType || !utilityForm.amount) {
      setError('All fields are required.');
      return;
    }

    const selectedTenant = tenants.find(t => t.id === utilityForm.tenantId);
    const tenantPropertyId = selectedTenant?.property_id || utilityForm.propertyId;

    // Create invoice instead of payment so tenant sees it in Utility Bills
    const response = await fetch('/api/invoices', {
      method: 'POST',
      headers: await getAuthHeaders(),
      body: JSON.stringify({
        tenantId: utilityForm.tenantId,
        propertyId: tenantPropertyId,
        invoiceType: utilityForm.utilityType,
        description: utilityForm.description || `${utilityForm.utilityType} invoice`,
        amount: Number(utilityForm.amount),
        dueDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10),
      }),
    });

    const result = await response.json();

    if (!response.ok) {
      setError(result.message ?? 'Unable to record utility bill.');
      return;
    }

    setMessage('Utility bill recorded.');
    setUtilityForm({ tenantId: '', propertyId: '', utilityType: '', amount: '', description: '' });
    loadData();
  }

  async function handleAddWaterBill(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setMessage('');
    setError('');

    if (!waterForm.tenantId || !waterForm.amount) {
      setError('All fields are required.');
      return;
    }

    const selectedTenant = tenants.find(t => t.id === waterForm.tenantId);
    const tenantPropertyId = selectedTenant?.property_id || '';

    const response = await fetch('/api/invoices', {
      method: 'POST',
      headers: await getAuthHeaders(),
      body: JSON.stringify({
        tenantId: waterForm.tenantId,
        propertyId: tenantPropertyId,
        invoiceType: 'water',
        description: waterForm.description || 'Water bill',
        amount: Number(waterForm.amount),
        dueDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10),
      }),
    });

    const result = await response.json();

    if (!response.ok) {
      setError(result.message ?? 'Unable to record water bill.');
      return;
    }

    setMessage('Water bill recorded.');
    setWaterForm({ tenantId: '', amount: '', description: '' });
    loadData();
  }

  async function handleWaterMeterReading(unitId: string) {
    const reading = waterMeterReadings[unitId];
    if (!reading) return;

    const propertyId = units.find(u => u.id === unitId)?.property_id;
    const response = await fetch('/api/water', {
      method: 'POST',
      headers: await getAuthHeaders(),
      body: JSON.stringify({ unitId, currentReading: Number(reading), monthDue: waterMonthDue, propertyId }),
    });

    const result = await response.json();
    if (response.ok) {
      setMessage(`Water bill: ${result.consumption} units × ${result.waterRate} = ${result.amount.toLocaleString()} KES`);
      setWaterMeterReadings((prev) => ({ ...prev, [unitId]: '' }));
      loadData();
    } else {
      setError(result.message ?? 'Failed to record meter reading.');
    }
  }

  const formatCurrency = (value: number) => new Intl.NumberFormat('en-KE', { style: 'currency', currency: 'KES' }).format(value);

  return (
    <>
      <main className="container admin-no-hero" style={{ padding: '34px 0 80px' }}>
        <div className="card-admin-header">
          <div>
            <p className="heading">Utilities Management</p>
            <p className="subheading">Water meter readings and utility billing management.</p>
          </div>
        </div>

<section className="card-grid">
          <article className="card" style={{ textAlign: 'center' }}>
            <div className="card-label"><span className="badge badge-pm">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><rect x="1" y="4" width="22" height="16" rx="2"/><line x1="1" y1="10" x2="23" y2="10"/></svg>
            </span>Utility Summary</div>
            <DonutChart
              data={[
                { label: 'Water', value: utilityPayments.filter((p: any) => p.invoice_type === 'water').length, color: '#0ea5e9' },
                { label: 'Garbage', value: utilityPayments.filter((p: any) => p.invoice_type === 'garbage').length, color: '#10b981' },
                { label: 'Service', value: utilityPayments.filter((p: any) => p.invoice_type === 'service_charge').length, color: '#8b5cf6' },
                { label: 'Parking', value: utilityPayments.filter((p: any) => p.invoice_type === 'parking').length, color: '#f59e0b' },
              ]}
            />
            <p style={{ color: 'var(--ink-3)', marginTop: 8, fontSize: '13px' }}>Total utility invoices</p>
          </article>

          <article className="card">
            <div className="card-label"><span className="badge badge-pm">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>
            </span>Record Other Utilities</div>
            <h3>Utility Billing</h3>
            <form onSubmit={handleAddUtility} className="form-grid">
              <select value={utilityForm.tenantId} onChange={e => setUtilityForm(f => ({ ...f, tenantId: e.target.value }))} required>
                <option value="">Select tenant</option>
                {tenants.map(t => <option key={t.id} value={t.id}>{t.full_name} - {t.property}</option>)}
              </select>
              <select value={utilityForm.utilityType} onChange={e => setUtilityForm(f => ({ ...f, utilityType: e.target.value }))} required>
                <option value="">Utility type</option>
                {utilityTypes.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
              </select>
              <input value={utilityForm.amount} onChange={e => setUtilityForm(f => ({ ...f, amount: e.target.value }))} type="number" required placeholder="Amount (KSH)" />
              <input value={utilityForm.description} onChange={e => setUtilityForm(f => ({ ...f, description: e.target.value }))} placeholder="Description (optional)" />
              <button type="submit">Record Utility Bill</button>
            </form>
            <p style={{ fontSize: '11px', color: 'var(--ink-3)', marginTop: 8 }}>Creates invoice - tenants see this in Utility Bills tab</p>
          </article>

          <article className="card">
            <div className="card-label"><span className="badge badge-agent">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>
            </span>Add Water Bill</div>
            <h3>Simple Water Billing</h3>
            <form onSubmit={handleAddWaterBill} className="form-grid">
              <select value={waterForm.tenantId} onChange={e => setWaterForm(f => ({ ...f, tenantId: e.target.value }))} required>
                <option value="">Select tenant</option>
                {tenants.map(t => <option key={t.id} value={t.id}>{t.full_name} - {t.property}</option>)}
              </select>
              <input value={waterForm.amount} onChange={e => setWaterForm(f => ({ ...f, amount: e.target.value }))} type="number" required placeholder="Amount (KSH)" />
              <input value={waterForm.description} onChange={e => setWaterForm(f => ({ ...f, description: e.target.value }))} placeholder="Description (optional)" />
              <button type="submit">Record Water Bill</button>
            </form>
          </article>

          <article className="card">
            <div className="card-label"><span className="badge badge-agent">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><rect x="1" y="4" width="22" height="16" rx="2"/><line x1="1" y1="10" x2="23" y2="10"/></svg>
            </span>Water Meter Billing</div>
            <h3 style={{ marginBottom: 16 }}>Record Water Reading</h3>
            <p style={{ fontSize: '13px', color: 'var(--ink-3)', marginBottom: 12 }}>Water is billed at KES 150/unit. Consumption = Current - Previous.</p>
            <input type="month" value={waterMonthDue} onChange={(event) => setWaterMonthDue(event.target.value)} placeholder="Billing month" style={{ marginBottom: 12 }} />
            {units.length === 0 ? (
              <p style={{ color: 'var(--ink-3)', fontSize: '13px' }}>No units available.</p>
            ) : (
              <div style={{ maxHeight: '240px', overflow: 'auto', marginBottom: 12, border: '1px solid var(--line)', borderRadius: '8px', padding: '8px' }}>
                {units.map((unit) => (
                  <div key={unit.id} style={{ display: 'flex', gap: 8, alignItems: 'center', padding: '8px 0', borderBottom: '1px solid var(--line-soft)' }}>
                    <span style={{ width: 120, fontSize: '13px' }}>{properties.find(p => p.id === unit.property_id)?.name ?? '—'} — Unit {unit.unit_number}</span>
                    <span style={{ width: 80, fontSize: '12px', color: 'var(--ink-3)' }}>{unit.previous_water_reading ?? 0} →</span>
                    <input type="number" value={waterMeterReadings[unit.id] || ''} onChange={(e) => setWaterMeterReadings((prev) => ({ ...prev, [unit.id]: e.target.value }))} placeholder="Current" style={{ flex: 1, padding: '6px' }} />
                    <button type="button" onClick={() => handleWaterMeterReading(unit.id)} disabled={!waterMeterReadings[unit.id]} style={{ padding: '6px 12px', fontSize: '12px' }}>Bill</button>
                  </div>
                ))}
              </div>
            )}
            {message && <p className="landlord-success" style={{ marginTop: 16 }}>{message}</p>}
            {error && <p className="landlord-error" style={{ marginTop: 16 }}>{error}</p>}
          </article>
        </section>

        <section className="card-grid-item" style={{ marginTop: 24 }}>
          <article className="card">
            <div className="card-label"><span className="badge badge-agent">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><rect x="1" y="4" width="22" height="16" rx="2"/><line x1="1" y1="10" x2="23" y2="10"/></svg>
            </span>Other Utility Bills</div>
            <h3 style={{ marginBottom: 16 }}>Bill History</h3>

            {loading && <p className="landlord-muted">Loading utilities...</p>}
            {!loading && utilityPayments.length === 0 && <p className="landlord-empty">No utility bills recorded yet.</p>}

            {!loading && utilityPayments.length > 0 && (
              <div className="table-shell">
                <table className="landlord-table">
                  <thead>
                    <tr>
                      <th>Tenant</th>
                      <th>Utility</th>
                      <th>Amount</th>
                      <th>Status</th>
                      <th>Date</th>
                    </tr>
                  </thead>
                  <tbody>
                    {utilityPayments.map(payment => (
                      <tr key={payment.id}>
                        <td>{payment.tenants?.full_name ?? '—'}</td>
                        <td>{payment.invoice_type}</td>
                        <td>{formatCurrency(payment.amount)}</td>
                        <td>{payment.status}</td>
                        <td>{payment.created_at ? new Date(payment.created_at).toLocaleDateString() : ''}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </article>
        </section>
      </main>

      <footer>
        <div className="footer-inner">
          <div className="footer-brand"><span className="logo-mark" style={{ width: 26, height: 26, borderRadius: 7 }}><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M3 21h18"/><path d="M5 21V7l8-4v18"/><path d="M19 21V11l-6-4"/></svg></span>Springfield Systems</div>
          <div className="footer-links"><a href="/">Home</a><a href="/admin">Dashboard</a></div>
          <div className="footer-copy">© 2026 Springfield Systems. All rights reserved.</div>
        </div>
      </footer>
    </>
  );
}