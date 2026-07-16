'use client';

import { useEffect, useState } from 'react';
import { supabase } from '../../../lib/supabaseClient';
import { useSearchParams } from 'next/navigation';

export const dynamic = 'force-dynamic';

interface AuditTrail {
  id: string;
  document_id: string;
  tenant_id: string;
  tenant_name: string;
  tenant_email: string;
  tenant_national_id?: string;
  ip_address?: string;
  device?: string;
  signature_type?: string;
  security_authentication?: string;
  disclosure_consent?: string;
  consent_accepted_at?: string;
  sent_at?: string;
  viewed_at?: string;
  signed_at?: string;
  completed_at?: string;
  audit_events?: any[];
  documents?: { document_name?: string; document_type?: string };
  created_at: string;
}

export default function AuditTrailPage() {
  const searchParams = useSearchParams();
  const documentId = searchParams?.get('documentId');
  const tenantId = searchParams?.get('tenantId');
  
  const [auditTrails, setAuditTrails] = useState<AuditTrail[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [userRole, setUserRole] = useState('');

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      setUserRole(data.user?.user_metadata?.role || '');
    });
    loadAuditTrails();
  }, [documentId, tenantId]);

  async function getAuthHeaders() {
    const { data } = await supabase.auth.getSession();
    const headers: Record<string, string> = { 'Content-Type': 'application/json' };
    if (data.session?.access_token) headers.Authorization = `Bearer ${data.session.access_token}`;
    return headers;
  }

  async function loadAuditTrails() {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (documentId) params.set('documentId', documentId);
      if (tenantId) params.set('tenantId', tenantId);

      const response = await fetch(`/api/document-audit-trail?${params.toString()}`, {
        headers: await getAuthHeaders(),
      });

      const result = await response.json();
      if (response.ok) {
        setAuditTrails(result.auditTrails || []);
      } else {
        setError(result.message || 'Unable to load audit trails.');
      }
    } catch (e: any) {
      setError('Failed to load audit trails.');
    }
    setLoading(false);
  }

  async function downloadAuditTrail(trail: AuditTrail) {
    const printWindow = window.open('', '_blank');
    if (!printWindow) {
      setError('Please allow popups to download audit trail.');
      return;
    }

    const events = [...(trail.audit_events || [])];
    events.push(
      { action: 'sent', timestamp: trail.sent_at },
      { action: 'viewed', timestamp: trail.viewed_at },
      { action: 'signed', timestamp: trail.signed_at },
      { action: 'completed', timestamp: trail.completed_at }
    );
    const filteredEvents = events.filter((e: any) => e.timestamp);

    const html = `
      <!DOCTYPE html>
      <html>
      <head>
        <title>Document Audit Trail - ${trail.tenant_name}</title>
        <style>
          body { font-family: Arial, sans-serif; padding: 20px; color: #333; }
          h1 { font-size: 18px; margin-bottom: 20px; }
          .section { margin-bottom: 20px; }
          .label { font-weight: bold; color: #555; font-size: 12px; }
          .value { margin-bottom: 8px; }
          table { width: 100%; border-collapse: collapse; margin-top: 10px; }
          th, td { text-align: left; padding: 8px; border-bottom: 1px solid #ddd; font-size: 12px; }
          .footer { margin-top: 30px; font-size: 11px; color: #666; }
          .page-break { page-break-after: always; }
        </style>
      </head>
      <body>
        <h1>Document Audit Trail</h1>
        
        <div class="section">
          <div class="label">Name Email ID</div>
          <div class="value">${trail.tenant_name} ${trail.tenant_email}</div>
        </div>
        
        <div class="section">
          <table>
            <tr><td class="label">IP Address</td><td>${trail.ip_address || '-'}</td></tr>
            <tr><td class="label">Device</td><td>${trail.device || '-'}</td></tr>
          </table>
        </div>
        
        <div class="section">
          <div class="label">Signature Type Security Authentication</div>
          <div class="value">${trail.signature_type || 'Electronic Signature'}</div>
        </div>
        
        <div class="section">
          <div class="label">Electronic Signature Disclosure Consent Signature</div>
          <div class="value">${trail.disclosure_consent || '-'} Accepted: ${trail.consent_accepted_at ? new Date(trail.consent_accepted_at).toUTCString() : '-'}</div>
        </div>
        
        <div class="section">
          <div class="label">Timestamps</div>
          ${filteredEvents.map((e: any) => `<div>${e.timestamp ? new Date(e.timestamp).toUTCString() : ''} - ${e.action.charAt(0).toUpperCase() + e.action.slice(1)}</div>`).join('')}
        </div>
        
        <div class="section">
          <div class="label">Audit Trail</div>
          ${filteredEvents.map((e: any) => {
            if (e.action === 'sent') {
              return `<div>Sent: Document sent to ${trail.tenant_name} (${trail.tenant_email}).</div>`;
            } else if (e.action === 'viewed') {
              return `<div>Viewed: ${trail.tenant_name} (${trail.tenant_email}) viewed the document.<br/>${e.timestamp ? new Date(e.timestamp).toUTCString() : ''} ${trail.tenant_email} IP: ${trail.ip_address || '-'}</div>`;
            } else if (e.action === 'signed') {
              return `<div>Signed: ${trail.tenant_name} (${trail.tenant_email}) signed the document.<br/>${e.timestamp ? new Date(e.timestamp).toUTCString() : ''} ${trail.tenant_email} IP: ${trail.ip_address || '-'}</div>`;
            } else if (e.action === 'completed') {
              return `<div>Completed:<br/>Document has been completed</div>`;
            }
            return '';
          }).join('')}
        </div>
        
        <div class="footer">
          Page 1 of 1<br/>
          Generated: ${new Date().toUTCString()}
        </div>
        
        <script>window.onload = () => { window.print(); }</script>
      </body>
      </html>
    `;

    printWindow.document.write(html);
    printWindow.document.close();
  }

  if (loading) {
    return (
      <main className="container page-layout auth-pattern-bg">
        <div className="card">Loading audit trails...</div>
      </main>
    );
  }

  return (
    <main className="container page-layout auth-pattern-bg">
      <div className="card-admin-header">
        <div>
          <p className="heading">Document Audit Trails</p>
          <p className="subheading">View and download signing activity records for tenants.</p>
        </div>
      </div>

      {error && <p className="landlord-error">{error}</p>}

      {auditTrails.length === 0 && !error && (
        <div className="card">
          <p>No audit trails found.</p>
        </div>
      )}

      {auditTrails.length > 0 && (
        <div className="table-shell">
          <table className="landlord-table">
            <thead>
              <tr>
                <th>Tenant</th>
                <th>Email</th>
                <th>Document</th>
                <th>Status</th>
                <th>Sent</th>
                <th>Signed</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {auditTrails.map(trail => (
                <tr key={trail.id}>
                  <td>{trail.tenant_name}</td>
                  <td>{trail.tenant_email}</td>
                  <td>{trail.documents?.document_name || '-'}</td>
                  <td>
                    <span className={`status-pill ${trail.completed_at ? 'status-active' : 'status-pending'}`}>
                      {trail.completed_at ? 'Completed' : trail.signed_at ? 'Signed' : trail.viewed_at ? 'Viewed' : 'Sent'}
                    </span>
                  </td>
                  <td>{trail.sent_at ? new Date(trail.sent_at).toLocaleDateString() : '-'}</td>
                  <td>{trail.signed_at ? new Date(trail.signed_at).toLocaleDateString() : '-'}</td>
                  <td>
                    <button 
                      className="action-button secondary"
                      onClick={() => downloadAuditTrail(trail)}
                      style={{ padding: '6px 12px', fontSize: '12px' }}
                    >
                      Download
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </main>
  );
}