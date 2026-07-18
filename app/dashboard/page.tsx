'use client';

import { useEffect, useState, useMemo } from 'react';
import Link from 'next/link';
import { supabase } from '../../lib/supabaseClient';
import Sparkline from '../components/Sparkline';
import DonutChart from '../components/DonutChart';

interface DashboardStats {
  properties: number;
  agents: number;
  tenants: number;
  total_payments: number;
  total_balance: number;
  occupiedUnits: number;
  vacantUnits: number;
  vacantUnitsList?: Array<{ unit_number: string; property_name: string; rent_amount: number }>;
  rentOwedByTenant?: Array<{ id: string; full_name: string; email: string; unit: string; property: string; total_paid: number; rent_amount: number; balance_remaining: number; last_payment: string | null }>;
  tenants_with_analytics: Array<{ id: string; payment_count: number; due_date: string }>;
}

interface Tenant {
  id: string;
  full_name: string;
  email: string;
  unit: string;
  property: string;
  lease_start: string;
  lease_end: string;
}

interface Payment {
  id: string;
  tenant_id: string;
  tenant: string;
  tenant_email: string;
  property: string;
  amount: number;
  balance_remaining: number;
  created_at: string;
  transaction_type: string;
  description: string;
  paid_at?: string;
  payment_date?: string;
  paid_amount?: number;
}

interface Agent {
  id: string;
  full_name: string;
  email: string;
  status: string;
  property_name: string;
}

interface Property {
  id: string;
  name: string;
  address: string;
}

interface Notification {
  id: string;
  tenant: string;
  tenant_email: string;
  message: string;
  status: string;
  created_at: string;
}

interface Comment {
  id: string;
  tenant: string;
  tenant_email: string;
  message: string;
  status: string;
  created_at: string;
}

interface UtilityPayment {
  id: string;
  tenant: string;
  tenant_email: string;
  property: string;
  amount: number;
  balance_remaining: number;
  created_at: string;
  transaction_type: string;
  description: string;
}

interface Unit {
  id: string;
  unit_number: string;
  current_water_reading?: number;
  previous_water_reading?: number;
  tenant?: { id: string; full_name: string; email?: string };
  occupancy_status?: string;
}

export default function DashboardPage() {
   const [stats, setStats] = useState<DashboardStats | null>(null);
   const [tenants, setTenants] = useState<Tenant[]>([]);
   const [payments, setPayments] = useState<Payment[]>([]);
   const [agents, setAgents] = useState<Agent[]>([]);
   const [properties, setProperties] = useState<Property[]>([]);
   const [units, setUnits] = useState<Unit[]>([]);
   const [agentEmail, setAgentEmail] = useState('');
   const [agentPassword, setAgentPassword] = useState('');
   const [agentName, setAgentName] = useState('');
   const [agentPropertyId, setAgentPropertyId] = useState('');
   const [propertyName, setPropertyName] = useState('');
   const [propertyAddress, setPropertyAddress] = useState('');
   const [propertySize, setPropertySize] = useState('');
   const [selectedPropertyId, setSelectedPropertyId] = useState('');
   const [notifications, setNotifications] = useState<Notification[]>([]);
   const [comments, setComments] = useState<Comment[]>([]);
   const [notificationTenantId, setNotificationTenantId] = useState('');
   const [notificationMessage, setNotificationMessage] = useState('');
   const [agentTenantName, setAgentTenantName] = useState('');
   const [agentTenantEmail, setAgentTenantEmail] = useState('');
   const [agentTenantPhone, setAgentTenantPhone] = useState('');
   const [agentTenantUnitId, setAgentTenantUnitId] = useState('');
   const [agentLeaseStart, setAgentLeaseStart] = useState('');
   const [agentLeaseEnd, setAgentLeaseEnd] = useState('');
   const [agentDeposit, setAgentDeposit] = useState('');
   const [agentNextOfKinName, setAgentNextOfKinName] = useState('');
   const [agentNextOfKinId, setAgentNextOfKinId] = useState('');
   const [agentNextOfKinPhone, setAgentNextOfKinPhone] = useState('');
   const [propertyLoading, setPropertyLoading] = useState(false);
   const [loading, setLoading] = useState(true);
   const [refreshing, setRefreshing] = useState(false);
   const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
   const [agentLoading, setAgentLoading] = useState(false);
   const [error, setError] = useState('');
   const [landlordId, setLandlordId] = useState('');
   const [userRole, setUserRole] = useState('');
   const [roleLoaded, setRoleLoaded] = useState(false);
   const [message, setMessage] = useState('');
   const [assignedPropertyParam, setAssignedPropertyParam] = useState('');
   const [utilityTenantId, setUtilityTenantId] = useState('');
   const [utilityType, setUtilityType] = useState('water');
   const [utilityAmount, setUtilityAmount] = useState('');
   const [utilityDescription, setUtilityDescription] = useState('');
const utilityTypes = ['water', 'garbage', 'service_charge', 'parking', 'security', 'internet', 'laundry', 'pet_fees', 'other'];
    const [waterMeterReadings, setWaterMeterReadings] = useState<{[unitId: string]: string}>({});
    const [waterBills, setWaterBills] = useState<any[]>([]);
    const [waterMonthDue, setWaterMonthDue] = useState('');
    const [showModal, setShowModal] = useState(false);
    const [modalTitle, setModalTitle] = useState('');
    const [modalContent, setModalContent] = useState<React.ReactNode>(null);

  const isAgent = roleLoaded && userRole === 'agent';
  const agentPropertyFromStorage = typeof window !== 'undefined' ? localStorage.getItem('agentPropertyId') || '' : '';
  const effectivePropertyId = selectedPropertyId || agentPropertyFromStorage;

  async function loadDashboard(refresh = false) {
    if (refresh) setRefreshing(true); else setLoading(true);
    setError('');

    try {
      const { data: { session } } = await supabase.auth.getSession();
      const headers: Record<string, string> = { 'Content-Type': 'application/json' };
      if (session?.access_token) headers.Authorization = `Bearer ${session.access_token}`;

      const [statsResponse, tenantsResponse, paymentsResponse, billsResponse, agentsResponse, propertiesResponse, unitsResponse] = await Promise.all([
        fetch('/api/dashboard' + (effectivePropertyId ? `?propertyId=${encodeURIComponent(effectivePropertyId)}` : ''), { headers }).catch(() => null),
        fetch('/api/tenants' + (effectivePropertyId ? `?propertyId=${encodeURIComponent(effectivePropertyId)}` : ''), { headers }).catch(() => null),
        fetch('/api/payments' + (effectivePropertyId ? `?propertyId=${encodeURIComponent(effectivePropertyId)}` : ''), { headers }).catch(() => null),
        fetch('/api/bills' + (effectivePropertyId ? `?propertyId=${encodeURIComponent(effectivePropertyId)}` : ''), { headers }).catch(() => null),
        fetch('/api/agents', { headers }).catch(() => null),
        fetch('/api/properties', { headers }).catch(() => null),
        fetch('/api/units' + (effectivePropertyId ? `?propertyId=${encodeURIComponent(effectivePropertyId)}` : ''), { headers }).catch(() => null),
      ]);

      const statsResult = statsResponse ? await statsResponse.json().catch(() => ({})) : {};
      const tenantsResult = tenantsResponse ? await tenantsResponse.json().catch(() => ({})) : {};
      const paymentsResult = paymentsResponse ? await paymentsResponse.json().catch(() => ({})) : {};
      const billsResult = billsResponse ? await billsResponse.json().catch(() => ({})) : {};
      const agentsResult = agentsResponse ? await agentsResponse.json().catch(() => ({})) : {};
      const propertiesResult = propertiesResponse ? await propertiesResponse.json().catch(() => ({})) : {};
      const unitsResult = unitsResponse ? await unitsResponse.json().catch(() => ({})) : {};

      setStats(statsResult);
      setTenants(tenantsResult.tenants ?? []);
      // Merge payments and bills for owed computation
      const mergedPayments = [...(paymentsResult.payments ?? []).map((p: any) => ({
        ...p,
        created_at: p.paid_at || p.created_at,
      })), ...(billsResult.bills ?? []).map((b: any) => ({
        ...b,
        amount: b.paid_amount ?? 0,
        balance_remaining: b.balance ?? b.balance_remaining,
        created_at: b.payment_date || b.paid_at || b.created_at,
        tenant: b.tenant_name ?? '',
      }))];
      setPayments(mergedPayments);
      setAgents(agentsResult.agents ?? []);
      setProperties(propertiesResult.properties ?? []);
      setUnits(unitsResult.units ?? []);

      if (userRole === 'agent' && effectivePropertyId) {
        const [notificationsResponse, commentsResponse, waterBillsResponse] = await Promise.all([
          fetch(`/api/notifications?propertyId=${encodeURIComponent(effectivePropertyId)}`),
          fetch(`/api/comments?propertyId=${encodeURIComponent(effectivePropertyId)}`),
          fetch(`/api/invoices?propertyId=${encodeURIComponent(effectivePropertyId)}`),
        ]);
        const notificationsResult = await notificationsResponse.json();
        const commentsResult = await commentsResponse.json();
        const waterBillsResult = await waterBillsResponse.json();
        if (notificationsResponse.ok) setNotifications(notificationsResult.notifications ?? []);
        if (commentsResponse.ok) setComments(commentsResult.comments ?? []);
        if (waterBillsResponse.ok) setWaterBills((waterBillsResult.invoices ?? []).filter((i: any) => i.invoice_type === 'water'));
      }
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLastUpdated(new Date());
      if (refresh) setRefreshing(false); else setLoading(false);
    }
  }

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      if (data.user) {
        setLandlordId(data.user.id);
        setUserRole(data.user.user_metadata?.role || '');
        if (data.user.user_metadata?.role === 'agent' && data.user.user_metadata?.property_id) {
          localStorage.setItem('agentPropertyId', data.user.user_metadata.property_id);
        }
      }
      setRoleLoaded(true);
    });
  }, []);

  useEffect(() => {
    const assignedProperty = new URLSearchParams(window.location.search).get('property') || localStorage.getItem('agentPropertyId') || '';
    setAssignedPropertyParam(assignedProperty);
    if (assignedProperty) setSelectedPropertyId(assignedProperty);
  }, []);

  useEffect(() => {
    if (roleLoaded) loadDashboard();
    const interval = window.setInterval(() => loadDashboard(true), 15000);
    return () => window.clearInterval(interval);
  }, [roleLoaded, selectedPropertyId, userRole]);

  // Derive "rent owed" directly from the payments already loaded by the page
  // (the same data the Payment History table uses and which is confirmed
  // correct). This avoids any dependency on /api/dashboard scoping.
  const NON_PAYMENT_TYPES = ['complaint', 'notification'];
  const rentOwedByTenant = useMemo(() => {
    if (!payments || payments.length === 0) return [];
    const tenantMap = new Map<string, any>();
    (tenants || []).forEach((t: any) => tenantMap.set(t.id, t));

    const byTenant = new Map<string, any>();
    payments.forEach((p: any) => {
      if (NON_PAYMENT_TYPES.includes(p.transaction_type)) return;
      const balance = Number(p.balance_remaining || 0);
      if (balance <= 0) return;
      const tid = String(p.tenant_id || '');
      if (!tid) return;
      if (!byTenant.has(tid)) {
        const t = tenantMap.get(tid) || {};
        byTenant.set(tid, {
          id: tid,
          full_name: t.full_name || p.tenant_name || p.tenant || '',
          email: t.email || p.tenant_email || '',
          unit: t.unit || p.unit_number || p.unit || null,
          property: t.property || p.property_name || p.property || null,
          total_paid: 0,
          rent_amount: 0,
          balance_remaining: 0,
          last_payment: p.created_at || null,
        });
      }
      const entry = byTenant.get(tid);
      entry.balance_remaining += balance;
      entry.total_paid += Number(p.amount || 0);
      if (p.created_at && (!entry.last_payment || p.created_at > entry.last_payment)) {
        entry.last_payment = p.created_at;
      }
    });
    return Array.from(byTenant.values());
  }, [payments, tenants]);

  const totalBalance = rentOwedByTenant.reduce((sum: number, t: any) => sum + Number(t.balance_remaining || 0), 0);

  const monthlyPayments = useMemo(() => {
    const months: { label: string; value: number }[] = [];
    const monthMap = new Map<string, number>();
    const labels = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    const monthNames = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
    (payments || []).forEach((p: any) => {
      if (NON_PAYMENT_TYPES.includes(p.transaction_type)) return;
      const paidAmt = Number(p.paid_amount ?? p.amount ?? 0);
      if (p.month_due) {
        const monthParts = p.month_due?.split(' ');
        if (monthParts?.length >= 2) {
          const monthName = monthParts[0];
          const year = monthParts[1];
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
    for (let i = 5; i >= 0; i--) {
      const d = new Date();
      d.setMonth(d.getMonth() - i);
      const key = d.toISOString().slice(0, 7);
      months.push({ label: labels[d.getMonth()], value: monthMap.get(key) || 0 });
    }
    return months;
  }, [payments]);

  const currentMonthPayment = monthlyPayments.length > 0 ? monthlyPayments[monthlyPayments.length - 1].value : 0;
  const prevMonthPayment = monthlyPayments.length > 1 ? monthlyPayments[monthlyPayments.length - 2].value : 0;
  const trendPercent = prevMonthPayment > 0 ? ((currentMonthPayment - prevMonthPayment) / prevMonthPayment * 100) : currentMonthPayment > 0 ? 100 : 0;

  async function handleAddProperty(event: React.FormEvent) {
    event.preventDefault();
    setMessage('');
    setError('');
    setPropertyLoading(true);

    const response = await fetch('/api/properties', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: propertyName, address: propertyAddress, size: propertySize }),
    });

    const result = await response.json();

    if (!response.ok) {
      setError(result.message ?? 'Unable to add property.');
      setPropertyLoading(false);
      return;
    }

    setProperties((current) => [result.property, ...current]);
    setPropertyName('');
    setPropertyAddress('');
    setPropertySize('');
    setMessage('Property added successfully. You can now assign an agent to it.');
    setPropertyLoading(false);
  }

  async function handleAddAgent(event: React.FormEvent) {
    event.preventDefault();
    setMessage('');
    setError('');
    setAgentLoading(true);

    const selectedProperty = properties.find((property) => property.id === agentPropertyId);
    const response = await fetch('/api/agents', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: agentEmail, password: agentPassword, fullName: agentName, propertyId: agentPropertyId, propertyName: selectedProperty?.name ?? '', landlordId }),
    });

    const result = await response.json();

    if (!response.ok) {
      setError(result.message ?? 'Unable to add agent.');
      setAgentLoading(false);
      return;
    }

    setAgents((current) => [result.agent, ...current]);
    setAgentEmail('');
    setAgentPassword('');
    setAgentName('');
    setAgentPropertyId('');
    setMessage('Agent added and assigned successfully.');
    setAgentLoading(false);
  }

  async function handleRemoveAgent(agentId: string) {
    if (!confirm('Remove this agent from active property access?')) return;

    const response = await fetch(`/api/agents?id=${encodeURIComponent(agentId)}`, { method: 'DELETE' });
    const result = await response.json();

    if (!response.ok) {
      setError(result.message ?? 'Unable to remove agent.');
      return;
    }

    setAgents((current) => current.map((agent) => (agent.id === agentId ? { ...agent, status: 'inactive' } : agent)));
    setMessage('Agent removed from active access.');
  }

  async function handleAgentTenantCreate(event: React.FormEvent) {
    event.preventDefault();
    setMessage('');
    setError('');
    setAgentLoading(true);

    const headers: Record<string, string> = { 'Content-Type': 'application/json' };
    const { data: { session } } = await supabase.auth.getSession();
    if (session?.access_token) headers.Authorization = `Bearer ${session.access_token}`;

    const response = await fetch('/api/tenants', {
       method: 'POST',
       headers,
       body: JSON.stringify({ propertyId: effectivePropertyId, fullName: agentTenantName, email: agentTenantEmail, phone: agentTenantPhone, unitId: agentTenantUnitId || undefined, leaseStart: agentLeaseStart, leaseEnd: agentLeaseEnd, depositAmount: Number(agentDeposit), nextOfKinName: agentNextOfKinName, nextOfKinId: agentNextOfKinId, nextOfKinPhone: agentNextOfKinPhone }),
     });

    const result = await response.json();

    if (!response.ok) {
      setError(result.message ?? 'Unable to add tenant.');
      setAgentLoading(false);
      return;
    }

    setTenants((current) => [result.tenant, ...current]);
    setAgentTenantName('');
    setAgentTenantEmail('');
    setAgentTenantPhone('');
    setAgentTenantUnitId('');
    setAgentLeaseStart('');
    setAgentLeaseEnd('');
    setAgentDeposit('');
    setAgentNextOfKinName('');
    setAgentNextOfKinId('');
    setAgentNextOfKinPhone('');
    setMessage('Tenant added successfully.');
    await loadDashboard(true);
    setAgentLoading(false);
  }

  async function handleAgentTenantRemove(tenantId: string) {
    if (!confirm('Remove this tenant because they relocated?')) return;

    const response = await fetch(`/api/tenants?id=${encodeURIComponent(tenantId)}`, { method: 'DELETE' });
    const result = await response.json();

    if (!response.ok) {
      setError(result.message ?? 'Unable to remove tenant.');
      return;
    }

    setTenants((current) => current.filter((tenant) => tenant.id !== tenantId));
    setMessage('Tenant removed because they relocated.');
    await loadDashboard(true);
  }

  async function handleSendNotification(event: React.FormEvent) {
    event.preventDefault();
    if (!selectedPropertyId) {
      setError('Agent property is not assigned.');
      return;
    }

    setError('');
    const response = await fetch('/api/notifications', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ tenantId: notificationTenantId, propertyId: selectedPropertyId, message: notificationMessage }),
    });

    const result = await response.json();

    if (!response.ok) {
      setError(result.message ?? 'Unable to send notification.');
      return;
    }

    setMessage('Overdue notification sent.');
    setNotificationTenantId('');
    setNotificationMessage('');
  }

  async function handleAddUtility(event: React.FormEvent) {
    event.preventDefault();
    if (!selectedPropertyId && !isAgent) {
      setError('Select a property to add utility bill.');
      return;
    }

    const targetPropertyId = selectedPropertyId || effectivePropertyId;
    
    const response = await fetch('/api/invoices', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        tenantId: utilityTenantId,
        propertyId: targetPropertyId,
        invoiceType: utilityType,
        description: utilityDescription || `${utilityType} invoice`,
        amount: Number(utilityAmount),
        dueDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10),
      }),
    });

    const result = await response.json();

    if (!response.ok) {
      setError(result.message ?? 'Unable to record utility bill.');
      return;
    }

    setUtilityTenantId('');
    setUtilityType('garbage');
    setUtilityAmount('');
    setUtilityDescription('');
    setMessage('Utility bill recorded.');
    await loadDashboard(true);
  }

  async function handleWaterMeterReading(unitId: string) {
    const reading = waterMeterReadings[unitId];
    if (!reading) return;

    const { data: { session } } = await supabase.auth.getSession();
    const headers: Record<string, string> = { 'Content-Type': 'application/json' };
    if (session?.access_token) headers.Authorization = `Bearer ${session.access_token}`;

    const response = await fetch('/api/water', {
      method: 'POST',
      headers,
      body: JSON.stringify({ unitId, currentReading: Number(reading), monthDue: waterMonthDue, propertyId: effectivePropertyId }),
    });

    const result = await response.json();
    if (response.ok) {
      setMessage(`Water bill: ${result.consumption} units × ${result.waterRate} = ${result.amount.toLocaleString()} KES`);
      setWaterMeterReadings((prev) => ({ ...prev, [unitId]: '' }));
      await loadDashboard(true);
    } else {
      setError(result.message ?? 'Failed to record meter reading.');
    }
  }

  const formatCurrency = (value: number) => new Intl.NumberFormat('en-KE', { style: 'currency', currency: 'KES' }).format(value);

  return (
    <main className="container auth-pattern-bg">
      <div className="card-admin-header">
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 16 }}>
          <div>
            <p className="heading">{isAgent ? 'Agent Dashboard' : 'Landlord Dashboard'}</p>
            <p className="subheading">Overview of properties, agents, tenants, payments, balances, and due dates.</p>
          </div>
          <button type="button" className="btn btn-ghost" style={{ color: '#fff', border: '1px solid rgba(255,255,255,0.2)', background: 'rgba(255,255,255,0.08)' }} onClick={() => loadDashboard(true)} disabled={refreshing}>{refreshing ? 'Refreshing…' : 'Refresh'}</button>
        </div>
      </div>

      {loading && <p style={{ color: 'var(--ink-3)' }}>Loading dashboard…</p>}
      {!loading && lastUpdated && <p style={{ color: 'var(--ink-3)', fontSize: '13px', marginBottom: 16 }}>Last updated: {lastUpdated.toLocaleTimeString()}</p>}
      {error && <p style={{ color: '#dc2626' }}>{error}</p>}
      {message && <p style={{ color: 'var(--accent)' }}>{message}</p>}

      {isAgent && !effectivePropertyId && (
        <p style={{ padding: '12px', borderRadius: '10px', background: 'rgba(245,158,11,0.1)', color: '#92400e', marginBottom: 16 }}>No property assigned. Please contact your landlord to assign a property.</p>
      )}

      {isAgent && effectivePropertyId && (
        <>
          <section className="bento-grid">
            <div className="bento-card" style={{ padding: '14px 16px', display: 'flex', alignItems: 'center', gap: 12, cursor: 'pointer' }} onClick={() => { setModalTitle('All Units'); setModalContent(<div style={{ maxHeight: '300px', overflow: 'auto' }}>{units.length === 0 ? <p style={{ color: 'var(--ink-3)' }}>No units found.</p> : <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '14px' }}><thead><tr style={{ borderBottom: '1px solid var(--line)' }}><th style={{ textAlign: 'left', padding: '8px' }}>Unit</th><th style={{ textAlign: 'left', padding: '8px' }}>Status</th><th style={{ textAlign: 'left', padding: '8px' }}>Tenant</th></tr></thead><tbody>{units.map((unit) => <tr key={unit.id} style={{ borderBottom: '1px solid var(--line-soft)' }}><td style={{ padding: '8px' }}>{unit.unit_number}</td><td style={{ padding: '8px', color: unit.occupancy_status === 'occupied' ? 'var(--accent)' : 'var(--amber)' }}>{unit.occupancy_status ?? 'unknown'}</td><td style={{ padding: '8px', color: 'var(--ink-3)' }}>{unit.tenant?.full_name ?? '—'}</td></tr>)}</tbody></table>}</div>); setShowModal(true); }}>
              <div style={{ width: 48, height: 48, borderRadius: '50%', background: 'rgba(79,70,229,0.12)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#4f46e5" strokeWidth="2"><path d="M3 21h18"/><path d="M5 21V7l8-4v18"/><path d="M19 21V11l-6-4"/></svg>
              </div>
              <div>
                <div className="card-label">Total Units</div>
                <h3 style={{ margin: 0 }}>{units.length}</h3>
                <Sparkline data={[units.length, units.filter(u => u.occupancy_status === 'occupied').length, units.filter(u => u.occupancy_status === 'vacant').length]} color="#4f46e5" w={80} h={24}/>
                <p style={{ margin: 0, color: 'var(--ink-3)', fontSize: '13px' }}>in your portfolio</p>
              </div>
            </div>

            <div className="bento-card" style={{ padding: '14px 16px', display: 'flex', alignItems: 'center', gap: 12, cursor: 'pointer' }} onClick={() => { setModalTitle('Occupied Units'); setModalContent(<div style={{ maxHeight: '300px', overflow: 'auto' }}>{units.filter(u => u.occupancy_status === 'occupied').length === 0 ? <p style={{ color: 'var(--ink-3)' }}>No occupied units.</p> : <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '14px' }}><thead><tr style={{ borderBottom: '1px solid var(--line)' }}><th style={{ textAlign: 'left', padding: '8px' }}>Unit</th><th style={{ textAlign: 'left', padding: '8px' }}>Tenant</th><th style={{ textAlign: 'left', padding: '8px' }}>Email</th></tr></thead><tbody>{units.filter(u => u.occupancy_status === 'occupied').map((unit) => <tr key={unit.id} style={{ borderBottom: '1px solid var(--line-soft)' }}><td style={{ padding: '8px' }}>{unit.unit_number}</td><td style={{ padding: '8px' }}>{unit.tenant?.full_name ?? '—'}</td><td style={{ padding: '8px', color: 'var(--ink-3)' }}>{unit.tenant?.email ?? '—'}</td></tr>)}</tbody></table>}</div>); setShowModal(true); }}>
              <div style={{ width: 48, height: 48, borderRadius: '50%', background: 'rgba(79,70,229,0.12)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#4f46e5" strokeWidth="2"><path d="M22 11.08V12a10 12 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 8 10.01"/></svg>
              </div>
              <div>
                <div className="card-label">Occupied</div>
                <h3 style={{ margin: 0 }}>{units.filter(u => u.occupancy_status === 'occupied').length}</h3>
                <Sparkline data={[10, 12, units.filter(u => u.occupancy_status === 'occupied').length]} color="#4f46e5" w={80} h={24}/>
                <p style={{ margin: 0, color: 'var(--ink-3)', fontSize: '13px' }}>units with tenants</p>
              </div>
            </div>

            <div className="bento-card" style={{ padding: '14px 16px', display: 'flex', alignItems: 'center', gap: 12, cursor: 'pointer' }} onClick={() => { setModalTitle('Vacant Units'); setModalContent(<div style={{ maxHeight: '300px', overflow: 'auto' }}>{units.filter(u => u.occupancy_status === 'vacant').length === 0 ? <p style={{ color: 'var(--ink-3)' }}>No vacant units.</p> : <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '14px' }}><thead><tr style={{ borderBottom: '1px solid var(--line)' }}><th style={{ textAlign: 'left', padding: '8px' }}>Unit</th></tr></thead><tbody>{units.filter(u => u.occupancy_status === 'vacant').map((unit) => <tr key={unit.id} style={{ borderBottom: '1px solid var(--line-soft)' }}><td style={{ padding: '8px' }}>{unit.unit_number}</td></tr>)}</tbody></table>}</div>); setShowModal(true); }}>
              <div style={{ width: 48, height: 48, borderRadius: '50%', background: 'rgba(14,165,233,0.12)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#0ea5e9" strokeWidth="2"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
              </div>
              <div>
                <div className="card-label">Vacant</div>
                <h3 style={{ margin: 0 }}>{units.filter(u => u.occupancy_status === 'vacant').length}</h3>
                <Sparkline data={[3, 1, units.filter(u => u.occupancy_status === 'vacant').length]} color="#0ea5e9" w={80} h={24}/>
                <p style={{ margin: 0, color: 'var(--ink-3)', fontSize: '13px' }}>available for rent</p>
              </div>
            </div>

            <div className="bento-card" style={{ padding: '14px 16px', display: 'flex', alignItems: 'center', gap: 12, cursor: 'pointer' }} onClick={() => { setModalTitle('All Tenants'); setModalContent(<div style={{ maxHeight: '300px', overflow: 'auto' }}>{tenants.length === 0 ? <p style={{ color: 'var(--ink-3)' }}>No tenants found.</p> : <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '14px' }}><thead><tr style={{ borderBottom: '1px solid var(--line)' }}><th style={{ textAlign: 'left', padding: '8px' }}>Name</th><th style={{ textAlign: 'left', padding: '8px' }}>Unit</th><th style={{ textAlign: 'left', padding: '8px' }}>Email</th></tr></thead><tbody>{tenants.map((tenant) => <tr key={tenant.id} style={{ borderBottom: '1px solid var(--line-soft)' }}><td style={{ padding: '8px' }}>{tenant.full_name}</td><td style={{ padding: '8px' }}>{tenant.unit}</td><td style={{ padding: '8px', color: 'var(--ink-3)' }}>{tenant.email}</td></tr>)}</tbody></table>}</div>); setShowModal(true); }}>
              <div style={{ width: 48, height: 48, borderRadius: '50%', background: 'rgba(245,158,11,0.12)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="var(--amber)" strokeWidth="2"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/></svg>
              </div>
              <div>
                <div className="card-label">Active Tenants</div>
                <h3 style={{ margin: 0 }}>{tenants.length}</h3>
                <Sparkline data={[2, 4, tenants.length]} color="var(--amber)" w={80} h={24}/>
                <p style={{ margin: 0, color: 'var(--ink-3)', fontSize: '13px' }}>registered</p>
              </div>
            </div>

            <div className="bento-card" style={{ padding: '14px 16px', display: 'flex', alignItems: 'center', gap: 12 }}>
              <div style={{ width: 48, height: 48, borderRadius: '50%', background: 'rgba(16,185,129,0.12)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="var(--accent)" strokeWidth="2"><path d="M22 11.08V12a10 12 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 8 10.01"/></svg>
              </div>
              <div style={{ flex: 1 }}>
                <div className="card-label">Occupancy Rate</div>
                <h3 style={{ margin: 0 }}>{units.length > 0 ? Math.round((units.filter(u => u.occupancy_status === 'occupied').length / units.length) * 100) : 0}%</h3>
                <DonutChart data={[
                  { label: 'Occupied', value: units.filter(u => u.occupancy_status === 'occupied').length, color: '#10b981' },
                  { label: 'Vacant', value: units.filter(u => u.occupancy_status === 'vacant').length, color: '#9ca3af' }
                ]} size={60} centerLabel={`${units.filter(u => u.occupancy_status === 'occupied').length}/${units.length}`}/>
                <p style={{ margin: 0, color: 'var(--ink-3)', fontSize: '13px' }}>occupied / total</p>
              </div>
            </div>
          </section>

          <section className="dashboard-section-grid" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 18, marginTop: 24 }}>
            <div className="card">
              <div className="card-label">Tenant Management</div>
              <h3 style={{ marginBottom: 16 }}>Add Tenant</h3>
              <form onSubmit={handleAgentTenantCreate} className="form-grid">
                <input value={agentTenantName} onChange={(event) => setAgentTenantName(event.target.value)} required placeholder="Tenant full name" />
                <input type="email" value={agentTenantEmail} onChange={(event) => setAgentTenantEmail(event.target.value)} required placeholder="Tenant email" />
                <input value={agentTenantPhone} onChange={(event) => setAgentTenantPhone(event.target.value)} placeholder="Phone" />
                <select value={agentTenantUnitId} onChange={(event) => setAgentTenantUnitId(event.target.value)}>
                  <option value="">Auto-create unit</option>
                  {units.map((unit) => <option key={unit.id} value={unit.id}>Unit {unit.unit_number}</option>)}
                </select>
                <input type="date" value={agentLeaseStart} onChange={(event) => setAgentLeaseStart(event.target.value)} required />
                <input type="date" value={agentLeaseEnd} onChange={(event) => setAgentLeaseEnd(event.target.value)} required />
                <input type="number" value={agentDeposit} onChange={(event) => setAgentDeposit(event.target.value)} placeholder="Deposit" />
                <input value={agentNextOfKinName} onChange={(event) => setAgentNextOfKinName(event.target.value)} placeholder="Next of Kin Name" />
                <input value={agentNextOfKinId} onChange={(event) => setAgentNextOfKinId(event.target.value)} placeholder="Next of Kin ID" />
                <input value={agentNextOfKinPhone} onChange={(event) => setAgentNextOfKinPhone(event.target.value)} placeholder="Next of Kin Phone" />
                <button type="submit" disabled={agentLoading}>{agentLoading ? 'Adding…' : 'Add Tenant'}</button>
              </form>
            </div>

            <div className="card">
              <div className="card-label">Water Meter Billing</div>
              <h3 style={{ marginBottom: 16 }}>Record Water Reading</h3>
              <p style={{ fontSize: '13px', color: 'var(--ink-3)', marginBottom: 12 }}>Enter current meter reading. Water is billed at tiered rates: 0-6m³ (88 KES), 7-20m³ (132 KES), 21-50m³ (137 KES), 51-100m³ (148 KES), 101-300m³ (165 KES), 300+m³ (custom). Consumption = Current - Previous.</p>
              <input type="month" value={waterMonthDue} onChange={(event) => setWaterMonthDue(event.target.value)} placeholder="Billing month" style={{ marginBottom: 12 }} />
              {units.length === 0 ? (
                <p style={{ color: 'var(--ink-3)', fontSize: '13px' }}>No units available. Add tenants first to create units.</p>
              ) : (
                <div style={{ maxHeight: '240px', overflow: 'auto', marginBottom: 12, border: '1px solid var(--line)', borderRadius: '8px', padding: '8px' }}>
                  {units.map((unit) => (
                    <div key={unit.id} style={{ display: 'flex', gap: 8, alignItems: 'center', padding: '8px 0', borderBottom: '1px solid var(--line-soft)' }}>
                      <span style={{ width: 100, fontSize: '13px' }}>Unit {unit.unit_number}</span>
                      <span style={{ width: 80, fontSize: '12px', color: 'var(--ink-3)' }}>{unit.previous_water_reading ?? 0} →</span>
                      <input type="number" value={waterMeterReadings[unit.id] || ''} onChange={(e) => setWaterMeterReadings((prev) => ({ ...prev, [unit.id]: e.target.value }))} placeholder="Current" style={{ flex: 1, padding: '6px' }} />
                      <button type="button" onClick={() => handleWaterMeterReading(unit.id)} disabled={!waterMeterReadings[unit.id]} style={{ padding: '6px 12px', fontSize: '12px' }}>Bill</button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </section>

          <section className="dashboard-section-grid" style={{ display: 'grid', gridTemplateColumns: '1fr', gap: 18, marginTop: 24 }}>
            <div className="card">
              <div className="card-label">Tenant Records</div>
              <h3 style={{ marginBottom: 16 }}>Manage Tenants</h3>
              {tenants.length === 0 ? <p style={{ color: 'var(--ink-3)' }}>No tenants found.</p> : (
                <div className="table-shell">
                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '14px' }}>
                    <thead>
                      <tr style={{ borderBottom: '1px solid var(--line)' }}>
                        <th style={{ textAlign: 'left', padding: '12px', fontWeight: 700 }}>Tenant</th>
                        <th style={{ textAlign: 'left', padding: '12px', fontWeight: 700 }}>Unit</th>
                        <th style={{ textAlign: 'left', padding: '12px', fontWeight: 700 }}>Lease</th>
                        <th style={{ textAlign: 'left', padding: '12px', fontWeight: 700 }}>Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {tenants.map((tenant) => (
                        <tr key={tenant.id} style={{ borderBottom: '1px solid var(--line-soft)' }}>
                          <td style={{ padding: '14px 12px' }}>
                            <strong>{tenant.full_name}</strong>
                            <div style={{ color: 'var(--ink-3)', fontSize: '13px' }}>{tenant.email}</div>
                          </td>
                          <td style={{ padding: '14px 12px', color: 'var(--ink-3)' }}>{tenant.unit}</td>
                          <td style={{ padding: '14px 12px', color: 'var(--ink-3)' }}>{tenant.lease_start} → {tenant.lease_end}</td>
                          <td style={{ padding: '14px 12px' }}>
                            <button className="btn btn-ghost" style={{ fontSize: '12px', padding: '6px 12px', background: 'rgba(220,38,38,0.1)', color: '#7f1212' }} onClick={() => handleAgentTenantRemove(tenant.id)}>Mark Relocated</button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </section>

          <section className="dashboard-section-grid" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 18, marginTop: 24 }}>
            <div className="card">
              <div className="card-label">Overdue Notifications</div>
              <h3 style={{ marginBottom: 16 }}>Send Notice</h3>
              <form onSubmit={handleSendNotification} className="form-grid">
                <select value={notificationTenantId} onChange={(event) => setNotificationTenantId(event.target.value)} required>
                  <option value="">Select tenant</option>
                  {tenants.map((tenant) => <option key={tenant.id} value={tenant.id}>{tenant.full_name} — Unit {tenant.unit}</option>)}
                </select>
                <textarea value={notificationMessage} onChange={(event) => setNotificationMessage(event.target.value)} required placeholder="Overdue rent reminder..." style={{ gridColumn: 'span 2', minHeight: 90, padding: 12, borderRadius: 10, border: '1px solid var(--line)', background: 'var(--surface)' }} />
                <button type="submit" style={{ gridColumn: 'span 2' }}>Send Notification</button>
              </form>

              <h3 style={{ marginTop: 24, marginBottom: 12 }}>Tenant Complaints</h3>
              {comments.length === 0 ? <p style={{ color: 'var(--ink-3)' }}>No complaints yet.</p> : comments.map((comment) => (
                <div key={comment.id} style={{ padding: '12px 0', borderBottom: '1px solid var(--line-soft)' }}>
                  <strong>{comment.tenant}</strong>
                  <div style={{ color: 'var(--ink-3)', fontSize: '13px' }}>{comment.message}</div>
                  <span style={{ display: 'inline-block', marginTop: 6, padding: '3px 9px', borderRadius: '999px', fontSize: '11px', fontWeight: 700, background: comment.status === 'open' ? 'rgba(245,158,11,0.12)' : 'rgba(16,185,129,0.12)', color: comment.status === 'open' ? 'var(--amber)' : 'var(--accent)' }}>{comment.status}</span>
                </div>
              ))}
            </div>

            <div className="card">
              <div className="card-label">Water Bills</div>
              <h3 style={{ marginBottom: 16 }}>Recent Water Billing</h3>
              {waterBills.length === 0 ? <p style={{ color: 'var(--ink-3)' }}>No water bills generated yet.</p> : (
                <div className="table-shell">
                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '14px' }}>
                    <thead>
                      <tr style={{ borderBottom: '1px solid var(--line)' }}>
                        <th style={{ textAlign: 'left', padding: '8px', fontWeight: 700 }}>Tenant</th>
                        <th style={{ textAlign: 'left', padding: '8px', fontWeight: 700 }}>Consumption</th>
                        <th style={{ textAlign: 'left', padding: '8px', fontWeight: 700 }}>Amount</th>
                        <th style={{ textAlign: 'left', padding: '8px', fontWeight: 700 }}>Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      {waterBills.slice(0, 5).map((bill) => (
                        <tr key={bill.id} style={{ borderBottom: '1px solid var(--line-soft)' }}>
                          <td style={{ padding: '10px 8px', color: 'var(--ink-2)' }}>{bill.tenants?.full_name ?? '—'}</td>
                          <td style={{ padding: '10px 8px', fontSize: '12px', color: 'var(--ink-3)' }}>{bill.water_consumption ?? 0} units</td>
                          <td style={{ padding: '10px 8px', fontWeight: 600 }}>{formatCurrency(bill.amount)}</td>
                          <td style={{ padding: '10px 8px' }}>
                            <span style={{ padding: '2px 8px', borderRadius: '999px', fontSize: '11px', background: bill.status === 'paid' ? 'rgba(16,185,129,0.12)' : 'rgba(245,158,11,0.12)', color: bill.status === 'paid' ? 'var(--accent)' : 'var(--amber)' }}>{bill.status}</span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </section>
        </>
      )}

{!isAgent && stats && (
        <section className="bento-grid">
          <div className="bento-card" style={{ padding: '14px 16px', display: 'flex', alignItems: 'center', gap: 12 }}>
            <div style={{ width: 48, height: 48, borderRadius: '50%', background: 'rgba(30,58,138,0.12)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#1e3a8a" strokeWidth="2"><path d="M3 21h18"/><path d="M5 21V7l8-4v18"/><path d="M19 21V11l-6-4"/></svg>
            </div>
            <div>
              <div className="card-label">Properties</div>
              <h3 style={{ margin: 0 }}>{stats.properties}</h3>
              <Sparkline data={[1, 3, stats.properties]} color="#1e3a8a" w={80} h={24}/>
              <p style={{ margin: 0, color: 'var(--ink-3)', fontSize: '13px' }}>total</p>
            </div>
          </div>

          <div className="bento-card" style={{ padding: '14px 16px', display: 'flex', alignItems: 'center', gap: 12 }}>
            <div style={{ width: 48, height: 48, borderRadius: '50%', background: 'rgba(245,158,11,0.12)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="var(--amber)" strokeWidth="2"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/></svg>
            </div>
            <div>
              <div className="card-label">Agents</div>
              <h3 style={{ margin: 0 }}>{stats.agents}</h3>
              <Sparkline data={[0, 1, stats.agents]} color="var(--amber)" w={80} h={24}/>
              <p style={{ margin: 0, color: 'var(--ink-3)', fontSize: '13px' }}>assigned</p>
            </div>
          </div>

          <div className="bento-card" style={{ padding: '14px 16px', display: 'flex', alignItems: 'center', gap: 12 }}>
            <div style={{ width: 48, height: 48, borderRadius: '50%', background: 'rgba(16,185,129,0.12)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="var(--accent)" strokeWidth="2"><path d="M22 11.08V12a10 12 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 8 10.01"/></svg>
            </div>
            <div>
              <div className="card-label">Tenants</div>
              <h3 style={{ margin: 0 }}>{stats.tenants}</h3>
              <Sparkline data={[2, 3, stats.tenants]} color="var(--accent)" w={80} h={24}/>
              <p style={{ margin: 0, color: 'var(--ink-3)', fontSize: '13px' }}>active records</p>
            </div>
          </div>

<div className="bento-card" style={{ padding: '14px 16px', display: 'flex', alignItems: 'center', gap: 12 }}>
             <div style={{ width: 48, height: 48, borderRadius: '50%', background: 'rgba(14,165,233,0.12)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
               <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#0ea5e9" strokeWidth="2"><path d="M12 1v22"/><path d="M5 5h14"/><path d="M5 19h14"/></svg>
             </div>
             <div>
               <div className="card-label">Collections</div>
               <h3 style={{ margin: 0 }}>{formatCurrency(stats.total_payments)}</h3>
               <Sparkline data={[50000, 100000, stats.total_payments]} color="#0ea5e9" w={80} h={24}/>
               <p style={{ margin: 0, color: 'var(--ink-3)', fontSize: '13px' }}>total payments</p>
             </div>
           </div>

           <div className="bento-card" style={{ padding: '14px 16px', display: 'flex', flexDirection: 'column', gap: 12 }}>
             <div style={{ display: 'flex', alignItems: 'center', gap: 12, width: '100%' }}>
               <div style={{ width: 48, height: 48, borderRadius: '50%', background: 'rgba(16,185,129,0.12)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                 <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="var(--accent)" strokeWidth="2"><path d="M3 21h18"/><path d="M5 21V7l8-4v18"/><path d="M19 21V11l-6-4"/></svg>
               </div>
               <div>
                 <div className="card-label">Revenue Trend</div>
                 <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                   <span style={{ color: trendPercent >= 0 ? 'var(--accent)' : '#b91c1c', fontWeight: 700, fontSize: '14px' }}>{trendPercent >= 0 ? '+' : ''}{trendPercent.toFixed(1)}%</span>
                   <h3 style={{ margin: 0 }}>{formatCurrency(currentMonthPayment)}</h3>
                 </div>
                 <p style={{ margin: 0, color: 'var(--ink-3)', fontSize: '13px' }}>trend vs last month</p>
               </div>
             </div>
<Sparkline data={monthlyPayments.map(m => m.value).length > 0 ? monthlyPayments.map(m => m.value) : [0, 0, 0]} color="var(--accent)" w={300} h={40}/>
              <div style={{ display: 'flex', justifyContent: 'space-between', width: '100%', color: 'var(--ink-3)', fontSize: '11px' }}>
                {monthlyPayments.map(m => <span key={m.label}>{m.label}</span>)}
              </div>
           </div>

           <div className="bento-card" style={{ padding: '14px 16px', display: 'flex', alignItems: 'center', gap: 12 }}>
             <div style={{ width: 48, height: 48, borderRadius: '50%', background: 'rgba(16,185,129,0.12)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
               <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#10b981" strokeWidth="2"><path d="M3 21h18"/><path d="M5 21V7l8-4v18"/><path d="M19 21V11l-6-4"/></svg>
             </div>
             <div style={{ flex: 1 }}>
               <div className="card-label">Occupancy</div>
               <h3 style={{ margin: 0 }}>{stats.occupiedUnits}/{stats.occupiedUnits + stats.vacantUnits}</h3>
               <DonutChart data={[
                 { label: 'Occupied', value: stats.occupiedUnits, color: '#10b981' },
                 { label: 'Vacant', value: stats.vacantUnits, color: '#9ca3af' }
               ]} size={60} centerLabel={`${stats.occupiedUnits}`}/>
               <p style={{ margin: 0, color: 'var(--ink-3)', fontSize: '13px' }}>Occupied / Vacant</p>
             </div>
           </div>

          <div className="bento-card" style={{ padding: '14px 16px', display: 'flex', alignItems: 'center', gap: 12 }}>
            <div style={{ width: 48, height: 48, borderRadius: '50%', background: 'rgba(220,38,38,0.12)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#b91c1c" strokeWidth="2"><path d="M12 9v2m0 4h.01"/><circle cx="12" cy="12" r="10"/></svg>
            </div>
            <div>
              <div className="card-label">Outstanding</div>
              <h3 style={{ margin: 0, color: '#b91c1c' }}>{formatCurrency(totalBalance)}</h3>
              <Sparkline data={[0, 10000, totalBalance]} color="#b91c1c" w={80} h={24}/>
              <p style={{ margin: 0, color: 'var(--ink-3)', fontSize: '13px' }}>rent owed</p>
            </div>
          </div>
        </section>
      )}

      {!isAgent && (
        <>
          <section style={{ marginTop: 24 }}>
            <div className="card-admin-header" style={{ marginBottom: 16 }}>
              <div><span className="landlord-kicker">Vacant Units</span><h2>Available for Rent</h2></div>
            </div>
            {stats?.vacantUnitsList && stats.vacantUnitsList.length > 0 ? (
              <div className="table-shell"><table className="landlord-table">
                <thead><tr><th>Unit</th><th>Property</th><th>Rent Amount</th></tr></thead>
                <tbody>{stats.vacantUnitsList.map((u, i) => <tr key={i}><td>{u.unit_number}</td><td>{u.property_name}</td><td>{formatCurrency(u.rent_amount)}</td></tr>)}</tbody>
              </table></div>
            ) : <p className="landlord-muted">No vacant units.</p>}
          </section>

          <section style={{ marginTop: 24 }}>
            <div className="card-admin-header" style={{ marginBottom: 16 }}>
              <div><span className="landlord-kicker">Rent Owed</span><h2>Tenants with Outstanding Balances</h2></div>
            </div>
            {rentOwedByTenant && rentOwedByTenant.some(t => t.balance_remaining > 0) ? (
              <div className="table-shell"><table className="landlord-table">
                <thead><tr><th>Tenant</th><th>Unit</th><th>Total Paid</th><th>Balance</th><th>Last Payment</th></tr></thead>
                <tbody>{rentOwedByTenant.filter(t => t.balance_remaining > 0).map(t => <tr key={t.id}><td className="landlord-name">{t.full_name}</td><td>{t.unit}</td><td>{formatCurrency(t.total_paid)}</td><td style={{ color: 'var(--error)' }}>{formatCurrency(t.balance_remaining)}</td><td>{t.last_payment ? new Date(t.last_payment).toLocaleDateString() : '—'}</td></tr>)}</tbody>
              </table></div>
            ) : <p className="landlord-muted">All tenants have paid.</p>}
          </section>
        </>
      )}

      {!isAgent && (
        <section className="dashboard-section-grid" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 18, marginTop: 24 }}>
          <div className="card">
            <div className="card-label">Properties and Agents</div>
            <h3 style={{ marginBottom: 16 }}>Add Property</h3>
            <form onSubmit={handleAddProperty} className="form-grid" style={{ marginBottom: 24 }}>
              <input value={propertyName} onChange={(event) => setPropertyName(event.target.value)} required placeholder="Property name" />
              <input value={propertyAddress} onChange={(event) => setPropertyAddress(event.target.value)} required placeholder="Property address" />
              <input value={propertySize} onChange={(event) => setPropertySize(event.target.value)} placeholder="Size / units" />
              <button type="submit" disabled={propertyLoading}>{propertyLoading ? 'Adding…' : 'Add Property'}</button>
            </form>

            <h3 style={{ marginBottom: 16 }}>Add Agent</h3>
            {properties.length === 0 ? <p style={{ padding: '12px', borderRadius: '10px', background: 'rgba(245,158,11,0.1)', color: '#92400e', marginBottom: 16 }}>Add a property first, then assign an agent to that property.</p> : null}
            <form onSubmit={handleAddAgent} className="form-grid">
              <input value={agentName} onChange={(event) => setAgentName(event.target.value)} required placeholder="Agent full name" />
              <input type="email" value={agentEmail} onChange={(event) => setAgentEmail(event.target.value)} required placeholder="Agent email" />
              <input type="password" value={agentPassword} onChange={(event) => setAgentPassword(event.target.value)} required placeholder="Password" />
              <select value={agentPropertyId} onChange={(event) => setAgentPropertyId(event.target.value)} required>
                <option value="">Select property</option>
                {properties.map((property) => <option key={property.id} value={property.id}>{property.name}</option>)}
              </select>
              <button type="submit" disabled={agentLoading}>{agentLoading ? 'Adding…' : 'Add Agent'}</button>
            </form>

            <h3 style={{ marginTop: 24, marginBottom: 12 }}>Assigned Agents</h3>
            {agents.length === 0 ? <p style={{ color: 'var(--ink-3)' }}>No agents assigned yet.</p> : agents.map((agent) => (
              <div key={agent.id} style={{ display: 'grid', gridTemplateColumns: '1fr auto', gap: 8, alignItems: 'center', padding: '12px 0', borderBottom: '1px solid var(--line-soft)' }}>
                <div>
                  <strong>{agent.full_name}</strong>
                  <div style={{ color: 'var(--ink-3)', fontSize: '13px' }}>{agent.email}</div>
                  <div style={{ color: 'var(--ink-3)', fontSize: '13px' }}>{agent.property_name || 'Unassigned'} · {agent.status}</div>
                </div>
                <button className="btn btn-ghost" style={{ fontSize: '12px', padding: '6px 12px', background: agent.status === 'active' ? 'rgba(220,38,38,0.1)' : 'rgba(16,185,129,0.1)', color: agent.status === 'active' ? '#7f1212' : 'var(--accent)' }} onClick={() => handleRemoveAgent(agent.id)} disabled={agent.status !== 'active'}>{agent.status === 'active' ? 'Remove' : 'Removed'}</button>
</div>
              ))}
            </div>

            <div className="card">
              <div className="card-label">Portfolio</div>
              <h3 style={{ marginBottom: 16 }}>Properties</h3>
              {properties.length === 0 ? <p style={{ color: 'var(--ink-3)' }}>No properties added yet.</p> : properties.map((property) => (
                <div key={property.id} style={{ padding: '12px 0', borderBottom: '1px solid var(--line-soft)' }}>
                  <strong>{property.name}</strong>
                  <div style={{ color: 'var(--ink-3)', fontSize: '13px' }}>{property.address}</div>
                </div>
              ))}
              <h3 style={{ marginTop: 24, marginBottom: 16 }}>Recent Payments</h3>
              {payments.length === 0 ? <p style={{ color: 'var(--ink-3)' }}>No payments recorded yet.</p> : payments.slice(0, 6).map((payment) => (
                <div key={payment.id} style={{ padding: '12px 0', borderBottom: '1px solid var(--line-soft)' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <strong>{payment.tenant}</strong>
                    <span style={{ color: payment.balance_remaining > 0 ? '#dc2626' : 'var(--accent)', fontWeight: 700 }}>{formatCurrency(payment.balance_remaining)}</span>
                  </div>
                  <div style={{ color: 'var(--ink-3)', fontSize: '13px' }}>{payment.property} · {payment.created_at ? new Date(payment.created_at).toLocaleDateString() : ''}</div>
                </div>
              ))}
            </div>
          </section>
        )}
        {showModal && (
          <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }} onClick={() => setShowModal(false)}>
            <div className="card" style={{ maxWidth: '500px', width: '90%', maxHeight: '400px', overflow: 'auto', padding: 20 }} onClick={(e) => e.stopPropagation()}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
                <h3 style={{ margin: 0 }}>{modalTitle}</h3>
                <button type="button" onClick={() => setShowModal(false)} style={{ background: 'none', border: 'none', fontSize: '20px', cursor: 'pointer', color: 'var(--ink-2)' }}>×</button>
              </div>
              {modalContent}
            </div>
          </div>
        )}
      </main>
    );
}