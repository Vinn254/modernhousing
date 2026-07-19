'use client';

import { useEffect, useRef, useState, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import { PDFDocument, StandardFonts, rgb } from 'pdf-lib';
import { supabase } from '../../../lib/supabaseClient';

interface Property {
  id: string;
  name: string;
  address: string;
}

interface Tenant {
  id: string;
  full_name: string;
  email: string;
  phone?: string;
  unit: string;
  unit_id?: string;
  property: string;
  property_id?: string;
  address?: string;
  lease_start: string;
  lease_end: string;
  status?: string;
  deposit_amount?: number;
  national_id?: string;
  kra_pin?: string;
  next_of_kin_name?: string;
  next_of_kin_id?: string;
  next_of_kin_phone?: string;
  next_of_kin_relationship?: string;
  picture_url?: string;
}

interface Bill {
  id: string;
  tenant_id: string;
  description: string;
  month_due: string;
  due_amount: number;
  paid_amount: number;
  penalty_fee: number;
  balance: number;
  transaction_type: string;
  transaction_number: string;
  transaction_code: string;
  payment_date: string;
  payment_method: string;
  reference_number: string;
  created_at: string;
}

async function getAuthHeaders() {
  const { data: { session } } = await supabase.auth.getSession();
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (session?.access_token) headers.Authorization = `Bearer ${session.access_token}`;
  return headers;
}

function TenantsPageContent() {
  const [tenants, setTenants] = useState<Tenant[]>([]);
  const [properties, setProperties] = useState<Property[]>([]);
  const [units, setUnits] = useState<any[]>([]);
  const [bills, setBills] = useState<Bill[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingBills, setLoadingBills] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [form, setForm] = useState({
    fullName: '',
    email: '',
    phone: '',
    unitId: '',
    leaseStart: '',
    leaseEnd: '',
    depositAmount: '',
    nationalId: '',
    kraPin: '',
    nextOfKinName: '',
    nextOfKinId: '',
    nextOfKinPhone: '',
    nextOfKinRelationship: '',
  });
  const [editingTenant, setEditingTenant] = useState<Tenant | null>(null);
  const [selectedTenant, setSelectedTenant] = useState<Tenant | null>(null);

  const [payForm, setPayForm] = useState({
    billId: '',
    amount: '',
    paymentMethod: 'Cash',
    referenceNumber: '',
  });

  const [directPaymentForm, setDirectPaymentForm] = useState({
    tenantId: '',
    transactionType: 'rent',
    monthDue: '',
    amount: '',
    paymentMethod: 'Cash',
    referenceNumber: '',
  });

  const [showPayForm, setShowPayForm] = useState(false);
  const [showDirectPayment, setShowDirectPayment] = useState(false);
  const [activeFilter, setActiveFilter] = useState('All');
  const formRef = useRef<HTMLDivElement>(null);
  const searchParams = useSearchParams();

  const filteredBills = bills.filter(bill => {
    if (activeFilter === 'All') return true;
    return bill.transaction_type?.toLowerCase() === activeFilter.toLowerCase();
  });

  const totalCharged = bills.reduce((sum, bill) => sum + (bill.due_amount || 0), 0);
  const totalPaidTenant = bills.reduce((sum, bill) => sum + (bill.paid_amount || 0), 0);
  const totalOutstanding = bills.reduce((sum, bill) => sum + (bill.balance || 0), 0);

  async function loadData() {
    setLoading(true);
    setError('');

    try {
      const [tenantsResponse, propertiesResponse, unitsResponse] = await Promise.all([
        fetch('/api/tenants', { headers: await getAuthHeaders() }),
        fetch('/api/properties', { headers: await getAuthHeaders() }),
        fetch('/api/units', { headers: await getAuthHeaders() }),
      ]);

      const tenantsResult = await tenantsResponse.json();
      const propertiesResult = await propertiesResponse.json();
      const unitsResult = await unitsResponse.json();

      setTenants(tenantsResult.tenants ?? []);
      setProperties(propertiesResult.properties ?? []);
      setUnits(unitsResult.units ?? []);
    } catch (err: any) {
      setError(err.message ?? 'Unable to load data.');
    } finally {
      setLoading(false);
    }
  }

  async function loadBills(tenantId: string) {
    setLoadingBills(true);
    try {
      const headers = await getAuthHeaders();
      const response = await fetch(`/api/bills?tenantId=${tenantId}`, { headers });
      const result = await response.json();
      setBills(result.bills ?? []);
    } catch (err: any) {
      console.error('Unable to load bills:', err.message);
    } finally {
      setLoadingBills(false);
    }
  }

  useEffect(() => {
    loadData();
  }, []);

  useEffect(() => {
    const email = searchParams.get('email');
    if (email && tenants.length > 0) {
      const tenant = tenants.find((t: Tenant) => t.email === email);
      if (tenant) {
        handleViewBills(tenant);
      }
    }
  }, [tenants, searchParams]);

  function scrollToForm() {
    formRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setMessage('');
    setError('');

    const selectedUnit = units.find(u => u.id === form.unitId);
    const propertyId = selectedUnit?.property_id;

    const url = editingTenant ? `/api/tenants?id=${editingTenant.id}` : '/api/tenants';
    const method = editingTenant ? 'PATCH' : 'POST';

    const body = editingTenant
      ? {
          id: editingTenant.id,
          fullName: form.fullName,
          email: form.email,
          phone: form.phone,
          leaseStart: form.leaseStart,
          leaseEnd: form.leaseEnd,
          nationalId: form.nationalId || null,
          kraPin: form.kraPin || null,
          nextOfKinName: form.nextOfKinName || null,
          nextOfKinId: form.nextOfKinId || null,
          nextOfKinPhone: form.nextOfKinPhone || null,
          nextOfKinRelationship: form.nextOfKinRelationship || null,
        }
      : { ...form, propertyId, depositAmount: Number(form.depositAmount) || 0, nationalId: form.nationalId || null, kraPin: form.kraPin || null, nextOfKinName: form.nextOfKinName || null, nextOfKinId: form.nextOfKinId || null, nextOfKinPhone: form.nextOfKinPhone || null, nextOfKinRelationship: form.nextOfKinRelationship || null };

    const response = await fetch(url, {
      method,
      headers: await getAuthHeaders(),
      body: JSON.stringify(body),
    });

    const result = await response.json();

    if (!response.ok) {
      setError(result.message ?? (editingTenant ? 'Unable to update tenant.' : 'Unable to create tenant.'));
      return;
    }

    setMessage(editingTenant ? 'Tenant updated.' : 'Tenant registered.');
    setForm({ fullName: '', email: '', phone: '', unitId: '', leaseStart: '', leaseEnd: '', depositAmount: '', nationalId: '', kraPin: '', nextOfKinName: '', nextOfKinId: '', nextOfKinPhone: '', nextOfKinRelationship: '' });
    setEditingTenant(null);
    await loadData();
  }

  async function handleRemove(tenantId: string) {
    if (!confirm('Remove this tenant? They will be marked as relocated and the unit will be freed.')) return;

    const tenant = tenants.find(t => t.id === tenantId);
    const unitId = tenant?.unit_id;

    const response = await fetch(`/api/tenants?id=${encodeURIComponent(tenantId)}`, { method: 'DELETE', headers: await getAuthHeaders() });
    const result = await response.json();
    if (!response.ok) {
      setError(result.message ?? 'Unable to remove tenant.');
      return;
    }

    setTenants(tenants.filter(t => t.id !== tenantId));

    if (unitId) {
      setUnits(units.map(u => u.id === unitId ? { ...u, occupancy_status: 'vacant' } : u));
    }

    setMessage('Tenant removed and unit marked as vacant.');
    await loadData();
  }

  function handleEdit(tenant: Tenant) {
    setEditingTenant(tenant);
    setForm({
      fullName: tenant.full_name,
      email: tenant.email,
      phone: tenant.phone ?? '',
      unitId: tenant.unit_id ?? '',
      leaseStart: tenant.lease_start ?? '',
      leaseEnd: tenant.lease_end ?? '',
      depositAmount: String(tenant.deposit_amount ?? ''),
      nationalId: tenant.national_id ?? '',
      kraPin: tenant.kra_pin ?? '',
      nextOfKinName: tenant.next_of_kin_name ?? '',
      nextOfKinId: tenant.next_of_kin_id ?? '',
      nextOfKinPhone: tenant.next_of_kin_phone ?? '',
      nextOfKinRelationship: tenant.next_of_kin_relationship ?? '',
    });
    scrollToForm();
  }

  function resetForm() {
    setForm({ fullName: '', email: '', phone: '', unitId: '', leaseStart: '', leaseEnd: '', depositAmount: '', nationalId: '', kraPin: '', nextOfKinName: '', nextOfKinId: '', nextOfKinPhone: '', nextOfKinRelationship: '' });
    setEditingTenant(null);
    setMessage('');
    setError('');
  }

  async function handleViewBills(tenant: Tenant) {
    setSelectedTenant(tenant);
    setPayForm({ billId: '', amount: '', paymentMethod: 'Cash', referenceNumber: '' });
    setShowPayForm(false);
    setDirectPaymentForm(f => ({ ...f, tenantId: tenant.id }));
    setShowDirectPayment(true);
    await loadBills(tenant.id);
    formRef.current?.scrollIntoView({ behavior: 'smooth' });
  }

  async function handleShowPayForm(billId: string, balance: number) {
    setPayForm({
      billId,
      amount: String(balance),
      paymentMethod: 'Cash',
      referenceNumber: '',
    });
    setShowPayForm(true);
  }

  async function handleRecordPayment(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setMessage('');
    setError('');

    if (!payForm.billId || !payForm.amount) {
      setError('Select a bill and enter amount.');
      return;
    }

    const response = await fetch('/api/bills', {
      method: 'PATCH',
      headers: await getAuthHeaders(),
      body: JSON.stringify({
        id: payForm.billId,
        paidAmount: Number(payForm.amount),
        paymentMethod: payForm.paymentMethod,
        referenceNumber: payForm.referenceNumber,
      }),
    });

    const result = await response.json();
    if (!response.ok) {
      setError(result.message ?? 'Unable to record payment.');
      return;
    }
    setMessage('Payment recorded.');
    setShowPayForm(false);
    await loadBills(selectedTenant!.id);
  }

  async function handleDirectPayment(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setMessage('');
    setError('');

    if (!directPaymentForm.tenantId || !directPaymentForm.transactionType || !directPaymentForm.amount) {
      setError('All fields required.');
      return;
    }

    const response = await fetch('/api/bills', {
      method: 'POST',
      headers: await getAuthHeaders(),
      body: JSON.stringify({
        tenantId: directPaymentForm.tenantId,
        unitId: tenants.find(t => t.id === directPaymentForm.tenantId)?.unit_id,
        propertyId: tenants.find(t => t.id === directPaymentForm.tenantId)?.property_id,
        description: `${directPaymentForm.transactionType.replace('_', ' ')} payment`,
        monthDue: directPaymentForm.monthDue || null,
        dueAmount: Number(directPaymentForm.amount),
        paidAmount: Number(directPaymentForm.amount),
        penaltyFee: 0,
        transactionType: directPaymentForm.transactionType,
        paymentMethod: directPaymentForm.paymentMethod,
        referenceNumber: directPaymentForm.referenceNumber,
      }),
    });

    const result = await response.json();
    if (!response.ok) {
      setError(result.message ?? 'Unable to record payment.');
      return;
    }
    setMessage('Direct payment recorded.');
    setDirectPaymentForm({ tenantId: '', transactionType: 'rent', monthDue: '', amount: '', paymentMethod: 'Cash', referenceNumber: '' });
    if (selectedTenant) await loadBills(selectedTenant.id);
  }

  async function downloadTenantStatement() {
    if (!selectedTenant) return;
    const pdfDoc = await PDFDocument.create();
    const page = pdfDoc.addPage([595.28, 841.89]);
    const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
    const boldFont = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
    let y = 800;

    page.drawText(`Payment Statement - ${selectedTenant.full_name}`, { x: 50, y, font: boldFont, size: 18, color: rgb(0.1, 0.1, 0.1) });
    y -= 30;
    page.drawText(`${selectedTenant.property} · Unit ${selectedTenant.unit}`, { x: 50, y, font, size: 11, color: rgb(0.3, 0.3, 0.3) });
    y -= 16;
    page.drawText(`Email: ${selectedTenant.email} | Phone: ${selectedTenant.phone || '—'}`, { x: 50, y, font, size: 10, color: rgb(0.4, 0.4, 0.4) });
    y -= 30;

    const headers = ['Date', 'Description', 'Month Due', 'Due (KES)', 'Paid (KES)', 'Balance (KES)'];
    let x = 50;
    headers.forEach(h => {
      page.drawText(h, { x, y, font: boldFont, size: 10, color: rgb(0.2, 0.2, 0.2) });
      x += 100;
    });
    y -= 14;

    filteredBills.forEach((bill: any) => {
      x = 50;
      page.drawText(new Date(bill.created_at).toLocaleDateString('en-GB'), { x, y, font, size: 9, color: rgb(0.2, 0.2, 0.2) });
      x += 100;
      page.drawText(bill.description || '—', { x, y, font, size: 9, color: rgb(0.2, 0.2, 0.2) });
      x += 100;
      page.drawText(bill.month_due || '—', { x, y, font, size: 9, color: rgb(0.2, 0.2, 0.2) });
      x += 100;
      page.drawText((bill.due_amount || 0).toLocaleString(), { x, y, font, size: 9, color: rgb(0.2, 0.2, 0.2) });
      x += 100;
      page.drawText((bill.paid_amount || 0).toLocaleString(), { x, y, font, size: 9, color: rgb(0.2, 0.2, 0.2) });
      x += 100;
      page.drawText((bill.balance || 0).toLocaleString(), { x, y, font, size: 9, color: bill.balance > 0 ? rgb(0.7, 0.1, 0.1) : rgb(0.1, 0.4, 0.1) });
      y -= 12;
    });

    y -= 12;
    page.drawText(`Total Charged: KES ${totalCharged.toLocaleString()}`, { x: 50, y, font: boldFont, size: 11, color: rgb(0.2, 0.2, 0.2) });
    page.drawText(`Total Paid: KES ${totalPaidTenant.toLocaleString()}`, { x: 200, y, font: boldFont, size: 11, color: rgb(0.1, 0.4, 0.1) });
    page.drawText(`Outstanding: KES ${totalOutstanding.toLocaleString()}`, { x: 350, y, font: boldFont, size: 11, color: totalOutstanding > 0 ? rgb(0.7, 0.1, 0.1) : rgb(0.1, 0.4, 0.1) });

    const pdfBytes = await pdfDoc.save();
    const blob = new Blob([new Uint8Array(pdfBytes)], { type: 'application/pdf' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `tenant-statement-${selectedTenant.id}.pdf`;
    a.click();
    URL.revokeObjectURL(url);
  }

  const transactionTypes = ['rent', 'water', 'garbage', 'service_charge', 'parking', 'security', 'other', 'deposit'];

  return (
    <>
      <main className="container admin-no-hero">
        <div className="card-admin-header">
          <div>
            <p className="heading">Tenant Management</p>
            <p className="subheading">Register tenants, update lease info, and manage occupancy.</p>
          </div>
        </div>

        <section className="card-grid">
          <article className="card" style={{ gridColumn: 'span 2' }}>
            <div className="card-label">
              <span className="badge badge-pm">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13 a4 0 0 1 0 7.75"/></svg>
              </span>{editingTenant ? 'Edit Tenant' : 'Add Tenant'}
            </div>
            <h3>{editingTenant ? 'Update Tenant Details' : 'Register New Tenant'}</h3>
            <form onSubmit={handleSubmit} className="form-grid">
              <input value={form.fullName} onChange={e => setForm(f => ({ ...f, fullName: e.target.value }))} required placeholder="Full name" />
              <input type="email" value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))} required placeholder="Email" />
              <input value={form.phone} onChange={e => setForm(f => ({ ...f, phone: e.target.value }))} placeholder="Phone" />
              <input value={form.nationalId} onChange={e => setForm(f => ({ ...f, nationalId: e.target.value }))} placeholder="National ID (Optional)" />
              <input value={form.kraPin} onChange={e => setForm(f => ({ ...f, kraPin: e.target.value }))} placeholder="KRA PIN (Optional)" />
              <input value={form.nextOfKinName} onChange={e => setForm(f => ({ ...f, nextOfKinName: e.target.value }))} placeholder="Next of Kin Name (Optional)" />
              <input value={form.nextOfKinId} onChange={e => setForm(f => ({ ...f, nextOfKinId: e.target.value }))} placeholder="Next of Kin ID (Optional)" />
              <input value={form.nextOfKinPhone} onChange={e => setForm(f => ({ ...f, nextOfKinPhone: e.target.value }))} placeholder="Next of Kin Phone (Optional)" />
              <input value={form.nextOfKinRelationship} onChange={e => setForm(f => ({ ...f, nextOfKinRelationship: e.target.value }))} placeholder="Next of Kin Relationship (Optional)" />
              {!editingTenant && (
                <select value={form.unitId} onChange={e => setForm(f => ({ ...f, unitId: e.target.value }))} required>
                  <option value="">Select unit</option>
                  {units.filter(u => u.occupancy_status === 'vacant').map(u => (
                    <option key={u.id} value={u.id}>{u.unit_number} - {properties.find(p => p.id === (u as any).property_id)?.name ?? '—'}</option>
                  ))}
                </select>
              )}
              <input type="date" value={form.leaseStart} onChange={e => setForm(f => ({ ...f, leaseStart: e.target.value }))} required />
              <input type="date" value={form.leaseEnd} onChange={e => setForm(f => ({ ...f, leaseEnd: e.target.value }))} required />
              {!editingTenant && <input type="number" value={form.depositAmount} onChange={e => setForm(f => ({ ...f, depositAmount: e.target.value }))} placeholder="Deposit amount" />}
              <button type="submit" className="action-button primary">{editingTenant ? 'Update Tenant' : 'Add Tenant'}</button>
              {editingTenant && <button type="button" className="action-button ghost" onClick={resetForm}>Cancel Edit</button>}
            </form>
            {message && <p className="landlord-success" style={{ marginTop: 16 }}>{message}</p>}
            {error && <p className="landlord-error" style={{ marginTop: 16 }}>{error}</p>}
          </article>
        </section>

        <section className="card-grid-item">
          <article className="card">
            <div className="card-label">
              <span className="badge badge-agent">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><rect x="1" y="4" width="22" height="16" rx="2"/><line x1="1" y1="10" x2="23" y2="10"/></svg>
              </span>All Tenants
            </div>
            <h3 style={{ marginBottom: 16 }}>Tenant Records</h3>

            {loading && <p className="landlord-muted">Loading tenants...</p>}
            {!loading && tenants.length === 0 && <p className="landlord-empty">No tenants registered yet.</p>}

            {!loading && tenants.length > 0 && (
              <div className="table-shell">
                <table className="landlord-table" style={{ fontSize: '13px' }}>
                  <thead>
                    <tr>
                      <th>Name</th>
                      <th>Email</th>
                      <th>Phone</th>
                      <th>Unit</th>
                      <th>Property</th>
                      <th>Lease</th>
                      <th>Status</th>
                      <th>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {tenants.map(tenant => (
                      <tr key={tenant.id}>
                        <td className="landlord-name">{tenant.full_name}</td>
                        <td>{tenant.email}</td>
                        <td>{tenant.phone || '-'}</td>
                        <td>{tenant.unit}</td>
                        <td>{tenant.property}</td>
                        <td>{tenant.lease_start} → {tenant.lease_end}</td>
                        <td>
                          <span className={`status-pill ${tenant.status === 'active' || !tenant.status ? 'status-active' : 'status-pending'}`}>
                            {tenant.status ?? 'Active'}
                          </span>
                        </td>
                        <td>
                          <div className="landlord-actions">
                            <button className="action-button warn" style={{ padding: '6px 10px', fontSize: '12px' }} onClick={() => handleEdit(tenant)}>Edit</button>
                            <button className="action-button secondary" style={{ padding: '6px 10px', fontSize: '12px' }} onClick={() => handleViewBills(tenant)}>Bills</button>
                            <button className="action-button danger" style={{ padding: '6px 10px', fontSize: '12px' }} onClick={() => handleRemove(tenant.id)}>Remove</button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </article>
        </section>

        {selectedTenant && (
          <section className="card-grid-item" style={{ marginTop: 24 }} ref={formRef}>
            <article className="card" style={{ gridColumn: 'span 2' }}>
              <div className="card-label">
                <span className="badge badge-pm" style={{ background: 'var(--accent)' }}>
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>
                </span>Payment History
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 24, padding: 16, background: 'var(--surface)', borderRadius: 8 }}>
                <div style={{ width: 64, height: 64, borderRadius: '50%', background: '#1e3a8a', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontSize: '24px', fontWeight: 700 }}>
                  {(selectedTenant.full_name || '').split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2)}
                </div>
                <div style={{ flex: 1 }}>
                  <h2 style={{ margin: 0, fontSize: '24px', fontWeight: 600, color: '#111827' }}>{selectedTenant.full_name}</h2>
                  <p style={{ margin: '4px 0', color: '#6b7280' }}>{selectedTenant.property} · Unit {selectedTenant.unit}</p>
                  <p style={{ margin: '4px 0', color: '#6b7280' }}>{selectedTenant.email} · {selectedTenant.phone}</p>
                  <p style={{ margin: '4px 0', color: '#6b7280' }}>Lease: {selectedTenant.lease_start} → {selectedTenant.lease_end}</p>
                </div>
              </div>

              <div style={{ display: 'flex', gap: 24, marginBottom: 24 }}>
                <div style={{ flex: 1, padding: 16, background: 'var(--card)', borderRadius: 8, textAlign: 'center' }}>
                  <div style={{ fontSize: '13px', color: '#6b7280', marginBottom: 4 }}>Monthly Rent</div>
                  <div style={{ fontSize: '24px', fontWeight: 600, color: '#111827' }}>KES {selectedTenant.deposit_amount ? Number(selectedTenant.deposit_amount).toLocaleString() : '0'}</div>
                </div>
                <div style={{ flex: 1, padding: 16, background: 'var(--card)', borderRadius: 8, textAlign: 'center' }}>
                  <div style={{ fontSize: '13px', color: '#6b7280', marginBottom: 4 }}>Total Charged</div>
                  <div style={{ fontSize: '24px', fontWeight: 600, color: '#111827' }}>KES {totalCharged.toLocaleString()}</div>
                </div>
                <div style={{ flex: 1, padding: 16, background: 'var(--card)', borderRadius: 8, textAlign: 'center' }}>
                  <div style={{ fontSize: '13px', color: '#6b7280', marginBottom: 4 }}>Total Paid</div>
                  <div style={{ fontSize: '24px', fontWeight: 600, color: '#111827' }}>KES {totalPaidTenant.toLocaleString()}</div>
                </div>
                <div style={{ flex: 1, padding: 16, background: 'var(--card)', borderRadius: 8, textAlign: 'center' }}>
                  <div style={{ fontSize: '13px', color: '#6b7280', marginBottom: 4 }}>Outstanding</div>
                  <div style={{ fontSize: '24px', fontWeight: 600, color: totalOutstanding > 0 ? '#dc2626' : '#111827' }}>KES {totalOutstanding.toLocaleString()}</div>
                </div>
              </div>

              <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
                {['All', 'Deposit', 'Rent', 'Water'].map(type => (
                  <button key={type} className={`action-button ${activeFilter === type ? 'primary' : 'secondary'}`} style={{ padding: '6px 12px', fontSize: '12px' }} onClick={() => setActiveFilter(type)}>{type}</button>
                ))}
                <button onClick={downloadTenantStatement} className="action-button primary" style={{ padding: '6px 12px', fontSize: '12px', marginLeft: 'auto' }}>Download PDF</button>
              </div>

              <div style={{ marginBottom: 16 }}>
                <button className="action-button secondary" style={{ padding: '6px 12px' }} onClick={() => setShowDirectPayment(!showDirectPayment)}>Record Payment</button>
              </div>

              {showDirectPayment && (
                <div className="card" style={{ marginBottom: 16, background: 'var(--surface)' }}>
                  <h3>Record Direct Payment</h3>
                  <form onSubmit={handleDirectPayment} className="form-grid">
                    <div className="field-group">
                      <label>Transaction Type</label>
                      <select value={directPaymentForm.transactionType} onChange={e => setDirectPaymentForm(f => ({ ...f, transactionType: e.target.value }))}>
                        {transactionTypes.map(t => <option key={t} value={t}>{t.replace('_', ' ')}</option>)}
                      </select>
                    </div>
                    <div className="field-group">
                      <label>Month Due</label>
                      <input type="month" value={directPaymentForm.monthDue} onChange={e => setDirectPaymentForm(f => ({ ...f, monthDue: e.target.value }))} />
                    </div>
                    <div className="field-group">
                      <label>Amount (KSH)</label>
                      <input type="number" value={directPaymentForm.amount} onChange={e => setDirectPaymentForm(f => ({ ...f, amount: e.target.value }))} required placeholder="Amount" />
                    </div>
                    <div className="field-group">
                      <label>Payment Method</label>
                      <select value={directPaymentForm.paymentMethod} onChange={e => setDirectPaymentForm(f => ({ ...f, paymentMethod: e.target.value }))}>
                        <option value="Cash">Cash</option>
                        <option value="M-pesa">M-pesa</option>
                        <option value="Bank Transfer">Bank Transfer</option>
                      </select>
                    </div>
                    <div className="field-group">
                      <label>Reference Number</label>
                      <input value={directPaymentForm.referenceNumber} onChange={e => setDirectPaymentForm(f => ({ ...f, referenceNumber: e.target.value }))} placeholder="e.g., SH31T8MAYN" />
                    </div>
                    <button type="submit" className="action-button primary">Record Payment</button>
                  </form>
                </div>
              )}

              {showPayForm && (
                <div className="card" style={{ marginBottom: 16, background: 'var(--surface)' }}>
                  <h3>Make Payment</h3>
                  <form onSubmit={handleRecordPayment} className="form-grid">
                    <div className="field-group">
                      <label>Amount (KSH)</label>
                      <input type="number" value={payForm.amount} onChange={e => setPayForm(f => ({ ...f, amount: e.target.value }))} required placeholder="Amount" />
                    </div>
                    <div className="field-group">
                      <label>Payment Method</label>
                      <select value={payForm.paymentMethod} onChange={e => setPayForm(f => ({ ...f, paymentMethod: e.target.value }))}>
                        <option value="Cash">Cash</option>
                        <option value="M-pesa">M-pesa</option>
                        <option value="Bank Transfer">Bank Transfer</option>
                      </select>
                    </div>
                    <div className="field-group">
                      <label>Reference Number</label>
                      <input value={payForm.referenceNumber} onChange={e => setPayForm(f => ({ ...f, referenceNumber: e.target.value }))} placeholder="e.g., SH31T8MAYN" />
                    </div>
                    <button type="submit" className="action-button primary">Record Payment</button>
                    <button type="button" className="action-button ghost" onClick={() => setShowPayForm(false)}>Cancel</button>
                  </form>
                </div>
              )}

              <h3 style={{ marginBottom: 16 }}>Transactions ({filteredBills.length} records)</h3>
              {loadingBills && <p className="landlord-muted">Loading bills...</p>}
              {!loadingBills && bills.length === 0 && <p className="landlord-empty">No bills recorded yet.</p>}

              {!loadingBills && bills.length > 0 && (
                <div className="table-shell" style={{ maxHeight: '400px', overflowY: 'auto' }}>
                  <table className="landlord-table" style={{ fontSize: '12px' }}>
                    <thead>
                      <tr>
                        <th>Tenant</th>
                        <th>Month Due</th>
                        <th>Trans Code</th>
                        <th>Due (KES)</th>
                        <th>Paid (KES)</th>
                        <th>Balance (KES)</th>
                        <th>Type</th>
                        <th>Trans #</th>
                        <th>Date</th>
                        <th>Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredBills.map(bill => (
                        <tr key={bill.id}>
                          <td className="landlord-name">
                            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                              <div style={{ width: 28, height: 28, borderRadius: '50%', background: '#1e3a8a', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontSize: '11px', fontWeight: 600 }}>
                                {(selectedTenant.full_name || '').split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2)}
                              </div>
                              <span>{selectedTenant.full_name}</span>
                            </div>
                          </td>
                          <td>{bill.month_due || '-'}</td>
                          <td style={{ fontSize: '12px' }}>{bill.transaction_code || '-'}</td>
                          <td>{bill.due_amount.toLocaleString()}</td>
                          <td>{bill.paid_amount?.toLocaleString() || '-'}</td>
                          <td style={{ color: bill.balance > 0 ? 'var(--error)' : 'var(--accent)' }}>{bill.balance?.toLocaleString() ?? '0'}</td>
                          <td><span style={{ textTransform: 'capitalize', fontSize: '11px' }}>{bill.transaction_type}</span></td>
                          <td style={{ fontSize: '12px' }}>{bill.transaction_number || '-'}</td>
                          <td>{bill.payment_date ? new Date(bill.payment_date).toLocaleDateString('en-GB') : '-'}</td>
                          <td>
                            {bill.balance > 0 && (
                              <button className="action-button warn" style={{ padding: '6px 10px', fontSize: '12px' }} onClick={() => handleShowPayForm(bill.id, bill.balance ?? 0)}>Pay</button>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
              <button type="button" className="action-button ghost" onClick={() => setSelectedTenant(null)} style={{ marginTop: 16 }}>Back to Tenants</button>
            </article>
          </section>
        )}
      </main>

      <footer>
        <div className="footer-inner">
          <div className="footer-brand"><span className="logo-mark" style={{ width: 26, height: 26, borderRadius: 7 }}><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M3 21h18"/><path d="M5 21V7l8-4v18"/><path d="M19 21V11l-6-4"/></svg></span>Springfield Systems</div>
          <div className="footer-links"><a href="/">Home</a><a href="/dashboard">Dashboard</a></div>
          <div className="footer-copy">© 2026 Springfield Systems. All rights reserved.</div>
        </div>
      </footer>
    </>
  );
}

export default function TenantsPage() {
  return (
    <Suspense fallback={<div style={{ padding: 40, textAlign: 'center' }}>Loading...</div>}>
      <TenantsPageContent />
    </Suspense>
  );
}