'use client';

import { useEffect, useState } from 'react';

interface Tenant {
  id: string;
  name: string;
  email: string;
  property: string;
  unit: string;
  leaseStatus: string;
  balance: number;
}

export default function TenantsPage() {
  const [tenants, setTenants] = useState<Tenant[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  async function loadData() {
    setLoading(true);
    const tenantsResponse = await fetch('/api/tenants');
    const tenantsResult = await tenantsResponse.json();

    if (!tenantsResponse.ok) {
      setError(tenantsResult.message ?? 'Unable to load tenants.');
      setLoading(false);
      return;
    }

    setTenants(tenantsResult.tenants ?? []);
    setLoading(false);
  }

  useEffect(() => {
    loadData();
  }, []);

  return (
    <>
      <main className="container admin-no-hero" style={{ padding: '34px 0 80px' }}>
        <div className="card-admin-header">
          <div>
            <p className="heading">Tenants</p>
            <p className="subheading">View all tenants across properties and manage lease records.</p>
          </div>
        </div>

        <section className="bento-section">
          <div className="bento">
            <article className="card">
              <div className="card-label"><span className="badge badge-pm">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>
              </span>All Tenants</div>
              <h3 style={{ marginBottom: 16 }}>Tenant Records</h3>

              {loading && <p className="landlord-muted">Loading tenants…</p>}
              {error && <p className="landlord-error">{error}</p>}

              {!loading && tenants.length === 0 && <p className="landlord-empty">No tenants found.</p>}

              {!loading && tenants.length > 0 && (
                <div className="table-shell">
                  <table className="landlord-table">
                    <thead>
                      <tr>
                        <th>Name</th>
                        <th>Email</th>
                        <th>Property</th>
                        <th>Unit</th>
                        <th>Status</th>
                        <th>Balance</th>
                        <th>Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {tenants.map((tenant) => (
                        <tr key={tenant.id}>
                          <td className="landlord-name">{tenant.name}</td>
                          <td>{tenant.email}</td>
                          <td>{tenant.property}</td>
                          <td>{tenant.unit}</td>
                          <td>
                            <span className={`status-pill ${tenant.leaseStatus === 'Active' ? 'status-active' : 'status-pending'}`}>
                              {tenant.leaseStatus}
                            </span>
                          </td>
                          <td style={{ fontWeight: 600, color: tenant.balance > 0 ? 'var(--rose)' : 'var(--ink)' }}>
                            {tenant.balance > 0 ? `KSH ${tenant.balance.toLocaleString()}` : '—'}
                          </td>
                          <td>
                            <button className="action-button">View</button>
                          </td>
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
          <div className="footer-brand">
            <span className="logo-mark" style={{width:26,height:26,borderRadius:7}}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M3 21h18"/><path d="M5 21V7l8-4v18"/><path d="M19 21V11l-6-4"/></svg>
            </span>
            Springfield Systems
          </div>
          <div className="footer-links">
            <a href="/">Home</a>
            <a href="/super-admin">Dashboard</a>
          </div>
          <div className="footer-copy">© 2026 Springfield Systems. All rights reserved.</div>
        </div>
      </footer>
    </>
  );
}