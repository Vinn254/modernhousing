'use client';

import { useEffect, useRef, useState, useMemo } from 'react';
import { supabase } from '../../lib/supabaseClient';
import Sparkline from '../components/Sparkline';
import { DashboardHeader, FormField, StatCard } from '../components/dashboard-ui';

interface Unit {
  id: string;
  property_id: string;
  unit_number: string;
  rent_amount: number;
  occupancy_status: string;
  unit_type?: string;
  short_code?: string;
}

interface Property {
  id: string;
  name: string;
  address: string;
  size?: string;
  amenities?: string;
  ownership_info?: string;
  created_at?: string;
  unit_count?: number;
  occupied_units?: number;
  tenant_count?: number;
  rent_roll?: number;
  unitCount?: number;
}

const emptyForm = {
  name: '',
  address: '',
  size: '',
  amenities: '',
  ownershipInfo: '',
  unitCount: '',
};

async function getAuthHeaders() {
  const { data } = await supabase.auth.getSession();
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (data.session?.access_token) headers.Authorization = `Bearer ${data.session.access_token}`;
  return headers;
}

const formatCurrency = (value: number) => `KSH ${(value || 0).toLocaleString()}`;

export default function PropertiesPage() {
  const formRef = useRef<HTMLDivElement>(null);
  const [properties, setProperties] = useState<Property[]>([]);
  const [units, setUnits] = useState<Unit[]>([]);
  const [monthlyPayments, setMonthlyPayments] = useState<any[]>([]);
  const [showPaymentsModal, setShowPaymentsModal] = useState(false);
  const [selectedMonth, setSelectedMonth] = useState(new Date().toISOString().slice(0, 7)); // YYYY-MM
  const [form, setForm] = useState(emptyForm);
  const [unitForm, setUnitForm] = useState({ propertyId: '', unitNumbers: '', rentAmount: '', unitType: '', shortCode: '' });
  const [editingProperty, setEditingProperty] = useState<Property | null>(null);
  const [selectedProperty, setSelectedProperty] = useState<Property | null>(null);
  const [editingUnit, setEditingUnit] = useState<Unit | null>(null);
  const [unitEditForm, setUnitEditForm] = useState({ unitNumber: '', rentAmount: '', unitType: '', occupancyStatus: '', shortCode: '' });
  const [showUnitEdit, setShowUnitEdit] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  async function loadMonthlyPayments() {
    try {
      const [paymentsResponse, billsResponse] = await Promise.all([
        fetch('/api/payments', { headers: await getAuthHeaders() }),
        fetch('/api/bills', { headers: await getAuthHeaders() }),
      ]);
      const paymentsResult = paymentsResponse.ok ? await paymentsResponse.json() : {};
      const billsResult = billsResponse.ok ? await billsResponse.json() : {};
const merged = [...(paymentsResult.payments ?? []).map((p: any) => ({
        ...p,
        created_at: p.paid_at || p.created_at,
      })), ...(billsResult.bills ?? []).map((b: any) => ({
        ...b,
        amount: b.paid_amount ?? b.amount,
        created_at: b.payment_date || b.paid_at || b.created_at,
        payment_date: b.payment_date,
        source: 'bills',
        tenant: b.tenant_name ?? '',
      }))];
     setMonthlyPayments(merged);
    } catch (e) {}
  }

  async function loadProperties() {
    setLoading(true);
    setError('');

    const response = await fetch('/api/properties', {
      headers: await getAuthHeaders(),
    });
    const result = await response.json();

    if (!response.ok) {
      setError(result.message ?? 'Unable to load properties.');
      setLoading(false);
      return;
    }

    setProperties(result.properties ?? []);
    setLoading(false);
  }

  async function loadUnits() {
    try {
      const response = await fetch('/api/units', { headers: await getAuthHeaders() });
      const result = await response.json();
      if (response.ok) {
        setUnits(result.units ?? []);
      } else {
        console.error('Failed to load units:', result.message);
        setError(result.message || 'Failed to load units.');
      }
    } catch (e) {
      setError('Failed to load units.');
    }
  }

  useEffect(() => {
    Promise.all([loadProperties(), loadUnits(), loadMonthlyPayments()]);
  }, []);

  useEffect(() => {
    if (!selectedProperty) return;
    const refreshed = properties.find((property) => property.id === selectedProperty.id);
    if (refreshed) setSelectedProperty(refreshed);
  }, [properties, selectedProperty]);

  function updateForm(field: keyof typeof form, value: string) {
    setForm((current) => ({ ...current, [field]: value }));
  }

  function resetForm() {
    setForm(emptyForm);
    setEditingProperty(null);
    setMessage('');
    setError('');
  }

  function scrollToForm() {
    formRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setMessage('');
    setError('');
    setSaving(true);

    const body = editingProperty ? { ...form, id: editingProperty.id } : form;

    const response = await fetch('/api/properties', {
      method: editingProperty ? 'PATCH' : 'POST',
      headers: await getAuthHeaders(),
      body: JSON.stringify(body),
    });

    const result = await response.json();
    setSaving(false);

    if (!response.ok) {
      setError(result.message || (editingProperty ? 'Unable to update property.' : 'Unable to create property.'));
      return;
    }

    setMessage(editingProperty ? 'Property updated successfully.' : 'Property created successfully.');
    resetForm();
    await loadProperties();
  }

  async function handleEdit(property: Property) {
    setEditingProperty(property);
    setForm({
      name: property.name,
      address: property.address,
      size: property.size ?? '',
      amenities: property.amenities ?? '',
      ownershipInfo: property.ownership_info ?? '',
      unitCount: String(property.unit_count ?? property.unitCount ?? ''),
    });
    setMessage('');
    setError('');
    scrollToForm();
  }

  async function handleRemove(propertyId: string) {
    if (!confirm('Remove this property? Units and tenants assigned to it will also be removed.')) return;

    const response = await fetch(`/api/properties?id=${encodeURIComponent(propertyId)}`, {
      method: 'DELETE',
      headers: await getAuthHeaders(),
    });
    const result = await response.json();

    if (!response.ok) {
      setError(result.message || 'Unable to remove property.');
      return;
    }

    setMessage('Property removed.');
    if (selectedProperty?.id === propertyId) setSelectedProperty(null);
    await loadProperties();
  }

  async function handleAddUnits(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setMessage('');
    setError('');

    if (!unitForm.propertyId || !unitForm.unitNumbers.trim()) {
      setError('Property and unit numbers are required.');
      return;
    }

    if (!unitForm.shortCode || !unitForm.shortCode.trim()) {
      setError('Short code is required for each unit. This is used as the paybill account number.');
      return;
    }

    const unitNumbers = unitForm.unitNumbers.split(',').map(u => u.trim()).filter(Boolean);
    const rentAmount = Number(unitForm.rentAmount) || 0;
    const unitType = unitForm.unitType;
    const shortCode = unitForm.shortCode.trim();

    for (const unitNumber of unitNumbers) {
      const response = await fetch('/api/units', {
        method: 'POST',
        headers: await getAuthHeaders(),
        body: JSON.stringify({
          propertyId: unitForm.propertyId,
          unitNumber,
          rentAmount,
          unitType,
          shortCode,
          occupancyStatus: 'vacant',
        }),
      });

      const result = await response.json();
      if (!response.ok) {
        setError(`Failed to add unit ${unitNumber}: ${result.message || 'Unknown error'}`);
        return;
      }
    }

    setMessage(`${unitNumbers.length} unit(s) added successfully.`);
    setUnitForm({ propertyId: '', unitNumbers: '', rentAmount: '', unitType: '', shortCode: '' });
    await Promise.all([loadProperties(), loadUnits()]);
  }

  async function handleEditUnit(unit: Unit) {
    setEditingUnit(unit);
    setUnitEditForm({
      unitNumber: unit.unit_number,
      rentAmount: String(unit.rent_amount ?? ''),
      unitType: unit.unit_type ?? '',
      occupancyStatus: unit.occupancy_status ?? 'vacant',
      shortCode: unit.short_code ?? '',
    });
    setShowUnitEdit(true);
    setMessage('');
    setError('');
  }

  async function handleUnitEditSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!editingUnit) return;

    const response = await fetch(`/api/units?id=${editingUnit.id}`, {
      method: 'PATCH',
      headers: await getAuthHeaders(),
      body: JSON.stringify({
        unitNumber: unitEditForm.unitNumber,
        rentAmount: Number(unitEditForm.rentAmount) || 0,
        unitType: unitEditForm.unitType || null,
        occupancyStatus: unitEditForm.occupancyStatus,
        shortCode: unitEditForm.shortCode,
      }),
    });

    const result = await response.json();
    if (!response.ok) {
      setError(result.message ?? 'Unable to update unit.');
      return;
    }

    setMessage('Unit updated.');
    setShowUnitEdit(false);
    setEditingUnit(null);
    await loadUnits();
  }

  async function handleMarkOccupied(unitId: string) {
    const response = await fetch(`/api/units?id=${unitId}`, {
      method: 'PATCH',
      headers: await getAuthHeaders(),
      body: JSON.stringify({ occupancyStatus: 'occupied' }),
    });

    const result = await response.json();
    if (!response.ok) {
      setError(result.message ?? 'Unable to update unit status.');
      return;
    }

    setMessage('Unit marked as occupied.');
    await loadUnits();
  }

  async function handleMarkVacant(unitId: string) {
    if (!confirm('Mark this unit as vacant?')) return;

    const response = await fetch(`/api/units?id=${unitId}`, {
      method: 'PATCH',
      headers: await getAuthHeaders(),
      body: JSON.stringify({ occupancyStatus: 'vacant' }),
    });

    const result = await response.json();
    if (!response.ok) {
      setError(result.message ?? 'Unable to update unit status.');
      return;
    }

    setMessage('Unit marked as vacant.');
    await loadUnits();
  }

  async function handleDeleteUnit(unitId: string) {
    if (!confirm('Delete this unit?')) return;

    const response = await fetch(`/api/units?id=${unitId}`, {
      method: 'DELETE',
      headers: await getAuthHeaders(),
    });

    const result = await response.json();
    if (!response.ok) {
      setError(result.message ?? 'Unable to delete unit.');
      return;
    }

    setMessage('Unit deleted.');
    await loadUnits();
  }

  const totalUnits = properties.reduce((sum, property) => sum + Number(property.unit_count ?? 0), 0);
  const occupiedUnits = properties.reduce((sum, property) => sum + Number(property.occupied_units ?? 0), 0);
  const totalTenants = properties.reduce((sum, property) => sum + Number(property.tenant_count ?? 0), 0);
  const rentRoll = properties.reduce((sum, property) => sum + Number(property.rent_roll ?? 0), 0);
  const occupancyRate = totalUnits > 0 ? Math.round((occupiedUnits / totalUnits) * 100) : 0;

// Filter payments by month_due format (e.g., "July 2026" or "July") matching selected month (YYYY-MM)
   const [selectedYear, selectedMonthNum] = selectedMonth.split('-').map(Number);
   const monthNamesFull = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
   const selectedMonthNameFull = monthNamesFull[selectedMonthNum - 1] + ' ' + selectedYear;
   const selectedMonthNameShort = monthNamesFull[selectedMonthNum - 1];
   const filteredPayments = monthlyPayments.filter((p: any) => {
     if (['complaint', 'notification'].includes(p.transaction_type)) return false;
     const monthDue = (p.month_due || '').toLowerCase();
     // Only use payment date if month_due is not set at all
     if (!monthDue) {
       const paymentDate = p.paid_at || p.payment_date || p.created_at;
       if (paymentDate) {
         const d = new Date(paymentDate);
         const paymentMonth = d.toISOString().slice(0, 7);
         return paymentMonth === selectedMonth;
       }
       return false;
     }
     return monthDue.includes(selectedMonthNameFull.toLowerCase()) || monthDue.includes(selectedMonth.toLowerCase()) || monthDue.includes(selectedMonthNameShort.toLowerCase());
   });
  const filteredTotal = filteredPayments.reduce((sum: number, p: any) => sum + Number(p.paid_amount ?? p.amount ?? 0), 0);

const monthlyData = useMemo(() => {
     const months: { label: string; value: number }[] = [];
     const monthMap = new Map<string, number>();
     const labels = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
     const monthNames = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
     const currentYear = new Date().getFullYear();
     
     // Generate keys for all 12 months of current year
     for (let i = 0; i < 12; i++) {
       const key = `${currentYear}-${String(i + 1).padStart(2, '0')}`;
       monthMap.set(key, 0);
     }
     
     (monthlyPayments || []).forEach((p: any) => {
       if (['complaint', 'notification'].includes(p.transaction_type)) return;
       const paidAmt = Number(p.paid_amount ?? p.amount ?? 0);
       if (p.month_due) {
         const monthParts = p.month_due?.split(' ');
         if (monthParts?.length >= 2) {
           const monthName = monthParts[0];
           let year = monthParts[1]; if (!year || isNaN(Number(year))) { year = String(currentYear); }
           const monthIdx = monthNames.indexOf(monthName);
           if (monthIdx >= 0) {
             const key = `${year}-${String(monthIdx + 1).padStart(2, '0')}`;
             monthMap.set(key, (monthMap.get(key) || 0) + paidAmt);
             return;
           }
         }
       }
       const d = p.paid_at ? new Date(p.paid_at) : (p.payment_date ? new Date(p.payment_date) : (p.created_at ? new Date(p.created_at) : new Date()));
       const key = d.toISOString().slice(0, 7);
       monthMap.set(key, (monthMap.get(key) || 0) + paidAmt);
});
for (let i = 0; i < 12; i++) {
       const key = `${currentYear}-${String(i + 1).padStart(2, '0')}`;
       months.push({ label: labels[i], value: monthMap.get(key) || 0 });
     }
     return months;
   }, [monthlyPayments]);

   const currentMonthVal = monthlyData[new Date().getMonth()]?.value || 0;
   const prevMonthVal = monthlyData[new Date().getMonth() === 0 ? 11 : new Date().getMonth() - 1]?.value || 0;
   const revenueTrendPercent = prevMonthVal > 0 ? ((currentMonthVal - prevMonthVal) / prevMonthVal * 100) : currentMonthVal > 0 ? 100 : 0;

  // Get units for selected property
  const selectedPropertyUnits = selectedProperty 
    ? units.filter(u => u.property_id === selectedProperty.id) 
    : [];

  return (
    <>
      <main className="property-page-main">
      <DashboardHeader
        title="Properties"
        subtitle="Build your portfolio, track units, and keep every property ready for agents and tenants."
        action={<button type="button" className="btn" onClick={scrollToForm}>Add Property</button>}
      />

      {message && <p className="landlord-success property-alert">{message}</p>}
      {error && <p className="landlord-error property-alert">{error}</p>}

      <section className="landlord-section property-section">
<div className="bento-grid property-stats">
          <StatCard title="Portfolio" value={properties.length} caption="Active properties in your workspace." accent="indigo" icon={<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#1e3a8a" strokeWidth="2"><path d="M3 21h18"/><path d="M5 21V7l8-4v18"/><path d="M19 21V11l-6-4"/></svg>} />
          <StatCard title="Total Units" value={totalUnits} caption="Units recorded across all properties." accent="sky" icon={<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="var(--amber)" strokeWidth="2"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/></svg>} />
          <StatCard title="Vacant Units" value={Math.max(totalUnits - occupiedUnits, 0)} caption="Available units waiting for tenants." accent="amber" icon={<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#8b5cf6" strokeWidth="2"><rect x="3" y="3" width="18" height="18" rx="2"/><path d="M15 3v18"/><path d="M9 3v18"/><path d="M3 9h18"/><path d="M3 15h14"/></svg>} />
          <StatCard title="Rent Roll" value={`KSH ${rentRoll.toLocaleString()}`} caption="Monthly rent from recorded units." accent="emerald" icon={<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#0ea5e9" strokeWidth="2"><path d="M12 1v22"/><path d="M5 5h14"/><path d="M5 19h14"/></svg>} />
          <StatCard title="Revenue Trend" value={formatCurrency(currentMonthVal)} caption="per month collected" accent="slate" icon={<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="var(--accent)" strokeWidth="2"><path d="M12 1v22"/><path d="M5 5h14"/><path d="M5 19h14"/></svg>} trend={<div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}><span style={{ color: revenueTrendPercent >= 0 ? 'var(--accent)' : '#b91c1c', fontWeight: 700 }}>{revenueTrendPercent >= 0 ? '+' : ''}{revenueTrendPercent.toFixed(1)}%</span><Sparkline data={monthlyData.map((m) => m.value).length > 0 ? monthlyData.map((m) => m.value) : [0, 0, 0]} color="#10b981" w={220} h={40} /></div>} onClick={() => setShowPaymentsModal(true)} />
        </div>

        {showPaymentsModal && (
          <div className="modal-overlay" onClick={() => setShowPaymentsModal(false)}>
            <div className="modal-card" style={{ minHeight: '60vh', maxHeight: '80vh', display: 'flex', flexDirection: 'column' }} onClick={e => e.stopPropagation()}>
              <div className="modal-card-header">
                <div>
                  <div className="card-label" style={{ marginBottom: 6 }}>Monthly Payments</div>
                  <h3 style={{ margin: 0 }}>Payments for {new Date(selectedMonth + '-01').toLocaleString('en-US', { month: 'long', year: 'numeric' })}</h3>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <input type="month" value={selectedMonth} onChange={e => setSelectedMonth(e.target.value)} style={{ padding: '6px 10px', fontSize: '14px' }} />
                  <button onClick={() => setShowPaymentsModal(false)} className="modal-close" aria-label="Close">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
                  </button>
                </div>
              </div>
              <div className="modal-card-body" style={{ flex: 1, overflowY: 'auto' }}>
                <p style={{ marginBottom: 12, color: 'var(--ink-3)' }}>Total collected: <strong>KSH {filteredTotal.toLocaleString()}</strong></p>
                {filteredPayments.length > 0 ? (
                  <div className="table-shell">
                    <table className="landlord-table">
<thead><tr><th>Date</th><th>Tenant</th><th>Type</th><th>Amount</th></tr></thead>
                       <tbody>
                         {filteredPayments.map(p => {
                           const displayDate = p.source === 'bills' 
                             ? (p.payment_date ? new Date(p.payment_date).toLocaleDateString() : '') 
                             : (p.paid_at || p.created_at ? new Date(p.paid_at || p.created_at).toLocaleDateString() : '');
                           return (
                             <tr key={p.id}>
                               <td>{displayDate || '—'}</td>
                               <td>{p.tenant || p.tenant_name || '—'}</td>
                               <td>{p.transaction_type || 'rent'}</td>
                               <td style={{ color: 'var(--accent)', fontWeight: 600 }}>{formatCurrency(p.amount ?? p.paid_amount ?? 0)}</td>
                             </tr>
                           );
                         })}
                       </tbody>
                    </table>
                  </div>
                ) : <p className="table-empty">No payments recorded for this month.</p>}
              </div>
            </div>
          </div>
        )}

        <div className="property-page-grid">
          <div ref={formRef} className="card property-form-card">
            <div className="card-label">
              <span className="badge badge-pm">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M12 5v14"/><path d="M5 12h14"/></svg>
              </span>
              {editingProperty ? 'Edit Property' : 'Add Property'}
            </div>
            <h3>{editingProperty ? 'Update Property Details' : 'Create New Property'}</h3>
            <form onSubmit={handleSubmit} className="form-grid">
                <FormField label="Property name"><input value={form.name} onChange={(event) => updateForm('name', event.target.value)} required placeholder="Sunset Apartments" /></FormField>
              <FormField label="Address"><input value={form.address} onChange={(event) => updateForm('address', event.target.value)} required placeholder="123 Main Street" /></FormField>
              <FormField label="Units"><input type="number" min="0" value={form.unitCount} onChange={(event) => updateForm('unitCount', event.target.value)} required placeholder="24" /></FormField>
              <FormField label="Amenities"><input value={form.amenities} onChange={(event) => updateForm('amenities', event.target.value)} placeholder="Parking, water, security" /></FormField>
              <FormField label="Ownership info"><textarea value={form.ownershipInfo} onChange={(event) => updateForm('ownershipInfo', event.target.value)} placeholder="Owner details, title deed notes, or management notes" rows={4} /></FormField>
              <div className="modal-actions property-form-actions">
                <button type="submit" disabled={saving}>{saving ? 'Saving…' : editingProperty ? 'Update Property' : 'Create Property'}</button>
                {editingProperty && <button type="button" className="secondary-button" onClick={resetForm}>Cancel Edit</button>}
              </div>
            </form>

            <div className="card-label" style={{ marginTop: 32 }}>
              <span className="badge badge-pm">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><rect x="1" y="4" width="22" height="16" rx="2"/><line x1="1" y1="10" x2="23" y2="10"/></svg>
              </span>
              Add Units to Property
            </div>
            <h3>Add Units (comma separated)</h3>
<form onSubmit={handleAddUnits} className="form-grid">
            <FormField label="Property"><select value={unitForm.propertyId} onChange={(e) => setUnitForm(f => ({ ...f, propertyId: e.target.value }))} required><option value="">Select property</option>{properties.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}</select></FormField>
            <FormField label="Unit numbers"><input value={unitForm.unitNumbers} onChange={(e) => setUnitForm(f => ({ ...f, unitNumbers: e.target.value }))} required placeholder="Unit numbers (A1, A2, B1, ...)" /></FormField>
            <FormField label="Short code (Paybill account number)"><input value={unitForm.shortCode} onChange={(e) => setUnitForm(f => ({ ...f, shortCode: e.target.value }))} required placeholder="Short code (e.g. UNI-001)" /></FormField>
            <FormField label="Rent amount"><input type="number" value={unitForm.rentAmount} onChange={(e) => setUnitForm(f => ({ ...f, rentAmount: e.target.value }))} placeholder="Rent amount (KSH)" /></FormField>
            <FormField label="Unit type"><select value={unitForm.unitType} onChange={(e) => setUnitForm(f => ({ ...f, unitType: e.target.value }))}><option value="">Unit Type (optional)</option><option value="single-room">Single Room</option><option value="bedsitter">Bedsitter</option><option value="one-bedroom">One Bedroom</option><option value="two-bedroom">Two Bedroom</option><option value="three-bedroom">Three Bedroom</option></select></FormField>
            <button type="submit">Add Units</button>
          </form>

            {selectedProperty && (
              <div className="property-detail-card" style={{ marginTop: 24 }}>
                <div className="history-title">
                  <span>Selected Property Units</span>
                  <strong>{selectedProperty.name}</strong>
                </div>
                <p>{selectedProperty.address}</p>
                {selectedPropertyUnits.length === 0 ? (
                  <p style={{ color: 'var(--ink-3)', marginTop: 8 }}>No units added to this property yet.</p>
                ) : (
                  <div style={{ marginTop: 12 }}>
                    {selectedPropertyUnits.map((unit) => (
                      <div key={unit.id} style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0', borderBottom: '1px solid var(--line-soft)' }}>
                        <span>{unit.unit_number}</span>
                        <span style={{ color: unit.occupancy_status === 'occupied' ? 'var(--accent)' : 'var(--ink-3)' }}>
                          {unit.occupancy_status}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
                <div className="detail-grid" style={{ marginTop: 12 }}>
                  <div className="detail-card"><span>Total Units</span><strong>{selectedProperty.unit_count ?? 0}</strong></div>
                  <div className="detail-card"><span>Tenants</span><strong>{selectedProperty.tenant_count ?? 0}</strong></div>
                </div>
              </div>
            )}
          </div>

          <div className="card property-list-card">
            <div className="landlord-panel-header property-list-header">
              <div>
                <span className="landlord-kicker">All Properties</span>
                <h2>Portfolio Records</h2>
              </div>
              <button className="landlord-add-button" onClick={scrollToForm}>Add Property</button>
            </div>

            {loading ? <p className="landlord-muted">Loading properties…</p> : properties.length === 0 ? (
              <div className="landlord-empty property-empty">No properties added yet. Create your first property to start tracking units and tenants.</div>
            ) : (
              <div className="table-shell">
                <table className="landlord-table property-table">
                  <thead>
                    <tr>
                      <th>Property</th>
                      <th>Address</th>
                      <th>Units</th>
                      <th>Tenants</th>
                      <th>Occupancy</th>
                      <th>Rent Roll</th>
                      <th>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {properties.map((property) => {
                      const unitCount = Number(property.unit_count ?? 0);
                      const occupiedCount = Number(property.occupied_units ?? 0);
                      const occupancy = unitCount > 0 ? Math.round((occupiedCount / unitCount) * 100) : 0;
                      return (
                        <tr key={property.id}>
                          <td className="landlord-name">
                            <span onClick={() => setSelectedProperty(property)} style={{ cursor: 'pointer', textDecoration: 'underline' }}>{property.name}</span>
                            <small>{unitCount} unit{unitCount !== 1 ? 's' : ''}</small>
                          </td>
                          <td>{property.address}</td>
                          <td>{unitCount}</td>
                          <td>{property.tenant_count ?? 0}</td>
                          <td>
                            <div className="property-meter" aria-label={`${occupancy}% occupied`}>
                              <span style={{ width: `${occupancy}%` }}></span>
                            </div>
                            <span className={`renewal-pill ${unitCount === occupiedCount ? 'status-active' : 'status-pending'}`}>{occupancy}%</span>
                          </td>
                          <td className="landlord-name">KSH {Number(property.rent_roll ?? 0).toLocaleString()}</td>
<td>
                             <div className="landlord-actions">
                               <button type="button" className="action-button" onClick={() => setSelectedProperty(property)}>View Units</button>
                               <button type="button" className="action-button primary" onClick={() => handleEdit(property)}>Edit</button>
                             </div>
                           </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>

        <div className="card property-list-card" style={{ marginTop: 24 }}>
          <div className="landlord-panel-header property-list-header">
            <div>
              <span className="landlord-kicker">All Units</span>
              <h2>Unit Records</h2>
            </div>
          </div>

          {units.length === 0 ? (
            <p className="landlord-muted">No units added. Add units above after creating properties.</p>
          ) : (
            <div className="table-shell">
              <table className="landlord-table">
                <thead>
                  <tr>
                    <th>Unit</th>
                    <th>Type</th>
                    <th>Property</th>
                    <th>Rent</th>
                    <th>Status</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                 <tbody>
                   {units.map((unit, idx) => {
                     const property = properties.find(p => p.id === unit.property_id);
                     const unitTypeLabel = unit.unit_type === 'single-room' ? 'Single Room' :
                        unit.unit_type === 'bedsitter' ? 'Bedsitter' :
                        unit.unit_type === 'one-bedroom' ? 'One Bedroom' :
                        unit.unit_type === 'two-bedroom' ? 'Two Bedroom' :
                        unit.unit_type === 'three-bedroom' ? 'Three Bedroom' : '—';
                     const rowColors = ['#f0fdfa', '#eff6ff', '#fef3c7', '#fdf2f8', '#f0f9ff', '#fdf4ff', '#ecfdf5', '#fff7ed'];
                     const rowColor = rowColors[idx % rowColors.length];
                     return (
                       <tr key={unit.id} style={{ background: rowColor }}>
                        <td className="landlord-name">{unit.unit_number}</td>
                        <td style={{ fontSize: '13px', color: 'var(--ink-3)' }}>{unitTypeLabel}</td>
                        <td>{property?.name ?? '—'}</td>
                        <td>KSH {Number(unit.rent_amount ?? 0).toLocaleString()}</td>
                        <td>
                          <span className={`status-pill ${unit.occupancy_status === 'occupied' ? 'status-active' : 'status-pending'}`}>
                            {unit.occupancy_status}
                          </span>
                        </td>
<td>
                          <div className="landlord-actions">
                            <button type="button" className="action-button primary" onClick={() => handleEditUnit(unit)} style={{ padding: '6px 10px', fontSize: '12px' }}>Edit</button>
                            {unit.occupancy_status === 'occupied' && (
                              <button type="button" className="action-button danger" onClick={() => handleMarkVacant(unit.id)} style={{ padding: '6px 10px', fontSize: '12px', marginLeft: 4 }}>Mark Vacant</button>
                            )}
                            {unit.occupancy_status !== 'occupied' && (
                              <button type="button" className="action-button" onClick={() => handleMarkOccupied(unit.id)} style={{ padding: '6px 10px', fontSize: '12px', marginLeft: 4 }}>Mark Occupied</button>
                            )}
                          </div>
                        </td>
</tr>
                     );
                   })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </section>

      {showUnitEdit && editingUnit && (
        <div className="modal-overlay" onClick={() => setShowUnitEdit(false)}>
          <div className="modal-card" onClick={e => e.stopPropagation()}>
            <h3 style={{ marginBottom: 16 }}>Edit Unit - {editingUnit.unit_number}</h3>
            <form onSubmit={handleUnitEditSubmit} className="form-grid">
              <div className="field-group">
                <label>Unit Number</label>
                <input value={unitEditForm.unitNumber} onChange={e => setUnitEditForm(f => ({ ...f, unitNumber: e.target.value }))} required placeholder="e.g., A1" />
              </div>
              <div className="field-group">
                <label>Short Code (Paybill Account Number)</label>
                <input value={unitEditForm.shortCode} onChange={e => setUnitEditForm(f => ({ ...f, shortCode: e.target.value }))} required placeholder="e.g., UNI-001" />
              </div>
              <div className="field-group">
                <label>Rent Amount (KSH)</label>
                <input type="number" value={unitEditForm.rentAmount} onChange={e => setUnitEditForm(f => ({ ...f, rentAmount: e.target.value }))} required placeholder="e.g., 6000" />
              </div>
              <div className="field-group">
                <label>Unit Type</label>
                <select value={unitEditForm.unitType} onChange={e => setUnitEditForm(f => ({ ...f, unitType: e.target.value }))}>
                  <option value="">Select type</option>
                  <option value="single-room">Single Room</option>
                  <option value="bedsitter">Bedsitter</option>
                  <option value="one-bedroom">One Bedroom</option>
                  <option value="two-bedroom">Two Bedroom</option>
                  <option value="three-bedroom">Three Bedroom</option>
                </select>
              </div>
              <div className="field-group">
                <label>Status</label>
                <select value={unitEditForm.occupancyStatus} onChange={e => setUnitEditForm(f => ({ ...f, occupancyStatus: e.target.value }))}>
                  <option value="vacant">Vacant</option>
                  <option value="occupied">Occupied</option>
                </select>
              </div>
              <div className="modal-actions">
                <button type="submit">Save Changes</button>
                <button type="button" className="secondary-button" onClick={() => { setShowUnitEdit(false); setEditingUnit(null); }}>Cancel</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </main>

      <footer>
        <div className="footer-inner">
          <div className="footer-brand"><span className="logo-mark" style={{ width: 26, height: 26, borderRadius: 7 }}><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M3 21h18"/><path d="M5 21V7l8-4v18"/><path d="M19 21V11l-6-4"/></svg></span>Springfield Systems</div>
          <div className="footer-links"></div>
          <div className="footer-copy">© 2026 Springfield Systems. All rights reserved.</div>
        </div>
      </footer>
    </>
  );
}

