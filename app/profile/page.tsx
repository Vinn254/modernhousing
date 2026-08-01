'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { supabase } from '../../lib/supabaseClient';

type ProfileForm = {
  full_name: string;
  organization_name: string;
  email: string;
  phone: string;
  id_number: string;
  kra_pin: string;
  property_name: string;
  property_location: string;
  number_of_units: string;
  account_holder_name: string;
  bank_name: string;
  account_number: string;
  branch: string;
  agreement_accepted: boolean;
  signed_on: string;
  bank_details_edit_allowed: boolean;
  bank_edit_request: boolean;
};

const emptyForm = (): ProfileForm => ({
  full_name: '',
  organization_name: '',
  email: '',
  phone: '',
  id_number: '',
  kra_pin: '',
  property_name: '',
  property_location: '',
  number_of_units: '',
  account_holder_name: '',
  bank_name: '',
  account_number: '',
  branch: '',
  agreement_accepted: false,
  signed_on: '',
  bank_details_edit_allowed: true,
  bank_edit_request: false,
});

export default function MyProfilePage() {
  const [form, setForm] = useState<ProfileForm>(emptyForm());
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [name, setName] = useState('Landlord');
  const [approvalStatus, setApprovalStatus] = useState<string | null>(null);

  useEffect(() => {
    async function loadProfile() {
      setLoading(true);
      const { data: { session } } = await supabase.auth.getSession();
      const accessToken = session?.access_token;
      if (!accessToken) {
        setLoading(false);
        return;
      }

      const response = await fetch('/api/profile', {
        headers: { Authorization: `Bearer ${accessToken}` },
        cache: 'no-store',
      });

      const result = await response.json().catch(() => ({}));
      if (response.ok && result.profile) {
        const profile = result.profile;
        setApprovalStatus(profile.approval_status ?? null);
        setForm({
          full_name: profile.full_name || profile.fullName || session?.user?.user_metadata?.full_name || '',
          organization_name: profile.organization_name || profile.organization || '',
          email: profile.email || session?.user?.email || '',
          phone: profile.phone || session?.user?.user_metadata?.phone || '',
          id_number: profile.id_number || '',
          kra_pin: profile.kra_pin || '',
          property_name: profile.property_name || '',
          property_location: profile.property_location || '',
          number_of_units: profile.number_of_units || '',
          account_holder_name: profile.account_holder_name || '',
          bank_name: profile.bank_name || '',
          account_number: profile.account_number || '',
          branch: profile.branch || '',
          agreement_accepted: Boolean(profile.agreement_accepted),
          signed_on: profile.signed_on || '',
          bank_details_edit_allowed: profile.bank_details_edit_allowed !== false,
          bank_edit_request: Boolean(profile.bank_edit_request),
        });
        setName(session?.user?.user_metadata?.full_name?.split(' ')[0] || session?.user?.email || 'Landlord');
      }

      setLoading(false);
    }

    loadProfile();
  }, []);

  const isUnapproved = approvalStatus !== 'approved' && approvalStatus !== null && approvalStatus !== undefined;

  async function saveProfile(action?: 'request_bank_edit_unlock' | 'submit_for_approval') {
    setSaving(true);
    setMessage('');
    setError('');

    const { data: { session } } = await supabase.auth.getSession();
    if (!session?.access_token) {
      setError('Your session expired. Please sign in again.');
      setSaving(false);
      return;
    }

    const payload = {
      userId: session.user.id,
      profileData: {
        ...form,
        bank_details_edit_allowed: action === 'request_bank_edit_unlock' ? false : false,
        bank_edit_request: action === 'request_bank_edit_unlock',
      },
      action,
    };

    const response = await fetch('/api/profile', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${session.access_token}`,
      },
      body: JSON.stringify(payload),
    });

    const result = await response.json().catch(() => ({}));
    if (!response.ok) {
      setError(result.message || 'Unable to save your profile.');
      setSaving(false);
      return;
    }

    setForm((current) => ({
      ...current,
      bank_details_edit_allowed: action === 'request_bank_edit_unlock' ? false : false,
      bank_edit_request: action === 'request_bank_edit_unlock',
    }));
    setMessage(action === 'request_bank_edit_unlock' ? 'Bank edit request sent to the super admin.' : action === 'submit_for_approval' ? 'Profile submitted for approval. The super admin will review it shortly.' : 'Profile saved successfully.');
    setSaving(false);
  }

  const canEditBankDetails = form.bank_details_edit_allowed !== false;

  return (
    <main className="container admin-no-hero" style={{ paddingBottom: 40 }}>
      <div className="card-admin-header" style={{ marginBottom: 24 }}>
        <div>
          <p className="heading">My Profile</p>
          <p className="subheading">Keep your onboarding details up to date. General profile fields stay editable, while bank details need a super admin unlock after the first save.</p>
        </div>
        <Link href="/admin" className="action-button ghost">Back to dashboard</Link>
      </div>

      {isUnapproved && (
        <div style={{
          background: 'linear-gradient(90deg, rgba(245,158,11,0.12) 0%, rgba(251,191,36,0.12) 100%)',
          border: '1px solid rgba(245,158,11,0.35)',
          borderRadius: 12,
          padding: '16px 18px',
          marginBottom: 20,
          display: 'flex',
          alignItems: 'center',
          gap: 12,
          animation: 'blink-border 2s infinite'
        }}>
          <div style={{
            width: 10,
            height: 10,
            borderRadius: '50%',
            background: '#f59e0b',
            boxShadow: '0 0 0 0 rgba(245,158,11,0.7)',
            animation: 'pulse-dot 1.5s infinite'
          }} />
          <div>
            <p style={{ margin: 0, fontWeight: 600, color: '#92400e' }}>Account pending approval</p>
            <p style={{ margin: '4px 0 0', color: '#a16207', fontSize: 14 }}>Fill in your profile details and click <strong>Submit for Approval</strong> to access the full landlord workspace.</p>
          </div>
        </div>
      )}

      {message && <p className="landlord-success" style={{ marginBottom: 16 }}>{message}</p>}
      {error && <p className="landlord-error" style={{ marginBottom: 16 }}>{error}</p>}

      {loading ? (
        <p className="landlord-muted">Loading your profile…</p>
      ) : (
        <form onSubmit={(event) => { event.preventDefault(); void saveProfile(); }} className="card" style={{ display: 'grid', gap: 24 }}>
          <section style={{ display: 'grid', gap: 16 }}>
            <div className="card-label">Basic details</div>
            <div style={{ display: 'grid', gap: 12, gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))' }}>
              <label className="field-group">
                <span>Full name</span>
                <input value={form.full_name} onChange={(event) => setForm((current) => ({ ...current, full_name: event.target.value }))} required />
              </label>
              <label className="field-group">
                <span>Organization / company name</span>
                <input value={form.organization_name} onChange={(event) => setForm((current) => ({ ...current, organization_name: event.target.value }))} required />
              </label>
              <label className="field-group">
                <span>Email</span>
                <input type="email" value={form.email} onChange={(event) => setForm((current) => ({ ...current, email: event.target.value }))} required />
              </label>
              <label className="field-group">
                <span>Phone number</span>
                <input value={form.phone} onChange={(event) => setForm((current) => ({ ...current, phone: event.target.value }))} placeholder="+254 700 000 000" />
              </label>
              <label className="field-group">
                <span>ID / passport number</span>
                <input value={form.id_number} onChange={(event) => setForm((current) => ({ ...current, id_number: event.target.value }))} />
              </label>
              <label className="field-group">
                <span>KRA PIN</span>
                <input value={form.kra_pin} onChange={(event) => setForm((current) => ({ ...current, kra_pin: event.target.value }))} />
              </label>
              <label className="field-group">
                <span>Property name</span>
                <input value={form.property_name} onChange={(event) => setForm((current) => ({ ...current, property_name: event.target.value }))} />
              </label>
              <label className="field-group">
                <span>Property location / area</span>
                <input value={form.property_location} onChange={(event) => setForm((current) => ({ ...current, property_location: event.target.value }))} />
              </label>
              <label className="field-group">
                <span>Number of units</span>
                <input type="number" min="0" value={form.number_of_units} onChange={(event) => setForm((current) => ({ ...current, number_of_units: event.target.value }))} />
              </label>
            </div>
          </section>

          <section style={{ display: 'grid', gap: 16 }}>
            <div className="card-label">Bank details</div>
            <p className="landlord-muted" style={{ margin: 0 }}>
              {canEditBankDetails
                ? 'You can update bank details now. Once you save, future edits will require a super admin unlock.'
                : 'Bank details are currently locked. Use the button below to request a super admin unlock.'}
            </p>
            <div style={{ display: 'grid', gap: 12, gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))' }}>
              <label className="field-group">
                <span>Account holder name</span>
                <input value={form.account_holder_name} onChange={(event) => setForm((current) => ({ ...current, account_holder_name: event.target.value }))} disabled={!canEditBankDetails} />
              </label>
              <label className="field-group">
                <span>Bank name</span>
                <input value={form.bank_name} onChange={(event) => setForm((current) => ({ ...current, bank_name: event.target.value }))} disabled={!canEditBankDetails} />
              </label>
              <label className="field-group">
                <span>Account number</span>
                <input value={form.account_number} onChange={(event) => setForm((current) => ({ ...current, account_number: event.target.value }))} disabled={!canEditBankDetails} />
              </label>
              <label className="field-group">
                <span>Branch</span>
                <input value={form.branch} onChange={(event) => setForm((current) => ({ ...current, branch: event.target.value }))} disabled={!canEditBankDetails} />
              </label>
            </div>
            <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
              <button type="submit" className="action-button primary" disabled={saving}>
                {saving ? 'Saving…' : 'Save profile'}
              </button>
              <button type="button" className="action-button warn" disabled={saving || canEditBankDetails} onClick={() => void saveProfile('request_bank_edit_unlock')}>
                {saving ? 'Requesting…' : 'Request bank edit unlock'}
              </button>
            </div>
          </section>

          <section style={{ display: 'grid', gap: 12 }}>
            <div className="card-label">Agreement</div>
            <div style={{ display: 'grid', gap: 10, padding: '12px 14px', background: 'var(--surface)', border: '1px solid var(--line-soft)', borderRadius: 12 }}>
              <p style={{ margin: 0, fontSize: 14, color: 'var(--ink-2)' }}>By tapping <strong>I agree</strong>, you confirm that:</p>
              <ul style={{ margin: 0, paddingLeft: 18, color: 'var(--ink-2)', fontSize: 14, lineHeight: 1.6 }}>
                <li>You understand that a <strong>1% platform fee</strong> is deducted from every rent payment processed through this app.</li>
                <li>The bank account or M-PESA number you entered is yours, and you authorise us to send your share of rent to it automatically.</li>
                <li>Payouts arrive in your account within <strong>1 business day</strong> after the tenant pays.</li>
                <li>You can update your payout details anytime from your dashboard.</li>
              </ul>
            </div>
            <label className="field-group" style={{ gap: 8 }}>
              <input type="checkbox" checked={form.agreement_accepted} onChange={(event) => setForm((current) => ({ ...current, agreement_accepted: event.target.checked }))} style={{ width: 18, height: 18 }} />
              <span className="landlord-muted">I agree to the terms above.</span>
            </label>
            <label className="field-group">
              <span>Signed on</span>
              <input type="date" value={form.signed_on} onChange={(event) => setForm((current) => ({ ...current, signed_on: event.target.value }))} />
            </label>
            <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', justifyContent: 'flex-end' }}>
              <button type="button" className="action-button primary" disabled={saving || !form.agreement_accepted} onClick={() => void saveProfile('submit_for_approval')}>
                {saving ? 'Submitting…' : 'Submit for Approval'}
              </button>
            </div>
          </section>
        </form>
      )}
    </main>
  );
}
