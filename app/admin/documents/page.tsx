'use client';

import { useEffect, useState } from 'react';
import { supabase } from '../../../lib/supabaseClient';
import { generateAgreementPdf, downloadBlob, type AgreementItem } from '../../../lib/agreementPdf';
import { DEFAULT_AGREEMENT_DESCRIPTION } from '../../../lib/leaseText';
import AgreementItemsTable from '../../components/AgreementItemsTable';

interface Tenant {
  id: string;
  full_name: string;
  email: string;
  property: string;
  unit: string;
}

interface Agreement {
  id: string;
  tenant_id: string;
  property_id?: string | null;
  title: string;
  description?: string | null;
  selected_item_ids: string[];
  tenant_checks: string[];
  tenant_acknowledged: boolean;
  tenant_notes?: string | null;
  status: string;
  submitted_at?: string | null;
  created_at: string;
  tenant_name?: string;
  tenant_email?: string;
  tenant_phone?: string;
  tenant_national_id?: string;
  tenant_kra_pin?: string;
  tenant_picture_url?: string;
  tenant_address?: string;
  unit_number?: string;
  property_name?: string;
  items?: AgreementItem[];
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

interface Bundle {
  id: string;
  tenant_id: string;
  tenant_name?: string;
  property_name?: string;
  status: string;
  signed_agreement_url?: string;
  id_document_url?: string;
  passport_photo_url?: string;
  created_at: string;
}

export default function LandlordDocumentsPage() {
  const [documents, setDocuments] = useState<Document[]>([]);
  const [bundles, setBundles] = useState<Bundle[]>([]);
  const [tenants, setTenants] = useState<Tenant[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  
  const [documentFile, setDocumentFile] = useState<File | null>(null);
  const [uploadForm, setUploadForm] = useState({
    tenantId: '',
    documentName: '',
    documentType: 'agreement',
    notes: '',
  });
  const [uploading, setUploading] = useState(false);

  // Tenancy agreement builder
  const [itemLibrary, setItemLibrary] = useState<AgreementItem[]>([]);
  const [agreements, setAgreements] = useState<Agreement[]>([]);
  const [builderTenantId, setBuilderTenantId] = useState('');
  const [builderTitle, setBuilderTitle] = useState('Tenancy Agreement');
  const [builderDescription, setBuilderDescription] = useState(DEFAULT_AGREEMENT_DESCRIPTION);
  const [builderSelected, setBuilderSelected] = useState<string[]>([]);
  const [builderBusy, setBuilderBusy] = useState(false);
  const [expandedAgreement, setExpandedAgreement] = useState<string | null>(null);
  const [pdfBusyId, setPdfBusyId] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editTitle, setEditTitle] = useState('');
  const [editDescription, setEditDescription] = useState('');
  const [editItems, setEditItems] = useState<string[]>([]);
  const [editBusy, setEditBusy] = useState(false);

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
      const [docsResponse, bundlesResponse, tenantsResponse, itemsResponse, agreementsResponse] = await Promise.all([
        fetch('/api/documents', { headers: await getAuthHeaders() }),
        fetch('/api/document-bundles', { headers: await getAuthHeaders() }).catch(() => null),
        fetch('/api/tenants', { headers: await getAuthHeaders() }),
        fetch('/api/agreement-items', { headers: await getAuthHeaders() }).catch(() => null),
        fetch('/api/agreements', { headers: await getAuthHeaders() }).catch(() => null),
      ]);

      const docsResult = await docsResponse.json();
      const bundlesResult = bundlesResponse ? await bundlesResponse.json() : { bundles: [] };
      const tenantsResult = await tenantsResponse.json();
      const itemsResult = itemsResponse ? await itemsResponse.json() : { items: [] };
      const agreementsResult = agreementsResponse ? await agreementsResponse.json() : { agreements: [] };

      setDocuments(docsResult.documents ?? []);
      setBundles(bundlesResult.bundles ?? []);
      setTenants(tenantsResult.tenants ?? []);
      setItemLibrary(itemsResult.items ?? []);
      setAgreements(agreementsResult.agreements ?? []);
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
    } catch (err: any) {
      setError(err.message);
    } finally {
      setUploading(false);
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

  async function handleApproveBundle(bundleId: string) {
    const response = await fetch('/api/document-bundles', {
      method: 'PATCH',
      headers: await getAuthHeaders(),
      body: JSON.stringify({ id: bundleId, status: 'approved' }),
    });

    const result = await response.json();
    if (response.ok) {
      setMessage('Bundle approved.');
      loadData();
    } else {
      setError(result.message ?? 'Unable to approve bundle.');
    }
  }

  async function handleRejectBundle(bundleId: string) {
    if (!confirm('Reject this bundle?')) return;
    const response = await fetch('/api/document-bundles', {
      method: 'PATCH',
      headers: await getAuthHeaders(),
      body: JSON.stringify({ id: bundleId, status: 'rejected' }),
    });

    const result = await response.json();
    if (response.ok) {
      setMessage('Bundle rejected.');
      loadData();
    } else {
      setError(result.message ?? 'Unable to reject bundle.');
    }
  }

  const toggleBuilderItem = (itemId: string) => {
    setBuilderSelected((prev) => prev.includes(itemId) ? prev.filter((x) => x !== itemId) : [...prev, itemId]);
  };

  const toggleBuilderCategory = (category: string) => {
    const ids = itemLibrary.filter((i) => i.category === category).map((i) => i.id);
    const allSelected = ids.every((id) => builderSelected.includes(id));
    setBuilderSelected((prev) => allSelected ? prev.filter((x) => !ids.includes(x)) : Array.from(new Set([...prev, ...ids])));
  };

  function resetBuilder() {
    setBuilderTenantId('');
    setBuilderTitle('Tenancy Agreement');
    setBuilderDescription(DEFAULT_AGREEMENT_DESCRIPTION);
    setBuilderSelected([]);
  }

  async function saveAgreement(send: boolean) {
    setMessage('');
    setError('');
    if (!builderTenantId) { setError('Select a tenant for the agreement.'); return; }
    if (builderSelected.length === 0) { setError('Select at least one agreement item.'); return; }
    setBuilderBusy(true);
    try {
      const targetTenantIds = builderTenantId === 'all' ? tenants.map((t) => t.id) : [builderTenantId];
      if (targetTenantIds.length === 0) { setError('No tenants available.'); return; }

      let failures = 0;
      for (const tid of targetTenantIds) {
        const response = await fetch('/api/agreements', {
          method: 'POST',
          headers: await getAuthHeaders(),
          body: JSON.stringify({
            tenantId: tid,
            title: builderTitle,
            description: builderDescription,
            selectedItemIds: builderSelected,
            send,
          }),
        });
        if (!response.ok) failures++;
      }

      if (failures === targetTenantIds.length) {
        throw new Error('Unable to save agreement for the selected tenant(s).');
      }
      const scope = targetTenantIds.length > 1 ? `${targetTenantIds.length} tenants` : 'tenant';
      setMessage(send ? `Agreement sent to ${scope}.` : `Draft saved for ${scope}.`);
      if (failures > 0) setError(`${failures} of ${targetTenantIds.length} could not be saved.`);
      resetBuilder();
      loadData();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setBuilderBusy(false);
    }
  }

  async function reviewAgreement(id: string, completed: boolean) {
    setMessage('');
    setError('');
    const response = await fetch('/api/agreements', {
      method: 'PATCH',
      headers: await getAuthHeaders(),
      body: JSON.stringify({ id, action: 'review', completed }),
    });
    const result = await response.json();
    if (!response.ok) { setError(result.message ?? 'Unable to update agreement.'); return; }
    setMessage(`Agreement marked as ${completed ? 'completed' : 'reviewed'}.`);
    loadData();
  }

  function startEditAgreement(agreement: Agreement) {
    setError('');
    setMessage('');
    setEditingId(agreement.id);
    setEditTitle(agreement.title);
    setEditDescription(agreement.description ?? '');
    setEditItems(agreement.selected_item_ids ?? []);
  }

  function toggleEditItem(itemId: string) {
    setEditItems((prev) => (prev.includes(itemId) ? prev.filter((x) => x !== itemId) : [...prev, itemId]));
  }

  async function saveAgreementEdits() {
    if (!editingId) return;
    setEditBusy(true);
    setError('');
    setMessage('');
    try {
      const response = await fetch('/api/agreements', {
        method: 'PATCH',
        headers: await getAuthHeaders(),
        body: JSON.stringify({
          id: editingId,
          action: 'update',
          title: editTitle,
          description: editDescription,
          selectedItemIds: editItems,
        }),
      });
      const result = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(result.message ?? 'Unable to update agreement.');
      setMessage('Agreement updated.');
      setEditingId(null);
      await loadData();
    } catch (e: any) {
      setError(e.message ?? 'Unable to update agreement.');
    } finally {
      setEditBusy(false);
    }
  }

  async function deleteAgreement(id: string) {
    if (!confirm('Delete this agreement?')) return;
    const response = await fetch('/api/agreements', {
      method: 'DELETE',
      headers: await getAuthHeaders(),
      body: JSON.stringify({ id }),
    });
    const result = await response.json();
    if (!response.ok) { setError(result.message ?? 'Unable to delete agreement.'); return; }
    setMessage('Agreement deleted.');
    loadData();
  }

  async function downloadAgreementPdf(agreement: Agreement) {
    setPdfBusyId(agreement.id);
    setError('');
    try {
      const blob = await generateAgreementPdf({
        title: agreement.title,
        description: agreement.description,
        items: agreement.items ?? itemLibrary.filter((i) => agreement.selected_item_ids.includes(i.id)),
        tenant_checks: agreement.tenant_checks ?? [],
        tenant_name: agreement.tenant_name,
        tenant_email: agreement.tenant_email,
        tenant_phone: agreement.tenant_phone,
        tenant_national_id: agreement.tenant_national_id,
        tenant_kra_pin: agreement.tenant_kra_pin,
        tenant_address: agreement.tenant_address,
        unit_number: agreement.unit_number,
        property_name: agreement.property_name,
        tenant_picture_url: agreement.tenant_picture_url,
        submitted_at: agreement.submitted_at,
      });
      const safeName = (agreement.tenant_name || 'tenant').replace(/[^a-z0-9]+/gi, '-').toLowerCase();
      downloadBlob(blob, `tenancy-agreement-${safeName}.pdf`);
    } catch (err: any) {
      setError(err.message ?? 'Unable to generate PDF.');
    } finally {
      setPdfBusyId(null);
    }
  }

  const agreementStatusBadge = (status: string) => {
    const styles: Record<string, string> = {
      draft: 'status-pending',
      sent: 'status-pending',
      submitted: 'status-pending',
      reviewed: 'status-active',
      completed: 'status-active',
    };
    return styles[status] || '';
  };

  const libraryCategories = Array.from(new Set(itemLibrary.map((i) => i.category))).sort((a, b) => {
    const first = (c: string) => itemLibrary.find((i) => i.category === c)?.sort_order ?? 0;
    return first(a) - first(b);
  });

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

  const FileInput = ({ label, accept, onChange, file }: { 
    label: string; 
    accept: string; 
    onChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
    file: File | null;
  }) => (
    <div style={{ marginBottom: 12, minWidth: 0 }}>
      <label style={{ fontSize: '12px', fontWeight: 600, display: 'block', marginBottom: 6 }}>{label}</label>
      <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap', minWidth: 0 }}>
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
            flex: 1,
            minWidth: 0,
            maxWidth: '100%'
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
        {file && <span style={{ fontSize: '11px', color: 'var(--ink-3)', flexShrink: 0 }}>{Math.round(file.size / 1024)}KB</span>}
      </div>
    </div>
  );

  return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
      <main className="container admin-no-hero role-landlord">
        <div className="card-admin-header">
          <div>
            <p className="heading">Tenancy Agreement</p>
            <p className="subheading">Upload rental agreements and review signed documents.</p>
          </div>
        </div>

    <section className="card-grid">
          <article className="card card-tint--teal" style={{ gridColumn: '1 / -1' }}>
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
              <input value={uploadForm.documentName} onChange={e => setUploadForm(f => ({ ...f, documentName: e.target.value }))} placeholder="Document name (e.g., Tenancy Agreement)" required style={{ width: '100%' }} />
              <select value={uploadForm.documentType} onChange={e => setUploadForm(f => ({ ...f, documentType: e.target.value }))} style={{ width: '100%' }}>
                <option value="agreement">Agreement</option>
              </select>
              <div className="field-group" style={{ minWidth: 0 }}>
                <label style={{ fontSize: '12px', color: 'var(--ink-2)' }}>Agreement File</label>
                <FileInput 
                  label="Choose File" 
                  accept=".pdf,.doc,.docx,.jpg,.jpeg,.png" 
                  onChange={e => {
                    const file = e.target.files?.[0] ?? null;
                    setDocumentFile(file);
                    if (file && !uploadForm.documentName) setUploadForm(f => ({ ...f, documentName: 'Tenancy Agreement' }));
                  }}
                  file={documentFile}
                />
              </div>
              <input value={uploadForm.notes} onChange={e => setUploadForm(f => ({ ...f, notes: e.target.value }))} placeholder="Notes (optional)" className="field-group-wide" style={{ width: '100%' }} />
              <button type="submit" disabled={uploading} style={{ width: '100%' }}>Upload & Assign</button>
            </form>
            <p style={{ fontSize: '11px', color: 'var(--ink-3)', marginTop: 8 }}>Upload agreement PDF and assign to tenant.</p>
          </article>

          {/* Tenancy Agreement Builder */}
          <article className="card card-tint--neutral card-full">
            <div className="card-label">
              <span className="badge badge-pm">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M12 20h9"/><path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4Z"/></svg>
              </span>Agreement Builder
            </div>
            <h3 style={{ marginBottom: 8 }}>Build a Tenancy Agreement</h3>
            <p style={{ fontSize: '12px', color: 'var(--ink-2)', marginBottom: 20 }}>
              Write the agreement description, then pick the items the tenant must check. The tenant ticks each item,
              acknowledges and submits it back to you for review.
            </p>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: 16, marginBottom: 16 }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6, minWidth: 0 }}>
                <label style={{ fontSize: '12px', fontWeight: 600, color: 'var(--ink-2)' }}>Tenant</label>
                <select value={builderTenantId} onChange={(e) => setBuilderTenantId(e.target.value)} style={{ width: '100%', minWidth: 0 }}>
                  <option value="">Select tenant</option>
                  <option value="all">All Tenants</option>
                  {tenants.map((t) => <option key={t.id} value={t.id}>{t.full_name} - {t.property} · Unit {t.unit}</option>)}
                </select>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6, minWidth: 0 }}>
                <label style={{ fontSize: '12px', fontWeight: 600, color: 'var(--ink-2)' }}>Agreement title</label>
                <input value={builderTitle} onChange={(e) => setBuilderTitle(e.target.value)} placeholder="Tenancy Agreement" style={{ width: '100%', minWidth: 0 }} />
              </div>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginBottom: 20 }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, flexWrap: 'wrap' }}>
                <label style={{ fontSize: '12px', fontWeight: 600, color: 'var(--ink-2)' }}>Description — wording from the Springfield rental lease</label>
                <button type="button" className="action-button secondary" style={{ padding: '4px 10px', fontSize: '11px' }} onClick={() => setBuilderDescription(DEFAULT_AGREEMENT_DESCRIPTION)}>
                  Restore lease wording
                </button>
              </div>
              <textarea
                value={builderDescription}
                onChange={(e) => setBuilderDescription(e.target.value)}
                rows={14}
                placeholder="The tenancy description shown to the tenant..."
                style={{ width: '100%', minWidth: 0, padding: 10, borderRadius: 8, border: '1px solid var(--line)', fontFamily: 'inherit', fontSize: '13px', lineHeight: 1.55 }}
              />
              <p style={{ fontSize: '11px', color: 'var(--ink-3)' }}>
                Pre-filled from the signed lease. Edit only the party-specific details (names, ID numbers, rent, dates) before sending.
              </p>
            </div>

            <div className="builder-items-head">
              <label style={{ fontSize: '13px', fontWeight: 700 }}>Checklist items ({builderSelected.length} of {itemLibrary.length} selected)</label>
              <div className="builder-items-actions">
                {libraryCategories.map((category) => {
                  const ids = itemLibrary.filter((i) => i.category === category).map((i) => i.id);
                  const selectedCount = ids.filter((id) => builderSelected.includes(id)).length;
                  const allSelected = ids.length > 0 && selectedCount === ids.length;
                  return (
                    <button
                      key={category}
                      type="button"
                      className="action-button secondary"
                      onClick={() => toggleBuilderCategory(category)}
                    >
                      {allSelected ? 'Remove ' : 'Add '}
                      {category.replace(/^Property Condition\s*-\s*/i, '')} ({selectedCount}/{ids.length})
                    </button>
                  );
                })}
                <button type="button" onClick={() => setBuilderSelected(itemLibrary.map((i) => i.id))} className="action-button secondary">Select all</button>
                <button type="button" onClick={() => setBuilderSelected([])} className="action-button secondary">Clear</button>
              </div>
            </div>

            <div className="agreement-library">
              {itemLibrary.length === 0 && <p className="landlord-muted">Loading item library…</p>}
              {itemLibrary.length > 0 && (
                <AgreementItemsTable
                  items={itemLibrary}
                  mode="confirm"
                  checked={builderSelected}
                  onToggle={toggleBuilderItem}
                />
              )}
            </div>

            <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
              <button type="button" disabled={builderBusy} onClick={() => saveAgreement(false)} className="action-button secondary">Save Draft</button>
              <button type="button" disabled={builderBusy} onClick={() => saveAgreement(true)} className="action-button primary">{builderBusy ? 'Saving…' : 'Send to Tenant'}</button>
            </div>
          </article>

          {/* Agreement Review */}
          <article className="card card-tint--violet" style={{ gridColumn: '1 / -1' }}>
            <div className="card-label">
              <span className="badge badge-agent">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M9 11l3 3L22 4"/><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"/></svg>
              </span>Agreement Review
            </div>
            <h3 style={{ marginBottom: 16 }}>Tenant Agreements</h3>

            {loading && <p className="landlord-muted">Loading agreements…</p>}
            {!loading && agreements.length === 0 && <p className="landlord-empty">No agreements created yet.</p>}

            {!loading && agreements.length > 0 && (
              <div className="table-shell">
                <table className="landlord-table" style={{ fontSize: '12px' }}>
                  <thead>
                    <tr>
                      <th>Tenant</th>
                      <th>Title</th>
                      <th>Items</th>
                      <th>Checked</th>
                      <th>Status</th>
                      <th>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {agreements.map((ag) => (
                      <tr key={ag.id}>
                        <td>{ag.tenant_name || tenants.find((t) => t.id === ag.tenant_id)?.full_name || '-'}</td>
                        <td>{ag.title}</td>
                        <td>{ag.selected_item_ids?.length ?? 0}</td>
                        <td>{ag.tenant_checks?.length ?? 0}</td>
                        <td>
                          <span className={`status-pill ${agreementStatusBadge(ag.status)}`} style={{ textTransform: 'capitalize' }}>{ag.status}</span>
                        </td>
                        <td>
                          <div className="landlord-actions">
                            <button className="action-button secondary" style={{ padding: '6px 12px', fontSize: '12px' }} onClick={() => setExpandedAgreement(expandedAgreement === ag.id ? null : ag.id)}>
                              {expandedAgreement === ag.id ? 'Hide' : 'View'}
                            </button>
                            <button className="action-button primary" style={{ padding: '6px 12px', fontSize: '12px' }} disabled={pdfBusyId === ag.id} onClick={() => downloadAgreementPdf(ag)}>
                              {pdfBusyId === ag.id ? 'Preparing…' : 'Download PDF'}
                            </button>
                            {ag.status === 'submitted' && (
                              <button className="action-button info" style={{ padding: '6px 12px', fontSize: '12px' }} onClick={() => reviewAgreement(ag.id, false)}>Mark Reviewed</button>
                            )}
                            {(ag.status === 'reviewed' || ag.status === 'submitted') && (
                              <button className="action-button warn" style={{ padding: '6px 12px', fontSize: '12px' }} onClick={() => reviewAgreement(ag.id, true)}>Complete</button>
                            )}
                            {ag.status === 'draft' && (
                              <button className="action-button warn" style={{ padding: '6px 12px', fontSize: '12px' }} onClick={async () => {
                                const r = await fetch('/api/agreements', { method: 'PATCH', headers: await getAuthHeaders(), body: JSON.stringify({ id: ag.id, action: 'send' }) });
                                if (r.ok) { setMessage('Agreement sent to tenant.'); loadData(); } else { const j = await r.json(); setError(j.message ?? 'Unable to send.'); }
                              }}>Send</button>
                            )}
                            <button className="action-button danger" style={{ padding: '6px 12px', fontSize: '12px' }} onClick={() => deleteAgreement(ag.id)}>Delete</button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            {expandedAgreement && (() => {
              const ag = agreements.find((a) => a.id === expandedAgreement);
              if (!ag) return null;
              const checkedSet = new Set(ag.tenant_checks ?? []);
              const items = ag.items ?? itemLibrary.filter((i) => ag.selected_item_ids.includes(i.id));
              const isEditing = editingId === ag.id;

              if (isEditing) {
                return (
                  <div className="agreement-preview agreement-preview--editing">
                    <div className="agreement-edit-head">
                      <h4>Edit agreement</h4>
                      <div className="landlord-actions">
                        <button type="button" className="action-button secondary" style={{ padding: '6px 12px', fontSize: '12px' }} onClick={() => setEditingId(null)} disabled={editBusy}>Cancel</button>
                        <button type="button" className="action-button primary" style={{ padding: '6px 12px', fontSize: '12px' }} onClick={saveAgreementEdits} disabled={editBusy}>{editBusy ? 'Saving…' : 'Save Changes'}</button>
                      </div>
                    </div>

                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: 16 }}>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 6, minWidth: 0 }}>
                        <label style={{ fontSize: '12px', fontWeight: 600, color: 'var(--ink-2)' }}>Agreement title</label>
                        <input value={editTitle} onChange={(e) => setEditTitle(e.target.value)} style={{ width: '100%', minWidth: 0 }} />
                      </div>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 6, minWidth: 0 }}>
                        <label style={{ fontSize: '12px', fontWeight: 600, color: 'var(--ink-2)' }}>Tenant</label>
                        <input value={`${ag.tenant_name || '-'}${ag.property_name ? ` · ${ag.property_name}` : ''}${ag.unit_number ? ` · Unit ${ag.unit_number}` : ''}`} readOnly style={{ width: '100%', minWidth: 0 }} />
                      </div>
                    </div>

                    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, flexWrap: 'wrap' }}>
                        <label style={{ fontSize: '12px', fontWeight: 600, color: 'var(--ink-2)' }}>Agreement wording</label>
                        <button type="button" className="action-button secondary" style={{ padding: '4px 10px', fontSize: '11px' }} onClick={() => setEditDescription(DEFAULT_AGREEMENT_DESCRIPTION)}>Restore lease wording</button>
                      </div>
                      <textarea
                        value={editDescription}
                        onChange={(e) => setEditDescription(e.target.value)}
                        rows={14}
                        style={{ width: '100%', minWidth: 0, padding: 10, borderRadius: 8, border: '1px solid var(--line)', fontFamily: 'inherit', fontSize: '13px', lineHeight: 1.55 }}
                      />
                      <p style={{ fontSize: '11px', color: 'var(--ink-3)' }}>
                        Fill in the blanks (dates, ID numbers, KRA PINs, guarantor details) or rewrite any wording you need.
                      </p>
                    </div>

                    <div className="builder-items-head">
                      <label style={{ fontSize: '13px', fontWeight: 700 }}>Checklist items ({editItems.length} of {itemLibrary.length} selected)</label>
                      <div className="builder-items-actions">
                        <button type="button" className="action-button secondary" onClick={() => setEditItems(itemLibrary.map((i) => i.id))}>Select all</button>
                        <button type="button" className="action-button secondary" onClick={() => setEditItems([])}>Clear</button>
                      </div>
                    </div>
                    <div className="agreement-library">
                      <AgreementItemsTable items={itemLibrary} mode="confirm" checked={editItems} onToggle={toggleEditItem} disabled={editBusy} />
                    </div>
                  </div>
                );
              }

              return (
                <div className="agreement-preview">
                  <div className="agreement-edit-head">
                    <h4>{ag.title} — {ag.tenant_name}</h4>
                    <button type="button" className="action-button secondary" style={{ padding: '6px 12px', fontSize: '12px' }} onClick={() => startEditAgreement(ag)}>Edit</button>
                  </div>
                  {ag.description && <p className="agreement-body-text">{ag.description}</p>}
                  {ag.tenant_notes && <p style={{ fontSize: '12px', marginBottom: 12, fontStyle: 'italic' }}>Tenant notes: {ag.tenant_notes}</p>}
                  <AgreementItemsTable items={items} mode="readonly" checked={[...checkedSet]} />
                </div>
              );
            })()}
          </article>

          <article className="card card-tint--blue" style={{ gridColumn: '1 / -1' }}>
            <div className="card-label">
              <span className="badge badge-agent">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><rect x="1" y="4" width="22" height="16" rx="2"/><line x1="1" y1="10" x2="23" y2="10"/></svg>
              </span>All Documents
            </div>
            <h3 style={{ marginBottom: 16 }}>Agreement Workflow</h3>

            {loading && <p className="landlord-muted">Loading documents...</p>}
            {!loading && documents.filter(doc => doc.document_type === 'agreement').length === 0 && <p className="landlord-empty">No agreement documents uploaded yet.</p>}

            {!loading && documents.filter(doc => doc.document_type === 'agreement').length > 0 && (
              <div className="table-shell">
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
                    {documents.filter(doc => doc.document_type === 'agreement').map(doc => (
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
<div className="landlord-actions">
                              <a href={doc.document_url} target="_blank" rel="noopener noreferrer" className="action-button primary" style={{ padding: '6px 12px', fontSize: '12px' }}>Download</a>
                              {doc.status === 'downloaded' && (
                              <button className="action-button warn" style={{ padding: '6px 12px', fontSize: '12px' }} onClick={() => handleUpdateStatus(doc.id, 'awaiting_signature')}>Mark as Signed</button>
                            )}
                            {doc.status === 'signed' && (
                              <>
                                <button className="action-button info" style={{ padding: '6px 12px', fontSize: '12px' }} onClick={() => handleUpdateStatus(doc.id, 'approved')}>Approve</button>
                                <button className="action-button danger" style={{ padding: '6px 12px', fontSize: '12px' }} onClick={() => handleUpdateStatus(doc.id, 'rejected')}>Reject</button>
                              </>
                            )}
                            <button className="action-button danger" style={{ padding: '6px 12px', fontSize: '12px' }} onClick={() => handleDelete(doc.id)}>Delete</button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

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

            {!loading && bundles.length > 0 && (
              <div className="table-shell">
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
                    {bundles.map(bundle => (
                      <tr key={bundle.id}>
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
                          {bundle.status === 'pending' && (
                            <div className="landlord-actions">
                              <button onClick={() => handleApproveBundle(bundle.id)} className="action-button warn" style={{ padding: '6px 12px', fontSize: '12px' }}>Approve</button>
                              <button onClick={() => handleRejectBundle(bundle.id)} className="action-button danger" style={{ padding: '6px 12px', fontSize: '12px' }}>Reject</button>
                            </div>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
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
    </div>
  );
}