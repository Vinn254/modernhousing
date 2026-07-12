'use client';

import { useEffect, useState } from 'react';
import { supabase } from '../../../lib/supabaseClient';

interface AgreementDocument {
  id: string;
  document_name: string;
  document_url: string;
  document_type: string;
  status: string;
  notes?: string;
  created_at: string;
}

interface Document { id: string; document_type: string; created_at: string; }

export default function TenantDocumentsPage() {
  const [user, setUser] = useState<any>(null);
  const [agreements, setAgreements] = useState<AgreementDocument[]>([]);
  const [documents, setDocuments] = useState<Document[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  
  const [signedAgreement, setSignedAgreement] = useState<File | null>(null);
  const [idDocument, setIdDocument] = useState<File | null>(null);
  const [passportPhoto, setPassportPhoto] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);

  async function loadDocuments() {
    setLoading(true);
    const { data: { session } } = await supabase.auth.getSession();
    const tenantId = session?.user?.user_metadata?.tenant_id;
    
    if (!session?.user?.id && !tenantId) {
      setLoading(false);
      return;
    }
    
    const headers: Record<string, string> = { 'Content-Type': 'application/json' };
    if (session?.access_token) headers.Authorization = `Bearer ${session.access_token}`;
    
    const [agreementsResponse, docsResponse] = await Promise.all([
      tenantId ? fetch(`/api/documents?tenantId=${tenantId}`, { headers }).catch(() => null) : null,
      session?.user?.id ? fetch(`/api/tenant/documents?userId=${session.user.id}`, { headers }).catch(() => null) : null,
    ]);
    
    const [agreementsResult, docsResult] = await Promise.all([
      agreementsResponse?.json() ?? Promise.resolve({ documents: [] }),
      docsResponse?.json() ?? Promise.resolve({ documents: [] }),
    ]);
    
    if (agreementsResponse?.ok) setAgreements(agreementsResult.documents ?? []);
    if (docsResponse?.ok) setDocuments(docsResult.documents ?? []);
    setLoading(false);
  }

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      if (data.user) setUser(data.user);
      loadDocuments();
    });
  }, []);

  async function handleUploadAll(event: React.FormEvent) {
    event.preventDefault();
    setUploading(true);
    setError('');
    setMessage('');

    const { data: { session } } = await supabase.auth.getSession();
    const tenantId = session?.user?.user_metadata?.tenant_id;
    const headers: Record<string, string> = { 'Content-Type': 'application/json' };
    if (session?.access_token) headers.Authorization = `Bearer ${session.access_token}`;

    const uploadFile = async (file: File | null, type: string, name: string) => {
      if (!file) return;
      const formData = new FormData();
      formData.append('file', file);
      formData.append('documentType', type);
      formData.append('documentName', name);
      if (tenantId) formData.append('tenantId', tenantId);

      const response = await fetch('/api/documents', {
        method: 'POST',
        body: formData,
        headers: session?.access_token ? { Authorization: `Bearer ${session.access_token}` } : undefined,
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.message ?? `Failed to upload ${name}`);
    };

    try {
      if (signedAgreement) {
        await uploadFile(signedAgreement, 'signed_agreement', 'Signed Agreement');
      }
      if (idDocument) {
        await uploadFile(idDocument, 'id_document', 'ID Document');
      }
      if (passportPhoto && tenantId) {
        const formData = new FormData();
        formData.append('file', passportPhoto);
        formData.append('documentType', 'id_document');
        formData.append('documentName', 'Passport Photo');
        formData.append('tenantId', tenantId);
        
        const response = await fetch('/api/documents', {
          method: 'POST',
          body: formData,
          headers: session?.access_token ? { Authorization: `Bearer ${session.access_token}` } : undefined,
        });
        const result = await response.json();
        if (!response.ok) throw new Error(result.message ?? 'Failed to upload Passport Photo');
      }
      setMessage('Documents uploaded successfully.');
      setSignedAgreement(null);
      setIdDocument(null);
      setPassportPhoto(null);
      loadDocuments();
    } catch (err: any) {
      setError(err.message || 'Upload failed.');
    } finally {
      setUploading(false);
    }
  }

  if (loading) {
    return (
      <main className="container page-layout">
        <div className="card">Loading documents…</div>
      </main>
    );
  }

  return (
    <main className="container page-layout">
      <div className="card-admin-header">
        <div><p className="heading">Documents</p><p className="subheading">View agreements and submit required documents.</p></div>
      </div>

      {/* Landlord-uploaded agreements */}
      {agreements.length > 0 && (
        <section style={{ marginTop: 24 }}>
          <div className="card">
            <div className="card-label">
              <span className="status-pill status-pending">Awaiting Signature</span>
            </div>
            <h3 style={{ marginBottom: 12 }}>{agreements[0].document_name}</h3>
            <a href={agreements[0].document_url} target="_blank" rel="noopener noreferrer" className="action-button primary" style={{ marginBottom: 12 }}>
              Download Agreement
            </a>
            <p style={{ fontSize: '12px', color: 'var(--ink-3)', marginTop: 8 }}>
              Download, print, sign, and upload the signed copy below.
            </p>
          </div>
        </section>
      )}

      {agreements.length === 0 && (
        <section style={{ marginTop: 24 }}>
          <div className="card">
            <p className="landlord-empty">No agreement assigned yet. Contact your landlord.</p>
          </div>
        </section>
      )}

      {/* Upload signed documents */}
      <section className="card" style={{ marginTop: 24 }}>
        <div className="card-label">
          <span className="badge badge-pm">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>
          </span>Upload Signed Documents
        </div>
        <h3 style={{ marginBottom: 12 }}>Submit Required Documents</h3>

        <form onSubmit={handleUploadAll} className="form-grid">
          <div>
            <label style={{ fontSize: '12px', fontWeight: 600 }}>Signed Agreement (PDF/Image) *</label>
            <input type="file" accept=".pdf,.jpg,.jpeg,.png" onChange={e => setSignedAgreement(e.target.files?.[0] ?? null)} required />
          </div>
          <div>
            <label style={{ fontSize: '12px', fontWeight: 600 }}>ID Document (PDF/Image)</label>
            <input type="file" accept=".pdf,.jpg,.jpeg,.png" onChange={e => setIdDocument(e.target.files?.[0] ?? null)} />
          </div>
          <div>
            <label style={{ fontSize: '12px', fontWeight: 600 }}>Passport Photo (JPG/PNG) - Will be used as profile picture</label>
            <input type="file" accept=".jpg,.jpeg,.png" onChange={e => setPassportPhoto(e.target.files?.[0] ?? null)} />
          </div>
          <button type="submit" disabled={uploading} style={{ gridColumn: 'span 2' }}>
            {uploading ? 'Uploading…' : 'Upload All Documents'}
          </button>
        </form>

        {message && <p className="landlord-success" style={{ marginTop: 16 }}>{message}</p>}
        {error && <p className="landlord-error" style={{ marginTop: 16 }}>{error}</p>}
      </section>

      {/* Existing documents */}
      <section className="card" style={{ marginTop: 24 }}>
        <div className="card-label">Your Submitted Documents</div>
        <h3 style={{ marginBottom: 12 }}>Document Status</h3>
        {documents.length === 0 && <p>No documents uploaded yet.</p>}
        {documents.length > 0 && (
          <div className="table-shell">
            <table className="landlord-table">
              <thead><tr><th>Document Type</th><th>Date</th></tr></thead>
              <tbody>
                {documents.map(d => (
                  <tr key={d.id}>
                    <td>{d.document_type === 'id_front' ? 'National ID (Front)' : 
                         d.document_type === 'id_back' ? 'National ID (Back)' :
                         d.document_type === 'kra_pin' ? 'KRA PIN' :
                         d.document_type === 'kin_id' ? 'Next of Kin ID' :
                         d.document_type === 'tenant_photo' ? 'Tenant Picture' :
                         d.document_type.replace('_', ' ')}</td>
                    <td>{new Date(d.created_at).toLocaleDateString()}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </main>
  );
}