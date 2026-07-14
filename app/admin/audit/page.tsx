'use client';

import { useEffect, useState } from 'react';
import { supabase } from '../../../lib/supabaseClient';

interface AuditLog {
  id: string;
  user_email: string;
  action: string;
  resource_type: string;
  resource_id?: string;
  details?: any;
  ip_address?: string;
  created_at: string;
}

export default function AuditPage() {
  const [auditLogs, setAuditLogs] = useState<AuditLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [userRole, setUserRole] = useState('');
  const [filterType, setFilterType] = useState('');
  const [filterAction, setFilterAction] = useState('');

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      if (data.user) {
        setUserRole(data.user.user_metadata?.role || '');
      }
    });
  }, []);

  useEffect(() => {
    if (userRole === 'super_admin') {
      loadAuditLogs();
    }
  }, [userRole]);

  async function loadAuditLogs() {
    setLoading(true);
    const { data: { session } } = await supabase.auth.getSession();
    const headers: Record<string, string> = { 'Content-Type': 'application/json' };
    if (session?.access_token) headers.Authorization = `Bearer ${session.access_token}`;

    const params = new URLSearchParams();
    if (filterType) params.set('resourceType', filterType);
    if (filterAction) params.set('action', filterAction);

    const response = await fetch(`/api/audit?${params.toString()}`, { headers }).catch(() => null);
    const result = response ? await response.json() : {};

    if (response?.ok) {
      setAuditLogs(result.auditLogs ?? []);
    } else {
      setError(result.message ?? 'Unable to load audit logs.');
    }
    setLoading(false);
  }

  if (userRole !== 'super_admin') {
    return (
      <main className="container page-layout auth-pattern-bg">
        <div className="card">
          <h1>Access Denied</h1>
          <p>Super admin access required.</p>
        </div>
      </main>
    );
  }

  return (
    <main className="container page-layout auth-pattern-bg">
      <div className="card-admin-header">
        <div>
          <p className="heading">System Audit Logs</p>
          <p className="subheading">Monitor all activities across the platform for security and compliance.</p>
        </div>
      </div>

      <section className="card" style={{ marginBottom: 24 }}>
        <div style={{ display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'wrap' }}>
          <select value={filterType} onChange={e => setFilterType(e.target.value)}>
            <option value="">All Resources</option>
            <option value="property">Properties</option>
            <option value="tenant">Tenants</option>
            <option value="unit">Units</option>
            <option value="payment">Payments</option>
            <option value="invoice">Invoices</option>
            <option value="agent">Agents</option>
            <option value="document">Documents</option>
          </select>
          <select value={filterAction} onChange={e => setFilterAction(e.target.value)}>
            <option value="">All Actions</option>
            <option value="create">Create</option>
            <option value="update">Update</option>
            <option value="delete">Delete</option>
            <option value="login">Login</option>
            <option value="logout">Logout</option>
          </select>
          <button onClick={loadAuditLogs}>Apply Filters</button>
        </div>
      </section>

      {loading && <p className="landlord-muted">Loading audit logs...</p>}
      {error && <p className="landlord-error">{error}</p>}

      {!loading && auditLogs.length === 0 && (
        <div className="card">
          <p>No audit logs found. System activity will appear here.</p>
        </div>
      )}

      {!loading && auditLogs.length > 0 && (
        <div className="table-shell">
          <table className="landlord-table">
            <thead>
              <tr>
                <th>Timestamp</th>
                <th>User</th>
                <th>Action</th>
                <th>Resource</th>
                <th>IP Address</th>
                <th>Details</th>
              </tr>
            </thead>
            <tbody>
              {auditLogs.map(log => (
                <tr key={log.id}>
                  <td>{new Date(log.created_at).toLocaleString('en-GB')}</td>
                  <td>{log.user_email || 'System'}</td>
                  <td>
                    <span className={`status-pill ${log.action === 'delete' ? 'status-pending' : 'status-active'}`}>
                      {log.action}
                    </span>
                  </td>
                  <td>{log.resource_type}{log.resource_id ? ` · ${log.resource_id.slice(0, 8)}` : ''}</td>
                  <td style={{ fontSize: '12px', color: 'var(--ink-3)' }}>{log.ip_address || '-'}</td>
                  <td style={{ fontSize: '12px', color: 'var(--ink-3)', maxWidth: 300 }}>
                    {log.details ? JSON.stringify(log.details).slice(0, 100) : '-'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </main>
  );
}