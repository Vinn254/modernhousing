'use client';

import { useEffect, useState } from 'react';
import { supabase } from '../../../lib/supabaseClient';

interface Tenant {
  id: string;
  full_name: string;
  email: string;
  property: string;
  unit: string;
}

interface Document {
  id: string;
  tenant_id: string;
  tenant_name?: string;
  property_name?: string;
  document_name: string;
  document_url: string;
  document_type: string;
  status: string;
  notes?: string;
  created_at: string;
}

export default function LandlordDocumentsPage() {
  const [documents, setDocuments] = useState<Document[]>([]);
  const [tenants, setTenants] = useState<Tenant[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [showUpload, setShowUpload] = useState(false);
  const [uploadForm, setUploadForm] = useState({
    tenantId: '',
    documentName: '',
    documentType: 'agreement',
    documentUrl: '',
    notes: '',
  });

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
      const [docsResponse, tenantsResponse] = await Promise.all([
        fetch('/api/documents', { headers: await getAuthHeaders() }),
        fetch('/api/tenants', { headers: await getAuthHeaders() }),
      ]);

      const docsResult = await docsResponse.json();
      const tenantsResult = await tenantsResponse.json();

      setDocuments(docsResult.documents ?? []);
      setTenants(tenantsResult.tenants ?? []);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadData();
  }, []);

  async function handleUploadAgreement(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setMessage('');
    setError('');

    if (!uploadForm.tenantId || !uploadForm.documentUrl) {
      setError('Tenant and document URL are required.');
      return;
    }

    const response = await fetch('/api/documents', {
      method: 'POST',
      headers: await getAuthHeaders(),
      body: JSON.stringify({
        tenantId: uploadForm.tenantId,
        documentName: uploadForm.documentName || 'Tenancy Agreement',
        documentUrl: uploadForm.documentUrl,
        documentType: uploadForm.documentType,
        notes: uploadForm.notes,
      }),
    });

    const result = await response.json();
    if (response.ok) {
      setMessage('Agreement uploaded successfully.');
      setShowUpload(false);
      setUploadForm({ tenantId: '', documentName: '', documentType: 'agreement', documentUrl: '', notes: '' });
      loadData();
    } else {
      setError(result.message ?? 'Unable to upload agreement.');
    }
  }

  async function handleUpdateStatus(docId: string, status: string) {
    const response = await fetch('/api/documents', {
      method: 'PATCH',
      headers: await getAuthHeaders(),
      body: JSON.stringify({ id: docId, status }),
    });

    const result = await response.json();
    if (response.ok) {
      setMessage(`Document ${status}.`);
      loadData();
    } else {
      setError(result.message ?? 'Unable to update status.');
    }
  }

  async function handleDelete(docId: string) {
    if (!confirm('Delete this document?')) return;
    
    const response = await fetch('/api/documents', {
      method: 'DELETE',
      headers: await getAuthHeaders(),
      body: JSON.stringify({ id: docId }),
    });

    const result = await response.json();
    if (response.ok) {
      setMessage('Document deleted.');
      loadData();
    } else {
      setError(result.message ?? 'Unable to delete.');
    }
  }

  const formatType = (type: string) => {
    const map: Record<string, string> = {
      agreement: 'Agreement',
      signed_agreement: 'Signed Agreement',
      id_document: 'ID Document',
    };
    return map[type] || type.replace('_', ' ');
  };

  const getStatusBadge = (status: string) => {
    const styles: Record<string, string> = {
      sent: 'status-pending',
      downloaded: 'status-pending',
      awaiting_signature: 'status-pending',
      signed: 'status-active',
      approved: 'status-active',
      rejected: 'status-pending',
    };
    return styles[status] || '';
  };

  return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
      <main className="container admin-no-hero">
        <div className="card-admin-header">
          <div>
            <p className="heading">Tenant Agreements</p>
            <p className="subheading">Upload rental agreements and review signed documents.</p>
          </div>
        </div>

        <section className="card-grid">
          <article className="card">
            <div className="card-label">
              <span className="badge badge-pm">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>
              </span>Upload Agreement
            </div>
            <h3>Send Agreement to Tenant</h3>
            <form onSubmit={handleUploadAgreement} className="form-grid">
              <select value={uploadForm.tenantId} onChange={e => setUploadForm(f => ({ ...f, tenantId: e.target.value }))} required>
                <option value="">Select tenant</option>
                {tenants.map(t => <option key={t.id} value={t.id}>{t.full_name} - {t.property} · Unit {t.unit}</option>)}
              </select>
              <input value={uploadForm.documentName} onChange={e => setUploadForm(f => ({ ...f, documentName: e.target.value }))} placeholder="Document name (e.g., Tenancy Agreement)" />
              <select value={uploadForm.documentType} onChange={e => setUploadForm(f => ({ ...f, documentType: e.target.value }))}>
                <option value="agreement">Agreement</option>
                <option value="id_document">ID Document</option>
                <option value="signed_agreement">Signed Agreement</option>
              </select>
              <input value={uploadForm.documentUrl} onChange={e => setUploadForm(f => ({ ...f, documentUrl: e.target.value }))} required placeholder="Document URL (PDF link)" />
              <input value={uploadForm.notes} onChange={e => setUploadForm(f => ({ ...f, notes: e.target.value }))} placeholder="Notes (optional)" />
              <button type="submit">Upload & Assign</button>
            </form>
            <p style={{ fontSize: '11px', color: 'var(--ink-3)', marginTop: 8 }}>Upload agreement PDF and assign to tenant.</p>
          </article>
        </section>

        <section className="card" style={{ marginTop: 24 }}>
          <div className="card-label">
            <span className="badge badge-agent">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><rect x="1" y="4" width="22" height="16" rx="2"/><line x1="1" y1="10" x2="23" y2="10"/></svg>
            </span>All Documents
          </div>
          <h3 style={{ marginBottom: 16 }}>Agreement Workflow</h3>

          {loading && <p className="landlord-muted">Loading documents...</p>}
          {!loading && documents.length === 0 && <p className="landlord-empty">No documents uploaded yet.</p>}

          {!loading && documents.length > 0 && (
            <div className="table-shell" style={{ maxHeight: '500px', overflowY: 'auto' }}>
              <table className="landlord-table" style={{ minWidth: '100%', fontSize: '12px' }}>
                <thead>
                  <tr>
                    <th>Tenant</th>
                    <th>Document</th>
                    <th>Type</th>
                    <th>Status</th>
                    <th>Submitted</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {documents.map(doc => (
                    <tr key={doc.id}>
                      <td>{doc.tenant_name || tenants.find(t => t.id === doc.tenant_id)?.full_name || '-'}</td>
                      <td>{doc.document_name}</td>
                      <td>{formatType(doc.document_type)}</td>
                      <td>
                        <span className={`status-pill ${getStatusBadge(doc.status)}`} style={{ textTransform: 'capitalize' }}>
                          {doc.status === 'awaiting_signature' ? 'Awaiting Signature' : doc.status}
                        </span>
                      </td>
                      <td>{doc.created_at ? new Date(doc.created_at).toLocaleDateString() : '-'}</td>
                      <td>
                        <a href={doc.document_url} target="_blank" rel="noopener noreferrer" className="action-button primary" style={{ padding: '4px 8px', fontSize: '11px', marginRight: 4 }}>Download</a>
                        {doc.status === 'signed' && (
                          <button className="action-button" style={{ padding: '4px 8px', fontSize: '11px', marginRight: 4, background: '#10b981', color: '#fff' }} onClick={() => handleUpdateStatus(doc.id, 'approved')}>Approve</button>
                        )}
                        {doc.status === 'signed' && (
                          <button className="action-button" style={{ padding: '4px 8px', fontSize: '11px', marginRight: 4, background: '#f59e0b', color: '#fff' }} onClick={() => handleUpdateStatus(doc.id, 'rejected')}>Request Re-sign</button>
                        )}
                        <button className="action-button" style={{ padding: '4px 8px', fontSize: '11px', background: '#dc2626', color: '#fff' }} onClick={() => handleDelete(doc.id)}>Delete</button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {error && <p className="landlord-error" style={{ marginTop: 12 }}>{error}</p>}
          {message && <p className="landlord-success" style={{ marginTop: 12 }}>{message}</p>}
        </section>
      </main>

      <footer>
        <div className="footer-inner">
          <div className="footer-brand"><span className="logo-mark" style={{ width: 26, height: 26, borderRadius: 7 }}><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M3 21h18"/><path d="M5 21V7l8-4v18"/><path d="M19 21V11l-6-4"/></svg></span>Springfield Systems</div>
          <div className="footer-links"><a href="/">Home</a><a href="/admin">Dashboard</a></div>
          <div className="footer-copy">© 2026 Springfield Systems. All rights reserved.</div>
        </div>
      </footer>
    </div>
  );
}