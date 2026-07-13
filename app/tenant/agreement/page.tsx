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

export default function TenantDocumentsPage() {
  const [user, setUser] = useState<any>(null);
  const [documents, setDocuments] = useState<AgreementDocument[]>([]);
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
    if (!session?.user?.user_metadata?.tenant_id) {
      setLoading(false);
      return;
    }
    const response = await fetch(`/api/documents?tenantId=${session.user.user_metadata.tenant_id}`, {
      headers: session.access_token ? { Authorization: `Bearer ${session.access_token}` } : undefined,
    });
    const result = await response.json();
    if (response.ok) setDocuments(result.documents ?? []);
    setLoading(false);
  }

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      if (data.user) setUser(data.user);
      loadDocuments();
    });
  }, []);

  async function handleUploadSignedDocs(event: React.FormEvent) {
    event.preventDefault();
    setUploading(true);
    setError('');
    setMessage('');

    if (!signedAgreement) {
      setError('Signed agreement is required.');
      setUploading(false);
      return;
    }

    const { data: { session } } = await supabase.auth.getSession();
    const tenantId = session?.user?.user_metadata?.tenant_id;

    // Upload all files using multipart form data
    const uploadFile = async (file: File, type: string, name: string) => {
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
      return result;
    };

    try {
      // Upload signed agreement
      await uploadFile(signedAgreement, 'signed_agreement', 'Signed Agreement');

      // Upload ID document if provided
      if (idDocument) {
        await uploadFile(idDocument, 'id_document', 'ID Document');
      }

      // Upload passport photo if provided
      if (passportPhoto) {
        await uploadFile(passportPhoto, 'id_document', 'Passport Photo');
      }

      setMessage('All documents uploaded successfully.');
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

  const agreementDocs = documents.filter(d => d.document_type === 'agreement');
  const signedAgreementDocs = documents.filter(d => d.document_type === 'signed_agreement');
  const idDocs = documents.filter(d => d.document_type === 'id_document');

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
        <div>
          <p className="heading">Tenancy Agreement</p>
          <p className="subheading">View and sign your rental agreement.</p>
        </div>
      </div>

      {loading ? <p>Loading documents…</p> : (
        <>
          {agreementDocs.length > 0 && (
            <section style={{ marginTop: 24 }}>
              <article className="card">
                <div className="card-label">
                  <span className="status-pill status-pending">Awaiting Signature</span>
                </div>
                <h3 style={{ marginBottom: 12 }}>{agreementDocs[0].document_name}</h3>
                <a href={agreementDocs[0].document_url} target="_blank" rel="noopener noreferrer" className="action-button primary" style={{ marginBottom: 12 }}>
                  Download Agreement
                </a>
                <p style={{ fontSize: '12px', color: 'var(--ink-3)', marginTop: 8 }}>
                  Download, print, sign, and upload the signed copy below.
                </p>
              </article>
            </section>
          )}

          {agreementDocs.length === 0 && (
            <section className="card" style={{ marginTop: 24 }}>
              <p className="landlord-empty">No agreement assigned yet. Contact your landlord.</p>
            </section>
          )}

          <section className="card" style={{ marginTop: 24 }}>
            <div className="card-label">
              <span className="badge badge-pm">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>
              </span>Upload Signed Documents
            </div>
            <h3 style={{ marginBottom: 12 }}>Submit Required Documents</h3>

            <form onSubmit={handleUploadSignedDocs} style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
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

          <section className="card" style={{ marginTop: 24, overflowX: 'auto' }}>
            <div className="card-label">Your Submitted Documents</div>
            <h3 style={{ marginBottom: 12 }}>Document Status</h3>
            
            {signedAgreementDocs.length === 0 && idDocs.length === 0 ? (
              <p>No documents submitted yet.</p>
            ) : (
              <div className="table-shell" style={{ overflowX: 'auto' }}>
                <table className="landlord-table" style={{ minWidth: '300px', fontSize: '12px' }}>
                  <thead>
                    <tr>
                      <th>Document</th>
                      <th>Status</th>
                      <th>Date</th>
                    </tr>
                  </thead>
                  <tbody>
                    {signedAgreementDocs.map(doc => (
                      <tr key={doc.id}>
                        <td>Signed Agreement</td>
                        <td>
                          <span className={`status-pill ${doc.status === 'signed' ? 'status-pending' : doc.status === 'approved' ? 'status-active' : 'status-pending'}`}>
                            {doc.status === 'signed' ? 'Pending Review' : doc.status === 'approved' ? 'Approved' : doc.status}
                          </span>
                        </td>
                        <td>{new Date(doc.created_at).toLocaleDateString()}</td>
                      </tr>
                    ))}
                    {idDocs.map((doc, i) => (
                      <tr key={doc.id}>
                        <td>{doc.notes?.includes('Photo') ? 'Passport Photo' : 'ID Document'}</td>
                        <td>
                          <span className={`status-pill ${doc.status === 'approved' ? 'status-active' : 'status-pending'}`}>
                            {doc.status === 'approved' ? 'Approved' : 'Pending Review'}
                          </span>
                        </td>
                        <td>{new Date(doc.created_at).toLocaleDateString()}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>
        </>
      )}
    </main>
  );
}