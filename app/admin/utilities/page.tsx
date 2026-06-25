'use client';

import { useEffect, useState } from 'react';
import { supabase } from '../../../lib/supabaseClient';

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
  tenant: string;
  tenant_email: string;
  property: string;
  amount: number;
  balance_remaining: number;
  created_at: string;
  transaction_type: string;
  description: string;
}

export default function UtilitiesPage() {
  const [properties, setProperties] = useState<Property[]>([]);
  const [tenants, setTenants] = useState<Tenant[]>([]);
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

  const utilityTypes = [
    { value: 'water', label: 'Water Bill' },
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
      const [propsResponse, tenantsResponse, paymentsResponse] = await Promise.all([
        fetch('/api/properties', { headers: await getAuthHeaders() }),
        fetch('/api/tenants', { headers: await getAuthHeaders() }),
        fetch('/api/payments', { headers: await getAuthHeaders() }),
      ]);

      const propsResult = await propsResponse.json();
      const tenantsResult = await tenantsResponse.json();
      const paymentsResult = await paymentsResponse.json();

      setProperties(propsResult.properties ?? []);
      setTenants(tenantsResult.tenants ?? []);
      setUtilityPayments((paymentsResult.payments ?? []).filter((p: any) =>
        ['water', 'garbage', 'service_charge', 'parking', 'security', 'other', 'utility'].includes(p.transaction_type)
      ));
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

    const response = await fetch('/api/payments', {
      method: 'POST',
      headers: await getAuthHeaders(),
      body: JSON.stringify({
        tenantId: utilityForm.tenantId,
        propertyId: tenantPropertyId,
        description: utilityForm.description || `${utilityForm.utilityType} payment`,
        transactionType: utilityForm.utilityType,
        amount: Number(utilityForm.amount),
        balanceRemaining: 0,
      }),
    });

    const result = await response.json();

    if (!response.ok) {
      setError(result.message ?? 'Unable to record utility payment.');
      return;
    }

    setMessage('Utility recorded successfully.');
    setUtilityForm({ tenantId: '', propertyId: '', utilityType: '', amount: '', description: '' });
    await loadData();
  }

  const formatCurrency = (value: number) => new Intl.NumberFormat('en-KE', { style: 'currency', currency: 'KES' }).format(value);

  return (
    <>
      <main className="container admin-no-hero" style={{ padding: '34px 0 80px' }}>
        <div className="card-admin-header">
          <div>
            <p className="heading">Utilities Management</p>
            <p className="subheading">Manage water, garbage, security, parking, and other utility services.</p>
          </div>
        </div>

        <section className="bento-section">
          <div className="bento">
            <article className="card">
              <div className="card-label"><span className="badge badge-pm">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>
              </span>Record Utility Payment</div>
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
                <button type="submit">Record Utility Payment</button>
              </form>
              {message && <p className="landlord-success" style={{ marginTop: 16 }}>{message}</p>}
              {error && <p className="landlord-error" style={{ marginTop: 16 }}>{error}</p>}
            </article>

            <article className="card">
              <div className="card-label"><span className="badge badge-agent">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><rect x="1" y="4" width="22" height="16" rx="2"/><line x1="1" y1="10" x2="23" y2="10"/></svg>
              </span>Utility Records</div>
              <h3 style={{ marginBottom: 16 }}>Payment History</h3>

              {loading && <p className="landlord-muted">Loading utilities...</p>}
              {!loading && utilityPayments.length === 0 && <p className="landlord-empty">No utility payments recorded yet.</p>}

              {!loading && utilityPayments.length > 0 && (
                <div className="table-shell">
                  <table className="landlord-table">
                    <thead>
                      <tr>
                        <th>Tenant</th>
                        <th>Utility</th>
                        <th>Amount</th>
                        <th>Property</th>
                        <th>Date</th>
                      </tr>
                    </thead>
                    <tbody>
                      {utilityPayments.map(payment => (
                        <tr key={payment.id}>
                          <td>{payment.tenant}</td>
                          <td>{payment.transaction_type}</td>
                          <td>{formatCurrency(payment.amount)}</td>
                          <td>{payment.property ?? '—'}</td>
                          <td>{payment.created_at ? new Date(payment.created_at).toLocaleDateString() : ''}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </article>
          </div>
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