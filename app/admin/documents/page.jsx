'use client';
import { useEffect, useState } from 'react';
import { supabase } from '../../../lib/supabaseClient';
export default function LandlordDocumentsPage() {
    const [documents, setDocuments] = useState([]);
    const [bundles, setBundles] = useState([]);
    const [tenants, setTenants] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [message, setMessage] = useState('');
    const [documentFile, setDocumentFile] = useState(null);
    const [uploadForm, setUploadForm] = useState({
        tenantId: '',
        documentName: '',
        documentType: 'agreement',
        notes: '',
    });
    const [uploading, setUploading] = useState(false);
    async function getAuthHeaders() {
        const { data } = await supabase.auth.getSession();
        const headers = { 'Content-Type': 'application/json' };
        if (data.session?.access_token)
            headers.Authorization = `Bearer ${data.session.access_token}`;
        return headers;
    }
    async function loadData() {
        setLoading(true);
        setError('');
        try {
            const [docsResponse, bundlesResponse, tenantsResponse] = await Promise.all([
                fetch('/api/documents', { headers: await getAuthHeaders() }),
                fetch('/api/document-bundles', { headers: await getAuthHeaders() }).catch(() => null),
                fetch('/api/tenants', { headers: await getAuthHeaders() }),
            ]);
            const docsResult = await docsResponse.json();
            const bundlesResult = bundlesResponse ? await bundlesResponse.json() : { bundles: [] };
            const tenantsResult = await tenantsResponse.json();
            setDocuments(docsResult.documents ?? []);
            setBundles(bundlesResult.bundles ?? []);
            setTenants(tenantsResult.tenants ?? []);
        }
        catch (err) {
            setError(err.message);
        }
        finally {
            setLoading(false);
        }
    }
    useEffect(() => {
        loadData();
    }, []);
    async function handleUploadAgreement(event) {
        event.preventDefault();
        setMessage('');
        setError('');
        if (!documentFile) {
            setError('Please select a document file.');
            return;
        }
        setUploading(true);
        const { data: { session } } = await supabase.auth.getSession();
        const targetTenantIds = uploadForm.tenantId === 'all'
            ? tenants.map(t => t.id)
            : [uploadForm.tenantId];
        try {
            for (const tenantId of targetTenantIds) {
                const formData = new FormData();
                formData.append('file', documentFile);
                formData.append('tenantId', tenantId);
                formData.append('documentType', uploadForm.documentType);
                formData.append('documentName', uploadForm.documentName || documentFile.name);
                const response = await fetch('/api/documents', {
                    method: 'POST',
                    body: formData,
                    headers: session?.access_token ? { Authorization: `Bearer ${session.access_token}` } : undefined,
                });
                const result = await response.json();
                if (!response.ok) {
                    throw new Error(result.message ?? 'Upload failed');
                }
            }
            setMessage(`Document uploaded to ${targetTenantIds.length} tenant${targetTenantIds.length > 1 ? 's' : ''}.`);
            setDocumentFile(null);
            setUploadForm({ tenantId: '', documentName: '', documentType: 'agreement', notes: '' });
            loadData();
        }
        catch (err) {
            setError(err.message);
        }
        finally {
            setUploading(false);
        }
    }
    async function handleUpdateStatus(docId, status) {
        const response = await fetch('/api/documents', {
            method: 'PATCH',
            headers: await getAuthHeaders(),
            body: JSON.stringify({ id: docId, status }),
        });
        const result = await response.json();
        if (response.ok) {
            setMessage(`Document ${status}.`);
            loadData();
        }
        else {
            setError(result.message ?? 'Unable to update status.');
        }
    }
    async function handleDelete(docId) {
        if (!confirm('Delete this document?'))
            return;
        const response = await fetch('/api/documents', {
            method: 'DELETE',
            headers: await getAuthHeaders(),
            body: JSON.stringify({ id: docId }),
        });
        const result = await response.json();
        if (response.ok) {
            setMessage('Document deleted.');
            loadData();
        }
        else {
            setError(result.message ?? 'Unable to delete.');
        }
    }
    async function viewAuditTrail(docId) {
        window.open(`/admin/audit-trail?documentId=${docId}`, '_blank');
    }
    async function handleApproveBundle(bundleId) {
        const response = await fetch('/api/document-bundles', {
            method: 'PATCH',
            headers: await getAuthHeaders(),
            body: JSON.stringify({ id: bundleId, status: 'approved' }),
        });
        const result = await response.json();
        if (response.ok) {
            setMessage('Bundle approved.');
            loadData();
        }
        else {
            setError(result.message ?? 'Unable to approve bundle.');
        }
    }
    async function handleRejectBundle(bundleId) {
        if (!confirm('Reject this bundle?'))
            return;
        const response = await fetch('/api/document-bundles', {
            method: 'PATCH',
            headers: await getAuthHeaders(),
            body: JSON.stringify({ id: bundleId, status: 'rejected' }),
        });
        const result = await response.json();
        if (response.ok) {
            setMessage('Bundle rejected.');
            loadData();
        }
        else {
            setError(result.message ?? 'Unable to reject bundle.');
        }
    }
    const formatType = (type) => {
        const map = {
            agreement: 'Agreement',
            signed_agreement: 'Signed Agreement',
            id_document: 'ID Document',
        };
        return map[type] || type.replace('_', ' ');
    };
    const getStatusBadge = (status) => {
        const styles = {
            sent: 'status-pending',
            downloaded: 'status-pending',
            awaiting_signature: 'status-pending',
            signed: 'status-active',
            approved: 'status-active',
            rejected: 'status-pending',
        };
        return styles[status] || '';
    };
    const FileInput = ({ label, accept, onChange, file }) => (<div style={{ marginBottom: 12, minWidth: 0 }}>
      <label style={{ fontSize: '12px', fontWeight: 600, display: 'block', marginBottom: 6 }}>{label}</label>
      <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap', minWidth: 0 }}>
        <label htmlFor={`file-${label.replace(/\s+/g, '-').toLowerCase()}`} style={{
            padding: '8px 12px',
            background: 'var(--line)',
            borderRadius: 6,
            cursor: 'pointer',
            fontSize: '13px',
            whiteSpace: 'nowrap',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            flex: 1,
            minWidth: 0,
            maxWidth: '100%',
        }}>
          {file ? file.name : 'Choose File'}
        </label>
        <input id={`file-${label.replace(/\s+/g, '-').toLowerCase()}`} type="file" accept={accept} onChange={onChange} style={{ display: 'none' }}/>
        {file && <span style={{ fontSize: '11px', color: 'var(--ink-3)', flexShrink: 0 }}>{Math.round(file.size / 1024)}KB</span>}
      </div>
    </div>);
    return (<div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
      <main className="container admin-no-hero">
        <div className="card-admin-header">
          <div>
            <p className="heading">Tenancy Agreement</p>
            <p className="subheading">Upload rental agreements and review signed documents.</p>
          </div>
        </div>

    <section className="card-grid">
          <article className="card" style={{ gridColumn: '1 / -1' }}>
            <div className="card-label">
              <span className="badge badge-pm">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>
              </span>Upload Agreement
            </div>
            <h3>Send Agreement to Tenant</h3>
            <form onSubmit={handleUploadAgreement} className="form-grid" style={{ maxWidth: '100%', overflow: 'hidden' }}>
              <select value={uploadForm.tenantId} onChange={e => setUploadForm(f => ({ ...f, tenantId: e.target.value }))} required style={{ width: '100%', minWidth: 0 }}>
                <option value="">Select tenant</option>
                <option value="all">All Tenants</option>
                {tenants.map(t => <option key={t.id} value={t.id}>{t.full_name} - {t.property} · Unit {t.unit}</option>)}
              </select>
              <input value={uploadForm.documentName} onChange={e => setUploadForm(f => ({ ...f, documentName: e.target.value }))} placeholder="Document name (e.g., Tenancy Agreement)" required style={{ width: '100%' }}/>
              <select value={uploadForm.documentType} onChange={e => setUploadForm(f => ({ ...f, documentType: e.target.value }))} style={{ width: '100%' }}>
                <option value="agreement">Agreement</option>
              </select>
              <div className="field-group" style={{ minWidth: 0 }}>
                <label style={{ fontSize: '12px', color: 'var(--ink-2)' }}>Agreement File</label>
                <FileInput label="Choose File" accept=".pdf,.doc,.docx,.jpg,.jpeg,.png" onChange={e => {
            const file = e.target.files?.[0] ?? null;
            setDocumentFile(file);
            if (file && !uploadForm.documentName)
                setUploadForm(f => ({ ...f, documentName: 'Tenancy Agreement' }));
        }} file={documentFile}/>
              </div>
              <input value={uploadForm.notes} onChange={e => setUploadForm(f => ({ ...f, notes: e.target.value }))} placeholder="Notes (optional)" className="field-group-wide" style={{ width: '100%' }}/>
              <button type="submit" disabled={uploading} style={{ width: '100%' }}>Upload & Assign</button>
            </form>
            <p style={{ fontSize: '11px', color: 'var(--ink-3)', marginTop: 8 }}>Upload agreement PDF and assign to tenant.</p>
          </article>

          <article className="card" style={{ gridColumn: '1 / -1' }}>
            <div className="card-label">
              <span className="badge badge-agent">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><rect x="1" y="4" width="22" height="16" rx="2"/><line x1="1" y1="10" x2="23" y2="10"/></svg>
              </span>All Documents
            </div>
            <h3 style={{ marginBottom: 16 }}>Agreement Workflow</h3>

            {loading && <p className="landlord-muted">Loading documents...</p>}
            {!loading && documents.filter(doc => doc.document_type === 'agreement').length === 0 && <p className="landlord-empty">No agreement documents uploaded yet.</p>}

            {!loading && documents.filter(doc => doc.document_type === 'agreement').length > 0 && (<div className="table-shell">
                <table className="landlord-table" style={{ fontSize: '12px' }}>
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
                    {documents.filter(doc => doc.document_type === 'agreement').map(doc => (<tr key={doc.id}>
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
                          <div className="landlord-actions">
                            <a href={doc.document_url} target="_blank" rel="noopener noreferrer" className="action-button primary" style={{ padding: '6px 12px', fontSize: '12px' }}>Download</a>
                            <button className="action-button secondary" style={{ padding: '6px 12px', fontSize: '12px' }} onClick={() => viewAuditTrail(doc.id)}>Audit Trail</button>
                            {doc.status === 'downloaded' && (<button className="action-button warn" style={{ padding: '6px 12px', fontSize: '12px' }} onClick={() => handleUpdateStatus(doc.id, 'awaiting_signature')}>Mark as Signed</button>)}
                            {doc.status === 'signed' && (<>
                                <button className="action-button info" style={{ padding: '6px 12px', fontSize: '12px' }} onClick={() => handleUpdateStatus(doc.id, 'approved')}>Approve</button>
                                <button className="action-button danger" style={{ padding: '6px 12px', fontSize: '12px' }} onClick={() => handleUpdateStatus(doc.id, 'rejected')}>Reject</button>
                              </>)}
                            <button className="action-button danger" style={{ padding: '6px 12px', fontSize: '12px' }} onClick={() => handleDelete(doc.id)}>Delete</button>
                          </div>
                        </td>
                      </tr>))}
                  </tbody>
                </table>
              </div>)}

            {error && <p className="landlord-error" style={{ marginTop: 12 }}>{error}</p>}
            {message && <p className="landlord-success" style={{ marginTop: 12 }}>{message}</p>}
          </article>

          {/* Document Bundles - Pending Review */}
          <article className="card" style={{ gridColumn: '1 / -1' }}>
            <div className="card-label">
              <span className="badge badge-agent">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>
              </span>Document Bundles
            </div>
            <h3 style={{ marginBottom: 16 }}>Tenant Submissions Awaiting Review</h3>

            {loading && <p className="landlord-muted">Loading bundles...</p>}
            {!loading && bundles.length === 0 && <p className="landlord-empty">No document bundles submitted.</p>}

            {!loading && bundles.length > 0 && (<div className="table-shell">
                <table className="landlord-table" style={{ fontSize: '12px' }}>
                  <thead>
                    <tr>
                      <th>Tenant</th>
                      <th>Signed Agreement</th>
                      <th>ID Document</th>
                      <th>Passport</th>
                      <th>Status</th>
                      <th>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {bundles.map(bundle => (<tr key={bundle.id}>
                        <td>{bundle.tenant_name || '-'}</td>
                        <td>{bundle.signed_agreement_url ? <a href={bundle.signed_agreement_url} target="_blank" className="action-button secondary" style={{ padding: '6px 12px', fontSize: '12px' }}>View</a> : '-'}</td>
                        <td>{bundle.id_document_url ? <a href={bundle.id_document_url} target="_blank" className="action-button secondary" style={{ padding: '6px 12px', fontSize: '12px' }}>View</a> : '-'}</td>
                        <td>{bundle.passport_photo_url ? <a href={bundle.passport_photo_url} target="_blank" className="action-button secondary" style={{ padding: '6px 12px', fontSize: '12px' }}>View</a> : '-'}</td>
                        <td>
                          <span className={`status-pill ${bundle.status === 'approved' ? 'status-active' : 'status-pending'}`} style={{ textTransform: 'capitalize' }}>
                            {bundle.status}
                          </span>
                        </td>
            <td>
                          {bundle.status === 'pending' && (<div className="landlord-actions">
                              <button onClick={() => handleApproveBundle(bundle.id)} className="action-button warn" style={{ padding: '6px 12px', fontSize: '12px' }}>Approve</button>
                              <button onClick={() => handleRejectBundle(bundle.id)} className="action-button danger" style={{ padding: '6px 12px', fontSize: '12px' }}>Reject</button>
                            </div>)}
                        </td>
                      </tr>))}
                  </tbody>
                </table>
              </div>)}
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
    </div>);
}
