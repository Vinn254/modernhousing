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
  tenant?: {
    full_name: string;
    email: string;
  } | null;
}

export default function SplitPaymentsPage() {
  const [splits, setSplits] = useState<SplitPayment[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');

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
  }, [search, statusFilter]);

  const formatCurrency = (value: number) => new Intl.NumberFormat('en-KE', { style: 'currency', currency: 'KES' }).format(value);
  const formatDate = (date: string) => new Date(date).toLocaleString();

  return (
    <main className="container admin-no-hero auth-bg">
      <div className="card-admin-header">
        <div>
          <p className="heading">Platform Fee History</p>
          <p className="subheading">Track 1% platform fee deductions from rent payments processed through PesaFlow.</p>
        </div>
      </div>

      <section className="card-grid" style={{ marginBottom: 24 }}>
        <div className="card">
          <div className="card-label">Filter Split Payments</div>
          <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', marginTop: 12 }}>
            <input
              type="text"
              placeholder="Search by transaction code..."
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
          </div>
        </div>
      </section>

      <article className="card" style={{ marginBottom: 24 }}>
        <div className="card-label">Split Payments</div>
        <h3 style={{ marginBottom: 16 }}>1% Platform Fee Deductions</h3>

        {loading ? (
          <p style={{ color: '#111827' }}>Loading split payments…</p>
        ) : splits.length === 0 ? (
          <p style={{ color: '#111827' }}>No split payments recorded yet.</p>
        ) : (
          <div className="table-shell responsive-table-wrapper">
            <table className="landlord-table" style={{ minWidth: '900px' }}>
              <thead>
                <tr>
                  <th>Date</th>
                  <th>Tenant</th>
                  <th>Original Amount</th>
                  <th>Platform Fee (1%)</th>
                  <th>Your Share (99%)</th>
                  <th>Transaction</th>
                  <th>Method</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {splits.map((split) => (
                  <tr key={split.id}>
                    <td>{formatDate(split.created_at)}</td>
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
