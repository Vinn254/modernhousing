'use client';
import { useEffect, useState } from 'react';
import { supabase } from '../../lib/supabaseClient';
export default function HelpPage() {
    const [userRole, setUserRole] = useState('');
    useEffect(() => {
        supabase.auth.getSession().then(({ data: { session } }) => {
            const role = session?.user?.user_metadata?.role || '';
            setUserRole(role);
        });
    }, []);
    return (<main className="container auth-pattern-bg" style={{ maxWidth: '800px', padding: '24px' }}>
      <div className="card-admin-header" style={{ marginBottom: '24px' }}>
        <div>
          <span className="landlord-kicker">Support Center</span>
          <h1>Help & Navigation Guide</h1>
          <p className="subheading">Learn how to use Springfield Systems for property management.</p>
        </div>
      </div>

      <section style={{ marginBottom: '32px' }}>
        {(!userRole || userRole === 'admin' || userRole === 'project_manager') && (<div className="card" style={{ marginBottom: '24px' }}>
            <div className="card-label" style={{ marginBottom: '16px' }}>
              <span className="badge badge-pm">Project Manager (Landlord)</span>
            </div>
            <h3 style={{ marginBottom: '12px' }}>Dashboard Overview</h3>
            <p>Your main dashboard shows property metrics and quick stats. Workflow:</p>
            <ul style={{ marginLeft: '20px', color: 'var(--ink-3)' }}>
              <li><strong>Dashboard</strong> - Shows occupancy chart, vacant units count, and total rent owed. Click Vacant Units card to see available units, click Rent Owed to see tenants with balances owed.</li>
              <li><strong>Properties</strong> - Add properties with address and details. Create units within each property specifying rent amount, unit type, and assign to agents. Water rates can be set per property.</li>
              <li><strong>Agents</strong> - Add agents by email and assign them to specific properties. Agents will only see tenants and units for their assigned properties.</li>
              <li><strong>Tenants</strong> - View all tenants across your properties. Each tenant shows their unit, lease dates, and outstanding balance. Add new tenants by providing their details and unit assignment.</li>
              <li><strong>Payments</strong> - Review all payment transactions. Filter by property, date range, or transaction type (rent, water, utility, overdue). See total collections and individual tenant payment history.</li>
              <li><strong>Communications</strong> - Send announcements to all tenants or select a specific tenant. Choose message type (announcement, reminder, overdue alert) and write your message. View sent history and delete any notification.</li>
              <li><strong>Utilities</strong> - For each unit, record current water meter reading. System calculates consumption (current minus previous) and generates bill at KSH 150 per unit consumed.</li>
              <li><strong>Tenant Documents</strong> - Review documents tenants submit such as ID copies, KRA PIN, next of kin details, and lease agreements. Approve or reject submissions.</li>
              <li><strong>System Audit</strong> - Monitor all system activities including login attempts, user actions, and security events. Use for compliance and troubleshooting.</li>
            </ul>
          </div>)}

        {userRole === 'agent' && (<div className="card" style={{ marginBottom: '24px' }}>
            <div className="card-label" style={{ marginBottom: '16px' }}>
              <span className="badge badge-agent">Agent</span>
            </div>
            <h3 style={{ marginBottom: '12px' }}>Dashboard Overview</h3>
            <p>Your dashboard shows metrics for your assigned property.</p>

            <h3 style={{ marginTop: '24px', marginBottom: '12px' }}>Workflow by Section</h3>
            <ul style={{ marginLeft: '20px', color: 'var(--ink-3)' }}>
              <li><strong>Tenants</strong> - Add new tenants by entering their full name, email, phone, lease dates, and assigning a vacant unit. Record total paid amount for initial payments.</li>
              <li><strong>Complaints</strong> - View tenant complaints submitted from their dashboard. Each complaint shows tenant name, message, and status. Update status as you resolve issues.</li>
              <li><strong>Notifications</strong> - See notices you've sent to tenants. Send overdue alerts for unpaid rent or general announcements. You can delete any notification to remove it from tenant view.</li>
              <li><strong>Utilities (Water Billing)</strong> - Go to each unit and record the current water meter reading. System auto-calculates bill: (current reading - previous reading) × KSH 150. Previous reading updates automatically after saving.</li>
            </ul>
          </div>)}

        {userRole === 'tenant' && (<div className="card">
            <div className="card-label" style={{ marginBottom: '16px' }}>
              <span className="badge" style={{ background: 'var(--navy-700)' }}>Tenant</span>
            </div>
            <h3 style={{ marginBottom: '12px' }}>Dashboard Overview</h3>

            <h3 style={{ marginTop: '24px', marginBottom: '12px' }}>How to Use Each Feature</h3>
            <ul style={{ marginLeft: '20px', color: 'var(--ink-3)' }}>
              <li><strong>Apartment Details</strong> - View your unit number, property name and address, and your assigned agent's contact information. Update your profile picture here.</li>
              <li><strong>Payment History</strong> - Review all past payments made. Each entry shows payment date, amount, and description. See your running balance and next payment due date.</li>
              <li><strong>Due Dates</strong> - Your next rent payment date is shown on dashboard. Payments are typically due monthly starting from your lease start date.</li>
              <li><strong>Notices</strong> - Read announcements sent by your agent or landlord. These include payment reminders, lease updates, and property announcements.</li>
              <li><strong>Complaints</strong> - Submit maintenance issues or other concerns. Enter your message and submit. Track status updates (open, in progress, resolved).</li>
              <li><strong>Documents</strong> - Download your lease agreement. Upload required documents like ID copies, KRA PIN, or other paperwork requested by your agent.</li>
            </ul>

            <h3 style={{ marginTop: '24px', marginBottom: '12px' }}>Getting Started Steps</h3>
            <ol style={{ marginLeft: '20px', color: 'var(--ink-3)' }}>
              <li>Register at <code>/tenant/register</code> using the email your agent has on file for you.</li>
              <li>After login, view your apartment details and payment information on dashboard.</li>
              <li>Submit any required documents through the Documents section.</li>
              <li>Make rent payments through your assigned agent.</li>
            </ol>
          </div>)}

        {!userRole && (<div className="card">
            <div className="card-label" style={{ marginBottom: '16px' }}>
              <span className="badge badge-pm">Getting Started</span>
            </div>
            <h3 style={{ marginBottom: '12px' }}>Select Your Role</h3>
            <p>After logging in, you'll see help specific to your role. Available roles:</p>
            <ul style={{ marginLeft: '20px', color: 'var(--ink-3)' }}>
              <li><strong>Landlord/Project Manager</strong> - Full property and tenant management. Add properties, assign agents, view payments, and send communications.</li>
              <li><strong>Agent</strong> - Manage assigned property tenants and billing. Add tenants, record water meter readings, send notifications.</li>
              <li><strong>Tenant</strong> - View apartment info, payments, submit complaints, and upload required documents.</li>
            </ul>
          </div>)}
      </section>
    </main>);
}
