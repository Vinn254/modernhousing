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

export default function SuperAdminAuditPage() {
  const [auditLogs, setAuditLogs] = useState<AuditLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [filterType, setFilterType] = useState('');
  const [filterAction, setFilterAction] = useState('');

  useEffect(() => {
    loadAuditLogs();
    const interval = window.setInterval(loadAuditLogs, 30000);
    return () => window.clearInterval(interval);
  }, [filterType, filterAction]);

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

  function downloadCSV() {
    if (auditLogs.length === 0) return;
    const headers = ['Timestamp', 'User', 'Action', 'Resource', 'IP Address', 'Details'];
    const rows = auditLogs.map(log => [
      new Date(log.created_at).toLocaleString('en-GB'),
      log.user_email || 'System',
      log.action,
      log.resource_type + (log.resource_id ? ` · ${log.resource_id.slice(0, 8)}` : ''),
      log.ip_address || '-',
      log.details ? JSON.stringify(log.details).slice(0, 100) : '-',
    ]);
    const csv = [headers, ...rows].map(r => r.map(cell => `"${String(cell).replace(/"/g, '""')}"`).join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `audit-logs-${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  }

  const rowColors = ['#f0fdfa', '#eff6ff', '#fef3c7', '#fdf2f8', '#f0f9ff', '#fdf4ff', '#ecfdf5', '#fff7ed'];

  return (
    <>
      <main className="container admin-no-hero" style={{ overflowX: 'hidden' }}>
        <div className="card-admin-header" style={{ marginBottom: 16 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 16, flexWrap: 'wrap' }}>
            <div>
              <p className="heading">System Audit Logs</p>
              <p className="subheading">Monitor all activities across the platform for security and compliance.</p>
            </div>
            <div className="landlord-actions">
              <button onClick={loadAuditLogs} className="action-button secondary">Refresh</button>
              <button onClick={downloadCSV} className="action-button primary">Download CSV</button>
            </div>
          </div>
        </div>

        <section className="card card-tint--neutral" style={{ marginBottom: 16 }}>
          <div style={{ display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'wrap' }}>
            <select value={filterType} onChange={e => setFilterType(e.target.value)} style={{ padding: '8px 12px', borderRadius: 8, border: '1px solid #cbd5e1', background: '#fff', minWidth: 140, fontSize: 13, flex: '1 1 140px' }}>
              <option value="">All Resources</option>
              <option value="property">Properties</option>
              <option value="tenant">Tenants</option>
              <option value="unit">Units</option>
              <option value="payment">Payments</option>
              <option value="invoice">Invoices</option>
              <option value="agent">Agents</option>
              <option value="document">Documents</option>
            </select>
            <select value={filterAction} onChange={e => setFilterAction(e.target.value)} style={{ padding: '8px 12px', borderRadius: 8, border: '1px solid #cbd5e1', background: '#fff', minWidth: 140, fontSize: 13, flex: '1 1 140px' }}>
              <option value="">All Actions</option>
              <option value="create">Create</option>
              <option value="update">Update</option>
              <option value="delete">Delete</option>
              <option value="login">Login</option>
              <option value="logout">Logout</option>
            </select>
            <button onClick={loadAuditLogs} className="action-button secondary" style={{ flex: '0 0 auto' }}>Apply Filters</button>
          </div>
        </section>

        {loading && (
          <div className="card card-tint--teal" style={{ textAlign: 'center', padding: '16px' }}>
            <p style={{ color: '#065f46', fontWeight: 600, fontSize: 14 }}>Loading audit logs...</p>
          </div>
        )}
        {error && (
          <div className="card card-tint--danger" style={{ padding: '12px', marginBottom: 16 }}>
            <p style={{ color: '#991b1b', fontWeight: 600, fontSize: 14 }}>{error}</p>
          </div>
        )}

        {!loading && auditLogs.length === 0 && (
          <div className="card card-tint--amber" style={{ textAlign: 'center', padding: '24px 16px' }}>
            <p style={{ color: '#92400e', fontWeight: 600, marginBottom: 4, fontSize: 14 }}>No audit logs found</p>
            <p style={{ color: '#b45309', fontSize: 12 }}>System activity will appear here as actions are performed.</p>
          </div>
        )}

        {!loading && auditLogs.length > 0 && (
          <div className="card" style={{ padding: 0, overflow: 'hidden', border: '1px solid #e2e8f0', background: '#fff' }}>
            <div className="audit-table-shell">
              <table className="audit-table">
                <thead>
                  <tr style={{ background: 'linear-gradient(135deg, #4f46e5 0%, #7c3aed 100%)' }}>
                    <th style={{ textAlign: 'left', padding: '12px 16px', color: '#fff', fontSize: 12, fontWeight: 700, letterSpacing: '0.05em', textTransform: 'uppercase', whiteSpace: 'nowrap' }}>Timestamp</th>
                    <th style={{ textAlign: 'left', padding: '12px 16px', color: '#fff', fontSize: 12, fontWeight: 700, letterSpacing: '0.05em', textTransform: 'uppercase', whiteSpace: 'nowrap' }}>User</th>
                    <th style={{ textAlign: 'left', padding: '12px 16px', color: '#fff', fontSize: 12, fontWeight: 700, letterSpacing: '0.05em', textTransform: 'uppercase', whiteSpace: 'nowrap' }}>Action</th>
                    <th style={{ textAlign: 'left', padding: '12px 16px', color: '#fff', fontSize: 12, fontWeight: 700, letterSpacing: '0.05em', textTransform: 'uppercase', whiteSpace: 'nowrap' }}>Resource</th>
                    <th style={{ textAlign: 'left', padding: '12px 16px', color: '#fff', fontSize: 12, fontWeight: 700, letterSpacing: '0.05em', textTransform: 'uppercase', whiteSpace: 'nowrap' }}>IP Address</th>
                    <th style={{ textAlign: 'left', padding: '12px 16px', color: '#fff', fontSize: 12, fontWeight: 700, letterSpacing: '0.05em', textTransform: 'uppercase', whiteSpace: 'nowrap' }}>Details</th>
                  </tr>
                </thead>
                <tbody>
                  {auditLogs.map((log, idx) => {
                    const bg = rowColors[idx % rowColors.length];
                    const actionColor = log.action === 'delete' ? '#dc2626' : log.action === 'create' ? '#059669' : log.action === 'update' ? '#2563eb' : log.action === 'login' ? '#7c3aed' : '#d97706';
                    const actionBg = log.action === 'delete' ? '#fef2f2' : log.action === 'create' ? '#f0fdf4' : log.action === 'update' ? '#eff6ff' : log.action === 'login' ? '#f5f3ff' : '#fffbeb';
                    return (
                      <tr key={log.id} style={{ background: bg, borderBottom: '1px solid #f1f5f9' }}>
                        <td data-label="Timestamp" style={{ padding: '10px 16px', fontSize: 12, color: '#334155', whiteSpace: 'nowrap' }}>{new Date(log.created_at).toLocaleString('en-GB')}</td>
                        <td data-label="User" style={{ padding: '10px 16px', fontSize: 13, color: '#0f172a', fontWeight: 500 }}>{log.user_email || 'System'}</td>
                        <td data-label="Action" style={{ padding: '10px 16px', fontSize: 12 }}>
                          <span style={{ padding: '3px 10px', borderRadius: 999, background: actionBg, color: actionColor, fontWeight: 700, border: `1px solid ${actionColor}25` }}>{log.action}</span>
                        </td>
                        <td data-label="Resource" style={{ padding: '10px 16px', fontSize: 12, color: '#334155' }}>
                          {log.resource_type}
                          {log.resource_id ? <span style={{ color: '#94a3b8', marginLeft: 4 }}>· {log.resource_id.slice(0, 8)}</span> : null}
                        </td>
                        <td data-label="IP Address" style={{ padding: '10px 16px', fontSize: 12, color: '#64748b', fontFamily: 'monospace' }}>{log.ip_address || '-'}</td>
                        <td data-label="Details" style={{ padding: '10px 16px', fontSize: 12, color: '#475569', maxWidth: 260, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={log.details ? JSON.stringify(log.details) : '-'}>
                          {log.details ? JSON.stringify(log.details).slice(0, 100) : '-'}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </main>

      <footer>
        <div className="footer-inner">
          <div className="footer-brand"><span className="logo-mark" style={{ width: 26, height: 26, borderRadius: 7 }}><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M3 21h18"/><path d="M5 21V7l8-4v18"/><path d="M19 21V11l-6-4"/></svg></span>Springfield Systems</div>
          <div className="footer-links"><a href="/">Home</a><a href="/super-admin">Dashboard</a></div>
          <div className="footer-copy">© 2026 Springfield Systems. All rights reserved.</div>
        </div>
      </footer>
    </>
  );
}
