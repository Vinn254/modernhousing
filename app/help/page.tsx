'use client';

import { useEffect, useState } from 'react';
import { supabase } from '../../lib/supabaseClient';

export default function HelpPage() {
  const [userRole, setUserRole] = useState<string>('');

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      const role = session?.user?.user_metadata?.role || '';
      setUserRole(role);
    });
  }, []);

  return (
    <main className="container auth-pattern-bg" style={{ maxWidth: '800px', padding: '24px' }}>
      <div className="card-admin-header" style={{ marginBottom: '24px' }}>
        <div>
          <span className="landlord-kicker">Support Center</span>
          <h1>Help & Navigation Guide</h1>
          <p className="subheading">Learn how to use Springfield Systems.</p>
        </div>
      </div>

      <section style={{ marginBottom: '32px' }}>
        {(!userRole || userRole === 'admin' || userRole === 'project_manager') && (
          <div className="card" style={{ marginBottom: '24px' }}>
            <div className="card-label" style={{ marginBottom: '16px' }}>
              <span className="badge badge-pm">Project Manager (Landlord)</span>
            </div>
            <h3 style={{ marginBottom: '12px' }}>Dashboard Overview</h3>
            <p>Access via <code>/admin</code> after login. Key features:</p>
            <ul style={{ marginLeft: '20px', color: 'var(--ink-3)' }}>
              <li><strong>Unit Occupancy</strong> - Donut chart showing occupied vs vacant units</li>
              <li><strong>Quick Stats</strong> - Occupancy rate percentage</li>
              <li><strong>Vacant Units card</strong> - Click to view all vacant units with property and rent details</li>
              <li><strong>Total Rent Owed card</strong> - Click to view tenants with outstanding balances</li>
            </ul>

            <h3 style={{ marginTop: '24px', marginBottom: '12px' }}>Navigation Menu</h3>
            <ul style={{ marginLeft: '20px', color: 'var(--ink-3)' }}>
              <li><strong>Properties</strong> (<code>/properties</code>) - Add, edit, and view properties and units. Shows monthly collections.</li>
              <li><strong>Agents</strong> (<code>/admin/agents</code>) - Assign and manage agents for your properties.</li>
              <li><strong>Tenants</strong> (<code>/admin/tenants</code>) - View and manage tenant records.</li>
              <li><strong>Payments</strong> (<code>/payments</code>) - Review all payment transactions.</li>
              <li><strong>Communications</strong> (<code>/admin/communications</code>) - Send notices and announcements.</li>
              <li><strong>Utilities</strong> (<code>/admin/utilities</code>) - Manage water and other utility billing.</li>
              <li><strong>Tenant Documents</strong> (<code>/admin/documents</code>) - Review submitted tenant documents.</li>
              <li><strong>System Audit</strong> (<code>/admin/audit</code>) - Monitor security events and system activity.</li>
            </ul>
          </div>
        )}

        {userRole === 'agent' && (
          <div className="card" style={{ marginBottom: '24px' }}>
            <div className="card-label" style={{ marginBottom: '16px' }}>
              <span className="badge badge-agent">Agent</span>
            </div>
            <h3 style={{ marginBottom: '12px' }}>Dashboard Overview</h3>
            <p>Access via <code>/dashboard</code> after login. Shows assigned property metrics.</p>

            <h3 style={{ marginTop: '24px', marginBottom: '12px' }}>Key Features</h3>
            <ul style={{ marginLeft: '20px', color: 'var(--ink-3)' }}>
              <li><strong>Tenant Management</strong> - Add new tenants, assign units, set lease dates.</li>
              <li><strong>Water Meter Billing</strong> - Record meter readings and auto-calculate bills at KSH 150/unit.</li>
              <li><strong>Send Notifications</strong> - Notify tenants of overdue rent.</li>
              <li><strong>Complaints</strong> - View and manage tenant complaints.</li>
            </ul>

            <h3 style={{ marginTop: '24px', marginBottom: '12px' }}>Navigation</h3>
            <ul style={{ marginLeft: '20px', color: 'var(--ink-3)' }}>
              <li><strong>Tenants</strong> (<code>/agent/tenants</code>) - Manage tenants in assigned property.</li>
              <li><strong>Complaints</strong> (<code>/agent/complaints</code>) - Tenant issue tracking.</li>
              <li><strong>Notifications</strong> (<code>/agent/notifications</code>) - Sent notices.</li>
              <li><strong>Utilities</strong> (<code>/agent/utilities</code>) - Water billing for property.</li>
            </ul>
          </div>
        )}

        {userRole === 'tenant' && (
          <div className="card">
            <div className="card-label" style={{ marginBottom: '16px' }}>
              <span className="badge" style={{ background: 'var(--navy-700)' }}>Tenant</span>
            </div>
            <h3 style={{ marginBottom: '12px' }}>Dashboard Overview</h3>
            <p>Access via <code>/tenant/dashboard</code> after login.</p>

            <h3 style={{ marginTop: '24px', marginBottom: '12px' }}>Key Features</h3>
            <ul style={{ marginLeft: '20px', color: 'var(--ink-3)' }}>
              <li><strong>Apartment Details</strong> - View your unit, property, and agent information.</li>
              <li><strong>Payment History</strong> - Review past payments and balances.</li>
              <li><strong>Due Dates</strong> - See next payment due date.</li>
              <li><strong>Notices</strong> - Read announcements from your agent/landlord.</li>
              <li><strong>Complaints</strong> - Submit maintenance issues or concerns.</li>
              <li><strong>Documents</strong> - Download agreement, view submitted documents.</li>
            </ul>

            <h3 style={{ marginTop: '24px', marginBottom: '12px' }}>Quick Actions</h3>
            <ul style={{ marginLeft: '20px', color: 'var(--ink-3)' }}>
              <li><strong>Register</strong> (<code>/tenant/register</code>) - Self-register if not yet assigned.</li>
              <li><strong>Rent Payment</strong> - Make payments through your agent.</li>
            </ul>
          </div>
        )}

        {!userRole && (
          <div className="card">
            <div className="card-label" style={{ marginBottom: '16px' }}>
              <span className="badge badge-pm">Getting Started</span>
            </div>
            <h3 style={{ marginBottom: '12px' }}>Select Your Role</h3>
            <p>After logging in, you'll see help specific to your role. Available roles:</p>
            <ul style={{ marginLeft: '20px', color: 'var(--ink-3)' }}>
              <li><strong>Landlord/Project Manager</strong> - Full property and tenant management</li>
              <li><strong>Agent</strong> - Manage assigned property tenants and billing</li>
              <li><strong>Tenant</strong> - View apartment info, payments, and submit issues</li>
            </ul>
          </div>
        )}
      </section>
    </main>
  );
}