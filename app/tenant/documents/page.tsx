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

interface Bundle {
  id: string;
  status: string;
}

export default function TenantDocumentsPage() {
  const [user, setUser] = useState<any>(null);
  const [agreements, setAgreements] = useState<AgreementDocument[]>([]);
  const [documents, setDocuments] = useState<Document[]>([]);
  const [bundles, setBundles] = useState<Bundle[]>([]);
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
    
    const [agreementsResponse, docsResponse, bundlesResponse] = await Promise.all([
      tenantId ? fetch(`/api/documents?tenantId=${tenantId}`, { headers }).catch(() => null) : null,
      session?.user?.id ? fetch(`/api/tenant/documents?userId=${session.user.id}`, { headers }).catch(() => null) : null,
      tenantId ? fetch(`/api/document-bundles?tenantId=${tenantId}`, { headers }).catch(() => null) : null,
    ]);
    
    const [agreementsResult, docsResult, bundlesResult] = await Promise.all([
      agreementsResponse?.json() ?? Promise.resolve({ documents: [] }),
      docsResponse?.json() ?? Promise.resolve({ documents: [] }),
      bundlesResponse?.json() ?? Promise.resolve({ bundles: [] }),
    ]);
    
    if (agreementsResponse?.ok) setAgreements(agreementsResult.documents ?? []);
    if (docsResponse?.ok) setDocuments(docsResult.documents ?? []);
    if (bundlesResponse?.ok) setBundles(bundlesResult.bundles ?? []);
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

  const FileInput = ({ label, accept, onChange, file }: { 
    label: string; 
    accept: string; 
    onChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
    file: File | null;
  }) => (
    <div style={{ marginBottom: 12 }}>
      <label style={{ fontSize: '12px', fontWeight: 600, display: 'block', marginBottom: 6 }}>{label}</label>
      <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
        <label 
          htmlFor={`file-${label.replace(/\s+/g, '-').toLowerCase()}`}
          style={{
            padding: '8px 12px',
            background: 'var(--line)',
            borderRadius: 6,
            cursor: 'pointer',
            fontSize: '13px',
            whiteSpace: 'nowrap',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            maxWidth: 180,
          }}
        >
          {file ? file.name : 'Choose File'}
        </label>
        <input 
          id={`file-${label.replace(/\s+/g, '-').toLowerCase()}`}
          type="file" 
          accept={accept} 
          onChange={onChange} 
          style={{ display: 'none' }}
        />
        {file && <span style={{ fontSize: '11px', color: 'var(--ink-3)', flex: 1 }}>{Math.round(file.size / 1024)}KB</span>}
      </div>
    </div>
  );

  return (
    <main className="container page-layout" style={{ maxWidth: '100%', padding: '0 8px' }}>
      <div className="card-admin-header">
        <div><p className="heading">Documents</p><p className="subheading">View agreements and submit required documents.</p></div>
      </div>

      {/* Landlord-uploaded agreements (only agreement type, not signed_agreement or id_document) */}
      {agreements.filter(d => d.document_type === 'agreement').length > 0 && (
        <section style={{ marginTop: 24 }}>
          <div className="card">
            <div className="card-label">
              <span className="status-pill status-pending">{agreements[0].status === 'sent' ? 'Awaiting Signature' : agreements[0].status}</span>
            </div>
            <h3 style={{ marginBottom: 12 }}>{agreements.find(d => d.document_type === 'agreement')?.document_name}</h3>
            <a href={agreements.find(d => d.document_type === 'agreement')?.document_url} target="_blank" rel="noopener noreferrer" className="action-button primary" style={{ marginBottom: 12 }}>
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

        <form onSubmit={handleUploadAll} style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          <FileInput 
            label="Signed Agreement (PDF/Image)" 
            accept=".pdf,.jpg,.jpeg,.png" 
            onChange={e => setSignedAgreement(e.target.files?.[0] ?? null)}
            file={signedAgreement}
          />
          <FileInput 
            label="ID Document (PDF/Image)" 
            accept=".pdf,.jpg,.jpeg,.png" 
            onChange={e => setIdDocument(e.target.files?.[0] ?? null)}
            file={idDocument}
          />
          <FileInput 
            label="Passport Photo (JPG/PNG)" 
            accept=".jpg,.jpeg,.png" 
            onChange={e => setPassportPhoto(e.target.files?.[0] ?? null)}
            file={passportPhoto}
          />
          <button type="submit" disabled={uploading} style={{ marginTop: 8 }}>
            {uploading ? 'Uploading…' : 'Upload All Documents'}
          </button>
        </form>

        {message && <p className="landlord-success" style={{ marginTop: 16 }}>{message}</p>}
        {error && <p className="landlord-error" style={{ marginTop: 16 }}>{error}</p>}
      </section>

      {/* Existing documents from agreements table */}
      {(() => {
        const signedAgreementDocs = agreements.filter(d => d.document_type === 'signed_agreement');
        const idDocs = agreements.filter(d => d.document_type === 'id_document');
        const bundle = bundles[0]; // Get the first bundle for this tenant
        const bundleStatus = bundle?.status || null;
        return (
          <section className="card" style={{ marginTop: 24, overflowX: 'auto' }}>
            <div className="card-label">Your Submitted Documents</div>
            <h3 style={{ marginBottom: 12 }}>Document Status</h3>
            {documents.length === 0 && signedAgreementDocs.length === 0 && idDocs.length === 0 && <p>No documents uploaded yet.</p>}
            {(documents.length > 0 || signedAgreementDocs.length > 0 || idDocs.length > 0) && (
              <div className="table-shell" style={{ overflowX: 'auto' }}>
                <table className="landlord-table" style={{ minWidth: '400px', fontSize: '12px' }}>
                  <thead><tr><th>Document</th><th>Status</th><th>Date</th></tr></thead>
                  <tbody>
                    {signedAgreementDocs.map(doc => (
                      <tr key={doc.id}>
                        <td>Signed Agreement</td>
                        <td>
                          <span className={`status-pill ${bundleStatus === 'approved' ? 'status-active' : bundleStatus === 'rejected' ? 'status-pending' : 'status-pending'}`}>
                            {bundleStatus === 'approved' ? 'Approved' : bundleStatus === 'rejected' ? 'Rejected' : 'Pending Review'}
                          </span>
                        </td>
                        <td>{new Date(doc.created_at).toLocaleDateString()}</td>
                      </tr>
                    ))}
                    {idDocs.some(d => d.document_name !== 'Passport Photo') && (
                      <tr>
                        <td>ID Document</td>
                        <td>
                          <span className={`status-pill ${bundleStatus === 'approved' ? 'status-active' : bundleStatus === 'rejected' ? 'status-pending' : 'status-pending'}`}>
                            {bundleStatus === 'approved' ? 'Approved' : bundleStatus === 'rejected' ? 'Rejected' : 'Pending Review'}
                          </span>
                        </td>
                        <td>{idDocs[0]?.created_at ? new Date(idDocs[0].created_at).toLocaleDateString() : '-'}</td>
                      </tr>
                    )}
                    {idDocs.filter(d => d.document_name === 'Passport Photo').length > 0 && (
                      <tr>
                        <td>Passport Photo</td>
                        <td>
                          <span className={`status-pill ${bundleStatus === 'approved' ? 'status-active' : bundleStatus === 'rejected' ? 'status-pending' : 'status-pending'}`}>
                            {bundleStatus === 'approved' ? 'Approved' : bundleStatus === 'rejected' ? 'Rejected' : 'Pending Review'}
                          </span>
                        </td>
                        <td>{idDocs.find(d => d.document_name === 'Passport Photo')?.created_at ? new Date(idDocs.find(d => d.document_name === 'Passport Photo')!.created_at).toLocaleDateString() : '-'}</td>
                      </tr>
                    )}
                    {documents.map(d => (
                      <tr key={d.id}>
                        <td>{d.document_type === 'id_front' ? 'National ID (Front)' : 
                             d.document_type === 'id_back' ? 'National ID (Back)' :
                             d.document_type === 'kra_pin' ? 'KRA PIN' :
                             d.document_type === 'kin_id' ? 'Next of Kin ID' :
                             d.document_type === 'tenant_photo' ? 'Tenant Picture' :
                             d.document_type.replace('_', ' ')}</td>
                        <td>-</td>
                        <td>{new Date(d.created_at).toLocaleDateString()}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>
        );
      })()}
    </main>
  );
}