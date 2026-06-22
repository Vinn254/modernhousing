'use client';

import { useEffect, useState } from 'react';
import { supabase } from '../../../lib/supabaseClient';

interface Document { id: string; document_type: string; created_at: string; }

export default function TenantDocumentsPage() {
  const [user, setUser] = useState<any>(null);
  const [documents, setDocuments] = useState<Document[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [documentFile, setDocumentFile] = useState<File | null>(null);
  const [documentType, setDocumentType] = useState('id_card');
  const [docLoading, setDocLoading] = useState(false);

  async function loadDocuments() {
    setLoading(true);
    const { data: { session } } = await supabase.auth.getSession();
    if (!session?.user?.id) {
      setLoading(false);
      return;
    }
    const response = await fetch(`/api/tenant/documents?userId=${session.user.id}`, {
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

  async function handleUpload(event: React.FormEvent) {
    event.preventDefault();
    setDocLoading(true);
    setError('');

    const { data: { session } } = await supabase.auth.getSession();
    const formData = new FormData();
    formData.append('file', documentFile!);
    formData.append('documentType', documentType);
    if (session?.user?.user_metadata?.tenant_id) {
      formData.append('tenantId', session.user.user_metadata.tenant_id);
    }

    const response = await fetch('/api/tenant/documents', { method: 'POST', body: formData });
    const result = await response.json();

    if (!response.ok) {
      setError(result.message ?? 'Unable to upload document.');
      setDocLoading(false);
      return;
    }

    setMessage('Document uploaded successfully.');
    setDocumentFile(null);
    loadDocuments();
    setDocLoading(false);
  }

  if (!documentFile && loading) {
    return (
      <main className="container page-layout">
        <div className="card">Loading documents…</div>
      </main>
    );
  }

  return (
    <main className="container page-layout">
      <div className="card-admin-header">
        <div><p className="heading">Document Upload</p><p className="subheading">Submit required documents for your tenancy.</p></div>
      </div>

      <section className="card" style={{ marginTop: 24 }}>
        <h3 style={{ marginBottom: 12 }}>Upload Document</h3>
        <p style={{ color: 'var(--ink-3)', marginBottom: 16, fontSize: 14 }}>
          Required documents include: National ID card, passport photo, signed lease agreement, 
          water account registration, and utility registration forms. These help your agent 
          verify your tenancy and process utility billing.
        </p>
        <form onSubmit={handleUpload} className="form-grid">
          <select value={documentType} onChange={(e) => setDocumentType(e.target.value)}>
            <option value="id_card">National ID Card</option>
            <option value="passport_photo">Passport Photo</option>
            <option value="lease_agreement">Lease Agreement</option>
            <option value="water_account">Water Account Registration</option>
            <option value="utility_registration">Utility Registration Form</option>
            <option value="other">Other Document</option>
          </select>
          <input type="file" accept=".pdf,.jpg,.jpeg,.png" onChange={(e) => setDocumentFile(e.target.files?.[0] ?? null)} required />
          <button type="submit" disabled={docLoading}>Upload Document</button>
        </form>
        {message && <p style={{ color: 'var(--accent)', marginTop: 12 }}>{message}</p>}
        {error && <p style={{ color: '#dc2626', marginTop: 12 }}>{error}</p>}
      </section>

      <section className="card" style={{ marginTop: 24 }}>
        <h3 style={{ marginBottom: 12 }}>Your Documents</h3>
        {loading && <p className="landlord-muted">Loading documents…</p>}
        {!loading && documents.length === 0 && <p>No documents uploaded yet.</p>}
        {!loading && documents.length > 0 && (
          <div className="table-shell">
            <table className="landlord-table">
              <thead><tr><th>Document Type</th><th>Date</th></tr></thead>
              <tbody>
                {documents.map(d => (
                  <tr key={d.id}>
                    <td>{d.document_type.replace('_', ' ')}</td>
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