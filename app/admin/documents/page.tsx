'use client';

import { useEffect, useState } from 'react';
import { supabase } from '../../../lib/supabaseClient';

interface TenantDocument {
  id: string;
  tenant_id: string;
  tenant_name: string;
  document_type: string;
  file_path: string;
  file_name: string;
  created_at: string;
}

export default function LandlordDocumentsPage() {
   const [documents, setDocuments] = useState<TenantDocument[]>([]);
   const [loading, setLoading] = useState(true);
   const [error, setError] = useState('');

async function getAuthHeaders() {
      const { data } = await supabase.auth.getSession();
      const headers: Record<string, string> = { 'Content-Type': 'application/json' };
      if (data.session?.access_token) headers.Authorization = `Bearer ${data.session.access_token}`;
      return headers;
    }

    async function loadDocuments() {
      setLoading(true);
      setError('');

      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user?.email) {
          setError('No user session found.');
          setLoading(false);
          return;
        }
        const response = await fetch(`/api/admin/documents?adminEmail=${encodeURIComponent(user.email)}`, {
          headers: await getAuthHeaders(),
        });
        const result = await response.json();

        if (!response.ok) throw new Error(result.message ?? 'Failed to load documents');

        setDocuments(result.documents ?? []);
      } catch (err: any) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    }

    useEffect(() => {
      loadDocuments();
    }, []);

   const formatType = (type: string) => type.replace('_', ' ');

return (
      <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
        <main className="container admin-no-hero" style={{ flex: 1, padding: '34px 0 80px' }}>
          <div className="card-admin-header">
            <div>
              <p className="heading">Tenant Documents</p>
              <p className="subheading">Review documents submitted by tenants for verification.</p>
            </div>
          </div>

          <section className="bento-section">
            <div className="bento">
              <article className="card">
                <div className="card-label"><span className="badge badge-pm">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>
                </span>Submitted Documents</div>
                <h3>Document Verification</h3>

                {loading && <p className="landlord-muted">Loading documents...</p>}
                {error && <p className="landlord-error">{error}</p>}
                {!loading && documents.length === 0 && <p className="landlord-empty">No tenant documents submitted yet.</p>}

                {!loading && documents.length > 0 && (
                  <div className="table-shell">
                    <table className="landlord-table">
                      <thead>
                        <tr>
                          <th>Tenant</th>
                          <th>Document Type</th>
                          <th>File Name</th>
                          <th>Submitted</th>
                        </tr>
                      </thead>
                      <tbody>
                        {documents.map(doc => (
                          <tr key={doc.id}>
                            <td>{doc.tenant_name}</td>
                            <td>{formatType(doc.document_type)}</td>
                            <td>{doc.file_name || '—'}</td>
                            <td>{doc.created_at ? new Date(doc.created_at).toLocaleDateString() : ''}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </article>
            </div>
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