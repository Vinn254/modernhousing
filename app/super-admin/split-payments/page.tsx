'use client';

import { useEffect, useState } from 'react';
import { supabase } from '../../../lib/supabaseClient';

interface SplitPayment {
  id: string;
  tenant_id: string | null;
  landlord_id: string;
  original_amount: number;
  platform_fee_amount: number;
  landlord_amount: number;
  currency: string;
  transaction_code: string | null;
  pesaflow_transaction_id: string | null;
  payment_method: string;
  status: string;
  metadata: Record<string, any>;
  created_at: string;
  updated_at: string;
  landlord?: {
    full_name: string;
    email: string;
    organization_name: string;
  } | null;
  tenant?: {
    full_name: string;
    email: string;
  } | null;
}

export default function AdminSplitPaymentsPage() {
  const [splits, setSplits] = useState<SplitPayment[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [landlordFilter, setLandlordFilter] = useState('');

  useEffect(() => {
    async function loadSplits() {
      setLoading(true);
      const { data: { session } } = await supabase.auth.getSession();
      const token = session?.access_token;
      if (!token) {
        setLoading(false);
        return;
      }

      const params = new URLSearchParams();
      if (search) params.set('search', search);
      if (statusFilter) params.set('status', statusFilter);
      if (landlordFilter) params.set('landlordId', landlordFilter);

      const res = await fetch(`/api/split-payments?${params.toString()}`, {
        headers: { Authorization: `Bearer ${token}` },
        cache: 'no-store',
      });

      const result = await res.json().catch(() => ({ splits: [] }));
      if (res.ok) {
        setSplits(result.splits ?? []);
      }
      setLoading(false);
    }

    loadSplits();
  }, [search, statusFilter, landlordFilter]);

  const formatCurrency = (value: number) => new Intl.NumberFormat('en-KE', { style: 'currency', currency: 'KES' }).format(value);
  const formatDate = (date: string) => new Date(date).toLocaleString();

  return (
    <main className="container admin-no-hero auth-bg">
      <div className="card-admin-header">
        <div>
          <p className="heading">Platform Fee Payments</p>
          <p className="subheading">View all 1% platform fee deductions across all landlords. Track transactions, tenants, and timing.</p>
        </div>
      </div>

      <section className="card-grid" style={{ marginBottom: 24 }}>
        <div className="card">
          <div className="card-label">Filters</div>
          <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', marginTop: 12 }}>
            <input
              type="text"
              placeholder="Search transaction code or PesaFlow ID..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              style={{ padding: '10px 14px', borderRadius: 10, border: '1px solid var(--line)', background: 'var(--surface)', color: 'var(--ink)', fontSize: 14, minWidth: 220, flex: 1 }}
            />
            <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} style={{ padding: '10px 14px', borderRadius: 10, border: '1px solid var(--line)', background: 'var(--surface)', color: 'var(--ink)', fontSize: 14 }}>
              <option value="">All Status</option>
              <option value="completed">Completed</option>
              <option value="pending">Pending</option>
              <option value="failed">Failed</option>
            </select>
            <input
              type="text"
              placeholder="Filter by landlord ID..."
              value={landlordFilter}
              onChange={(e) => setLandlordFilter(e.target.value)}
              style={{ padding: '10px 14px', borderRadius: 10, border: '1px solid var(--line)', background: 'var(--surface)', color: 'var(--ink)', fontSize: 14, minWidth: 180 }}
            />
          </div>
        </div>
      </section>

      <article className="card">
        <div className="card-label">All Split Payments</div>
        <h3 style={{ marginBottom: 16 }}>Platform Fee Deductions</h3>

        {loading ? (
          <p style={{ color: '#111827' }}>Loading split payments…</p>
        ) : splits.length === 0 ? (
          <p style={{ color: '#111827' }}>No split payments recorded yet.</p>
        ) : (
          <div className="table-shell responsive-table-wrapper">
            <table className="landlord-table" style={{ minWidth: '1100px' }}>
              <thead>
                <tr>
                  <th>Date</th>
                  <th>Landlord</th>
                  <th>Tenant</th>
                  <th>Original Amount</th>
                  <th>Platform Fee (1%)</th>
                  <th>Landlord Share (99%)</th>
                  <th>Transaction</th>
                  <th>Method</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {splits.map((split) => (
                  <tr key={split.id}>
                    <td>{formatDate(split.created_at)}</td>
                    <td>{split.landlord?.full_name || split.landlord?.email || '—'}</td>
                    <td>{split.tenant?.full_name || split.tenant?.email || '—'}</td>
                    <td>{formatCurrency(split.original_amount)}</td>
                    <td style={{ color: '#dc2626', fontWeight: 600 }}>{formatCurrency(split.platform_fee_amount)}</td>
                    <td style={{ color: 'var(--accent)', fontWeight: 600 }}>{formatCurrency(split.landlord_amount)}</td>
                    <td style={{ fontSize: '12px' }}>{split.transaction_code || split.pesaflow_transaction_id || '—'}</td>
                    <td style={{ textTransform: 'capitalize' }}>{split.payment_method}</td>
                    <td>
                      <span className={`status-pill ${split.status === 'completed' ? 'status-active' : split.status === 'pending' ? 'status-pending' : 'status-inactive'}`}>
                        {split.status}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </article>
    </main>
  );
}
