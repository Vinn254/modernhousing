'use client';

import { useEffect, useState } from 'react';
import { supabase } from '../../../lib/supabaseClient';
import { generateAgreementPdf, downloadBlob, type AgreementItem } from '../../../lib/agreementPdf';
import AgreementItemsTable from '../../components/AgreementItemsTable';
import { rentTypeDefinition, rentTypeLabel } from '../../../lib/rentTypes';

interface AgreementDocument {
  id: string;
  document_name: string;
  document_url: string;
  document_type: string;
  status: string;
  notes?: string;
  created_at: string;
}

interface MyAgreement {
  id: string;
  title: string;
  description?: string | null;
  rent_type?: string | null;
  selected_item_ids: string[];
  tenant_checks: string[];
  tenant_acknowledged: boolean;
  status: string;
  submitted_at?: string | null;
  items?: AgreementItem[];
  tenant_name?: string;
  tenant_email?: string;
  tenant_phone?: string;
  tenant_national_id?: string;
  tenant_kra_pin?: string;
  tenant_address?: string;
  unit_number?: string;
  property_name?: string;
  tenant_picture_url?: string;
}

export default function TenantDocumentsPage() {
  const [user, setUser] = useState<any>(null);
  const [documents, setDocuments] = useState<AgreementDocument[]>([]);
  const [bundles, setBundles] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  
  const [signedAgreement, setSignedAgreement] = useState<File | null>(null);
  const [idDocument, setIdDocument] = useState<File | null>(null);
  const [passportPhoto, setPassportPhoto] = useState<File | null>(null);
  const [nextOfKinId, setNextOfKinId] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);

  // Tenancy agreement (builder flow)
  const [myAgreements, setMyAgreements] = useState<MyAgreement[]>([]);
  const [checkedItems, setCheckedItems] = useState<Record<string, string[]>>({});
  const [acknowledged, setAcknowledged] = useState<Record<string, boolean>>({});
  const [submittingId, setSubmittingId] = useState<string | null>(null);
  const [agreementError, setAgreementError] = useState('');
  const [agreementMessage, setAgreementMessage] = useState('');

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
    
    const [docsResponse, bundlesResponse, agreementsResponse] = await Promise.all([
      session?.user?.id ? fetch(`/api/documents?tenantId=${tenantId}`, { headers }).catch(() => null) : null,
      tenantId ? fetch(`/api/document-bundles?tenantId=${tenantId}`, { headers }).catch(() => null) : null,
      fetch('/api/agreements', { headers }).catch(() => null),
    ]);
    
    const [docsResult, bundlesResult, agreementsResult] = await Promise.all([
      docsResponse?.json() ?? Promise.resolve({ documents: [] }),
      bundlesResponse?.json() ?? Promise.resolve({ bundles: [] }),
      agreementsResponse?.json() ?? Promise.resolve({ agreements: [] }),
    ]);
    
    if (docsResponse?.ok) setDocuments(docsResult.documents ?? []);
    if (bundlesResponse?.ok) setBundles(bundlesResult.bundles ?? []);
    const ags: MyAgreement[] = agreementsResult.agreements ?? [];
    setMyAgreements(ags);
    setCheckedItems((prev) => {
      const next = { ...prev };
      ags.forEach((a) => { if (!next[a.id]) next[a.id] = a.tenant_checks ?? []; });
      return next;
    });
    setAcknowledged((prev) => {
      const next = { ...prev };
      ags.forEach((a) => { if (next[a.id] === undefined) next[a.id] = !!a.tenant_acknowledged; });
      return next;
    });
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

      // Upload next of kin ID if provided
      if (nextOfKinId) {
        await uploadFile(nextOfKinId, 'kin_id', 'Next of Kin ID');
      }

      setMessage('All documents uploaded successfully.');
      setSignedAgreement(null);
      setIdDocument(null);
      setPassportPhoto(null);
      setNextOfKinId(null);
      loadDocuments();
    } catch (err: any) {
      setError(err.message || 'Upload failed.');
    } finally {
      setUploading(false);
    }
  }

  function toggleItem(agreementId: string, itemId: string) {
    setCheckedItems((prev) => {
      const cur = prev[agreementId] ?? [];
      return { ...prev, [agreementId]: cur.includes(itemId) ? cur.filter((x) => x !== itemId) : [...cur, itemId] };
    });
  }

  async function submitAgreement(ag: MyAgreement) {
    setAgreementError('');
    setAgreementMessage('');
    const selected = ag.items ?? [];
    const checks = checkedItems[ag.id] ?? [];
    const allChecked = selected.every((i) => checks.includes(i.id));
    if (!allChecked) { setAgreementError('Please tick every item before submitting.'); return; }
    if (!acknowledged[ag.id]) { setAgreementError('You must acknowledge the agreement before submitting.'); return; }
    setSubmittingId(ag.id);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const headers: Record<string, string> = { 'Content-Type': 'application/json' };
      if (session?.access_token) headers.Authorization = `Bearer ${session.access_token}`;
      const response = await fetch('/api/agreements', {
        method: 'PATCH',
        headers,
        body: JSON.stringify({ id: ag.id, action: 'submit', tenantChecks: checks, acknowledged: true }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.message ?? 'Unable to submit agreement.');
      setAgreementMessage('Agreement submitted to your landlord.');
      loadDocuments();
    } catch (err: any) {
      setAgreementError(err.message);
    } finally {
      setSubmittingId(null);
    }
  }

  async function downloadMyAgreement(ag: MyAgreement) {
    setAgreementError('');
    try {
      const blob = await generateAgreementPdf({
        title: ag.title,
        description: ag.description,
        rent_type: ag.rent_type,
        items: ag.items ?? [],
        tenant_checks: checkedItems[ag.id] ?? ag.tenant_checks ?? [],
        tenant_name: ag.tenant_name,
        tenant_email: ag.tenant_email,
        tenant_phone: ag.tenant_phone,
        tenant_national_id: ag.tenant_national_id,
        tenant_kra_pin: ag.tenant_kra_pin,
        tenant_address: ag.tenant_address,
        unit_number: ag.unit_number,
        property_name: ag.property_name,
        tenant_picture_url: ag.tenant_picture_url,
        submitted_at: ag.submitted_at,
      });
      downloadBlob(blob, `tenancy-agreement-${(ag.tenant_name || 'tenant').replace(/[^a-z0-9]+/gi, '-').toLowerCase()}.pdf`);
    } catch (err: any) {
      setAgreementError(err.message ?? 'Unable to generate PDF.');
    }
  }

  const agreementDocs = documents.filter(d => d.document_type === 'agreement');
  const signedAgreementDocs = documents.filter(d => d.document_type === 'signed_agreement');
  const idDocs = documents.filter(d => d.document_type === 'id_document');
  const kinIdDocs = documents.filter(d => d.document_type === 'kin_id');
  const bundle = bundles[0];

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
            maxWidth: 180
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
    <main className="container page-layout admin-no-hero role-tenant">
      <div className="card-admin-header">
        <div>
          <p className="heading">Tenancy Agreement</p>
          <p className="subheading">View and sign your rental agreement.</p>
        </div>
      </div>

      {loading ? <p>Loading documents…</p> : (
        <>
            {myAgreements.length > 0 && (
              <section style={{ marginTop: 24, display: 'flex', flexDirection: 'column', gap: 20 }}>
                {myAgreements.map((ag) => {
                  const items = ag.items ?? [];
                  const checks = checkedItems[ag.id] ?? [];
                  const allChecked = items.length > 0 && items.every((i) => checks.includes(i.id));
                  const isSent = ag.status === 'sent' || ag.status === 'draft';
                  return (
                    <article key={ag.id} className="card card-tint--teal">
                      <div className="card-label">
                        <span className={`status-pill ${ag.status === 'submitted' ? 'status-pending' : ag.status === 'reviewed' || ag.status === 'completed' ? 'status-active' : 'status-pending'}`} style={{ textTransform: 'capitalize' }}>
                          {ag.status}
                        </span>
                      </div>
                      <h3 style={{ marginBottom: 8 }}>{ag.title}</h3>

                      {ag.rent_type && (
                        <p style={{ fontSize: '12px', marginBottom: 10 }}>
                          <strong>Rent payment type:</strong> {rentTypeLabel(ag.rent_type)}
                          {rentTypeDefinition(ag.rent_type) ? ` — ${rentTypeDefinition(ag.rent_type)}` : ''}
                        </p>
                      )}

                      {ag.description && (
                        <div className="agreement-body">
                          <p className="agreement-body-label">Agreement</p>
                          <p className="agreement-body-text">{ag.description}</p>
                        </div>
                      )}

                      <p style={{ fontSize: '12px', fontWeight: 600, marginBottom: 8 }}>
                        {isSent ? 'Tick every row below to confirm you have read and accepted it.' : 'Items confirmed for this agreement:'}
                      </p>

                      <AgreementItemsTable
                        items={items}
                        mode="confirm"
                        checked={checks}
                        onToggle={(itemId) => toggleItem(ag.id, itemId)}
                        disabled={!isSent}
                      />

                      {isSent && (
                        <label className="agreement-ack">
                          <input
                            type="checkbox"
                            checked={!!acknowledged[ag.id]}
                            onChange={(e) => setAcknowledged((prev) => ({ ...prev, [ag.id]: e.target.checked }))}
                          />
                          <span>I acknowledge that I have read and understood this tenancy agreement in its entirety.</span>
                        </label>
                      )}

                      <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
                        {isSent && (
                          <button
                            type="button"
                            className="action-button primary"
                            disabled={submittingId === ag.id || !allChecked || !acknowledged[ag.id]}
                            onClick={() => submitAgreement(ag)}
                          >
                            {submittingId === ag.id ? 'Submitting…' : 'Submit to Landlord'}
                          </button>
                        )}
                        <button type="button" className="action-button secondary" onClick={() => downloadMyAgreement(ag)}>Download PDF</button>
                      </div>

                      {!isSent && ag.submitted_at && (
                        <p style={{ fontSize: '11px', color: 'var(--ink-3)', marginTop: 12 }}>
                          Submitted {new Date(ag.submitted_at).toLocaleString('en-GB')}. Awaiting landlord review.
                        </p>
                      )}
                      {isSent && !allChecked && (
                        <p style={{ fontSize: '11px', color: 'var(--ink-3)', marginTop: 12 }}>Tick all items and acknowledge to enable submission.</p>
                      )}
                    </article>
                  );
                })}
                {agreementMessage && <p className="landlord-success">{agreementMessage}</p>}
                {agreementError && <p className="landlord-error">{agreementError}</p>}
              </section>
            )}

            {agreementDocs.length > 0 && (
              <section style={{ marginTop: 24 }}>
                <article className="card card-tint--teal">
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

            {agreementDocs.length === 0 && myAgreements.length === 0 && (
              <section className="card card-tint--amber" style={{ marginTop: 24 }}>
                <p className="landlord-empty">No agreement assigned yet. Contact your landlord.</p>
              </section>
            )}

            <section className="card card-tint--blue" style={{ marginTop: 24 }}>
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
              <FileInput 
                label="Next of Kin ID (PDF/Image)" 
                accept=".pdf,.jpg,.jpeg,.png" 
                onChange={e => setNextOfKinId(e.target.files?.[0] ?? null)}
                file={nextOfKinId}
              />
              <button type="submit" disabled={uploading} style={{ marginTop: 8 }}>
                {uploading ? 'Uploading…' : 'Upload All Documents'}
              </button>
            </form>

            {message && <p className="landlord-success" style={{ marginTop: 16 }}>{message}</p>}
            {error && <p className="landlord-error" style={{ marginTop: 16 }}>{error}</p>}
          </section>

            <section className="card card-tint--rose" style={{ marginTop: 24, overflowX: 'auto' }}>
            <div className="card-label">Your Submitted Documents</div>
            <h3 style={{ marginBottom: 12 }}>Document Status</h3>
            
            {signedAgreementDocs.length === 0 && idDocs.length === 0 && kinIdDocs.length === 0 ? (
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
                    {kinIdDocs.map(doc => (
                      <tr key={doc.id}>
                        <td>Next of Kin ID</td>
                        <td>-</td>
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