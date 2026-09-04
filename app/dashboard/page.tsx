'use client';

import { useEffect, useState, useMemo, lazy, Suspense } from 'react';
import Link from 'next/link';
import { supabase } from '../../lib/supabaseClient';
import { DashboardHeader, FormField, PremiumTable, SectionCard, StatCard, ThemeToggle } from '../components/dashboard-ui';
import { useDeactivationGuard, DeactivationPopup } from '../components/DeactivationGuard';

const Sparkline = lazy(() => import('../components/Sparkline'));
const DonutChart = lazy(() => import('../components/DonutChart'));

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
  month_due?: string;
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
    const [agentNextOfKinRelationship, setAgentNextOfKinRelationship] = useState('');
    const [agentNationalId, setAgentNationalId] = useState('');
    const [agentKraPin, setAgentKraPin] = useState('');
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
   const { isDeactivated, deactivationInfo, loading: guardLoading, handleLogout } = useDeactivationGuard();
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
  const [previousBalances, setPreviousBalances] = useState<{[id: string]: number}>({});
  const [recentSettlements, setRecentSettlements] = useState<Array<{tenant: string, unit: string, amount: number, settlementDate: Date}>>([]);
  const [showEditModal, setShowEditModal] = useState(false);
  const [editingAgent, setEditingAgent] = useState<any>(null);
  const [editForm, setEditForm] = useState({ name: '', email: '', propertyName: '' });

  const isAgent = roleLoaded && userRole === 'agent';
  const agentPropertyFromStorage = typeof window !== 'undefined' ? localStorage.getItem('agentPropertyId') || '' : '';
  const effectivePropertyId = selectedPropertyId || agentPropertyFromStorage;

  async function loadDashboard(refresh = false) {
    if (refresh) setRefreshing(true); else setLoading(true);
    setError('');

    // Don't load data if landlord is deactivated
    if (isDeactivated) {
      if (refresh) setRefreshing(false); else setLoading(false);
      return;
    }

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
          tenant_id: p.tenant_id,
          created_at: p.paid_at || p.created_at,
        })), ...(billsResult.bills ?? []).map((b: any) => ({
          ...b,
          tenant_id: b.tenant_id,
          amount: b.paid_amount ?? 0,
          balance_remaining: b.balance ?? b.balance_remaining,
          created_at: b.payment_date || b.paid_at || b.created_at,
          payment_date: b.payment_date,
          source: 'bills',
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
   const VALID_RENT_TYPES = ['rent', 'overdue'];
   
const rentOwedByTenant = useMemo(() => {
      if (!payments || payments.length === 0) return [];
      const tenantMap = new Map<string, any>();
      (tenants || []).forEach((t: any) => tenantMap.set(t.id, t));

      const byTenant = new Map<string, any>();
      
      payments.forEach((p: any) => {
        if (!VALID_RENT_TYPES.includes(p.transaction_type)) return;
        const tid = String(p.tenant_id || p.tenant_email || '');
        if (!tid) return;
        
        if (!byTenant.has(tid)) {
          const t = tenantMap.get(tid) || {};
          byTenant.set(tid, {
            id: tid,
            full_name: t.full_name || p.tenant_name || p.tenant || '',
            email: t.email || p.tenant_email || '',
            unit: t.unit || p.unit_number || p.unit || null,
            property: t.property || p.property_name || p.property || null,
            balance_remaining: 0,
            paid_amount: 0,
            paid_overdue_amount: 0,
            last_payment: p.created_at || null,
            payments: [] as any[],
          });
        }
        const entry = byTenant.get(tid);
        entry.payments.push(p);
        

         const paidAmt = Number(p.paid_amount ?? p.amount ?? 0);
         const balanceRem = Number(p.balance_remaining || 0);
         
         // Unpaid payments add to the outstanding balance (negative balance_remaining means still owed)
         if (balanceRem < 0) {
           entry.balance_remaining += Math.abs(balanceRem);
         }
         
         // Paid overdue payments offset what the tenant owes
         if (p.transaction_type === 'overdue' && balanceRem <= 0) {
           entry.paid_overdue_amount += paidAmt;
         }
         
         // Track all payments made
         entry.paid_amount += paidAmt;
        
        
        // Track last payment date
        if (p.created_at && (!entry.last_payment || p.created_at > entry.last_payment)) {
          entry.last_payment = p.created_at;
        }
      });

return Array.from(byTenant.values())
        .map((entry: any) => {
          const monthNames = ['january', 'february', 'march', 'april', 'may', 'june', 'july', 'august', 'september', 'october', 'november', 'december'];
          const parseMonthDue = (monthDue: string): { year: number; month: number } => {
            const trimmed = monthDue.trim();
            const ymdMatch = trimmed.match(/^(\d{4})-(\d{1,2})$/);
            if (ymdMatch) {
              return { year: parseInt(ymdMatch[1], 10), month: parseInt(ymdMatch[2], 10) };
            }
            const parts = trimmed.split(' ');
            const monthName = (parts[0] || '').toLowerCase();
            const year = Number(parts[1]) || 0;
            const monthIdx = monthNames.indexOf(monthName);
            return { year, month: monthIdx >= 0 ? monthIdx + 1 : 0 };
          };
          
          const sorted = entry.payments.sort((a: any, b: any) => {
            const aKey = parseMonthDue(a.month_due || '');
            const bKey = parseMonthDue(b.month_due || '');
            if (aKey.year !== bKey.year) return aKey.year - bKey.year;
            if (aKey.month !== bKey.month) return aKey.month - bKey.month;
            return String(a.month_due).localeCompare(String(b.month_due));
          });

          // Net rent owed = outstanding balance - paid overdue payments (cannot go negative)
          const netBalance = Math.max(entry.balance_remaining - entry.paid_overdue_amount, 0);

          return {
            ...entry,
            net_balance: netBalance,
            total_paid: entry.paid_amount,
            sorted_payments: sorted
          };
        })
        .filter((t: any) => t.net_balance > 0);
  }, [payments, tenants]);

  const totalBalance = rentOwedByTenant.reduce((sum: number, t: any) => sum + Number(t.net_balance || 0), 0);

  const [rentOwedTenants, setRentOwedTenants] = useState<Array<{
    id: string;
    full_name: string;
    email: string;
    unit: string;
    property: string;
    net_balance: number;
    total_paid: number;
    last_payment: string | null;
    rent_amount: number;
    next_due_date: string | null;
    overdue_dates: Array<{ month_due: string; due_date: string; days_overdue: number }>;
  }>>([]);
  const [dueCheckLoading, setDueCheckLoading] = useState(false);

  useEffect(() => {
    void fetchOverdueInfo();
  }, [roleLoaded, rentOwedByTenant]);

  useEffect(() => {
    if (!roleLoaded || loading || isAgent) return;
    const interval = window.setInterval(() => {
      void fetchOverdueInfo();
    }, 300000);
    return () => window.clearInterval(interval);
  }, [roleLoaded, loading, isAgent]);

  async function fetchOverdueInfo() {
    setDueCheckLoading(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const headers: Record<string, string> = { 'Content-Type': 'application/json' };
      if (session?.access_token) headers.Authorization = `Bearer ${session.access_token}`;

      const response = await fetch('/api/rent/due-check', { headers, cache: 'no-store' });
      if (response.ok) {
        const result = await response.json();
        const overdueMap = new Map<string, any>();
        (result.overdue_tenants ?? []).forEach((t: any) => {
          overdueMap.set(t.tenant_id, {
            rent_amount: t.rent_amount,
            next_due_date: t.next_due_date,
            overdue_dates: t.overdue_dates ?? [],
          });
        });

        const merged = (rentOwedByTenant ?? []).map((t) => {
          const info = overdueMap.get(t.id);
          return {
            ...t,
            rent_amount: info?.rent_amount ?? 0,
            next_due_date: info?.next_due_date ?? null,
            overdue_dates: info?.overdue_dates ?? [],
          };
        });
        setRentOwedTenants(merged);
      }
    } catch (e) {
      // silent fail - due check is best-effort
    } finally {
      setDueCheckLoading(false);
    }
  }

  const monthlyPayments = useMemo(() => {
    const months: { label: string; value: number }[] = [];
    const monthMap = new Map<string, number>();
    const labels = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    const monthNames = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
    (payments || []).forEach((p: any) => {
      if (!VALID_RENT_TYPES.includes(p.transaction_type)) return;
      const paidAmt = Number(p.paid_amount ?? p.amount ?? 0);
      if (p.month_due) {
        const monthParts = p.month_due?.split(' ');
        if (monthParts?.length >= 2) {
          const monthName = monthParts[0];
          let year = monthParts[1];
          const monthIdx = monthNames.indexOf(monthName);
          if (monthIdx >= 0) {
            if (!year || isNaN(Number(year))) {
              year = String(new Date().getFullYear());
            }
            const key = `${year}-${String(monthIdx + 1).padStart(2, '0')}`;
            monthMap.set(key, (monthMap.get(key) || 0) + paidAmt);
            return;
          }
        } else if (monthParts?.length === 1 && monthNames.includes(monthParts[0])) {
          const monthIdx = monthNames.indexOf(monthParts[0]);
          const year = String(new Date().getFullYear());
          const key = `${year}-${String(monthIdx + 1).padStart(2, '0')}`;
          monthMap.set(key, (monthMap.get(key) || 0) + paidAmt);
          return;
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

  async function handleReassignAgent(agentId: string) {
    const propertyName = prompt('Enter the property name to reassign this agent to:');
    if (!propertyName) return;

    const response = await fetch(`/api/agents?id=${encodeURIComponent(agentId)}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'reassign', propertyName }),
    });

    const result = await response.json();
    if (!response.ok) {
      setError(result.message ?? 'Unable to reassign agent.');
      return;
    }

    setAgents((current) => current.map((agent) => (agent.id === agentId ? { ...agent, property_name: propertyName } : agent)));
    setMessage('Agent reassigned successfully.');
  }

  async function handleDeleteAgent(agentId: string) {
    if (!confirm('Permanently delete this agent? This cannot be undone.')) return;

    const response = await fetch(`/api/agents?id=${encodeURIComponent(agentId)}`, { method: 'DELETE' });
    const result = await response.json();

    if (!response.ok) {
      setError(result.message ?? 'Unable to delete agent.');
      return;
    }

    setAgents((current) => current.filter((agent) => agent.id !== agentId));
    setMessage('Agent deleted permanently.');
  }

  async function handleReactivateAgent(agentId: string) {
    const response = await fetch(`/api/agents?id=${encodeURIComponent(agentId)}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'reactivate' }),
    });

    const result = await response.json();
    if (!response.ok) {
      setError(result.message ?? 'Unable to reactivate agent.');
      return;
    }

    setAgents((current) => current.map((agent) => (agent.id === agentId ? { ...agent, status: 'active' } : agent)));
    setMessage('Agent reactivated successfully.');
  }

  function handleEditAgent(agent: any) {
    setEditingAgent(agent);
    setEditForm({ name: agent.full_name || '', email: agent.email || '', propertyName: agent.property_name || '' });
    setShowEditModal(true);
  }

  async function handleSaveAgentEdit() {
    if (!editingAgent) return;
    const response = await fetch(`/api/agents?id=${encodeURIComponent(editingAgent.id)}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'update', fullName: editForm.name, email: editForm.email, propertyName: editForm.propertyName }),
    });

    const result = await response.json();
    if (!response.ok) {
      setError(result.message ?? 'Unable to update agent.');
      return;
    }

    setAgents((current) => current.map((agent) => (agent.id === editingAgent.id ? { ...agent, full_name: editForm.name, email: editForm.email, property_name: editForm.propertyName } : agent)));
    setShowEditModal(false);
    setEditingAgent(null);
    setMessage('Agent updated successfully.');
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
        body: JSON.stringify({ 
          propertyId: effectivePropertyId, 
          fullName: agentTenantName, 
          email: agentTenantEmail, 
          phone: agentTenantPhone, 
          unitId: agentTenantUnitId || undefined, 
          leaseStart: agentLeaseStart, 
          leaseEnd: agentLeaseEnd, 
          depositAmount: Number(agentDeposit), 
          nationalId: agentNationalId || null, 
          kraPin: agentKraPin || null, 
          nextOfKinName: agentNextOfKinName || null, 
          nextOfKinId: agentNextOfKinId || null, 
          nextOfKinPhone: agentNextOfKinPhone || null, 
          nextOfKinRelationship: agentNextOfKinRelationship || null 
        }),
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
    setAgentNextOfKinRelationship('');
    setAgentNationalId('');
    setAgentKraPin('');
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

  if (!roleLoaded) {
    return (
      <>
      {isDeactivated && <DeactivationPopup landlordName={deactivationInfo?.landlordName} onLogout={handleLogout} />}
      <main className="container" style={{ overflowX: 'hidden' }}>
        <DashboardHeader title={isAgent ? 'Agent Dashboard' : 'Landlord Dashboard'} subtitle="Preparing your workspace and recent activity…" action={<ThemeToggle />} />
        <SectionCard title="Loading dashboard" subtitle="Please wait while we load your workspace.">
          <p style={{ color: 'var(--ink-3)', margin: 0 }}>Fetching the latest metrics, tenants, and payment activity.</p>
        </SectionCard>
      </main>
      </>
    );
  }

  return (
    <>
    {isDeactivated && <DeactivationPopup landlordName={deactivationInfo?.landlordName} onLogout={handleLogout} />}
    <main className="container" style={{ overflowX: 'hidden' }}>
      <DashboardHeader
        title={isAgent ? 'Agent Dashboard' : 'Landlord Dashboard'}
        subtitle="A premium operations view of properties, tenants, collections, and occupancy."
        action={
          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
            <ThemeToggle />
            <button type="button" className="btn" onClick={() => loadDashboard(true)} disabled={refreshing}>{refreshing ? 'Refreshing…' : 'Refresh'}</button>
          </div>
        }
      />

      {loading && <SectionCard title="Loading workspace" subtitle="Syncing the latest dashboard data."><p style={{ color: 'var(--ink-3)', margin: 0 }}>Loading dashboard…</p></SectionCard>}
      {!loading && lastUpdated && <p style={{ color: 'var(--ink-3)', fontSize: '13px', marginBottom: 16 }}>Last updated: {lastUpdated.toLocaleTimeString()}</p>}
      {error && <p style={{ color: '#dc2626', marginBottom: 16 }}>{error}</p>}
      {message && <p style={{ color: 'var(--accent)', marginBottom: 16 }}>{message}</p>}

      {isAgent && !effectivePropertyId && (
        <p style={{ padding: '12px', borderRadius: '10px', background: 'rgba(245,158,11,0.1)', color: '#92400e', marginBottom: 16 }}>No property assigned. Please contact your landlord to assign a property.</p>
      )}

      {isAgent && effectivePropertyId && (
        <>
          <section className="dashboard-stats-grid" style={{ marginBottom: 24 }}>
            <StatCard title="Total Units" value={units.length} caption="in your portfolio" accent="indigo" icon={<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#4f46e5" strokeWidth="2"><path d="M3 21h18"/><path d="M5 21V7l8-4v18"/><path d="M19 21V11l-6-4"/></svg>} trend={<span className="status-pill">{units.filter((u) => u.occupancy_status === 'occupied').length} occupied</span>} onClick={() => { setModalTitle('All Units'); setModalContent(<div style={{ maxHeight: '300px', overflow: 'auto' }}>{units.length === 0 ? <p style={{ color: 'var(--ink-3)' }}>No units found.</p> : <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '14px' }}><thead><tr style={{ borderBottom: '1px solid var(--line)' }}><th style={{ textAlign: 'left', padding: '8px' }}>Unit</th><th style={{ textAlign: 'left', padding: '8px' }}>Status</th><th style={{ textAlign: 'left', padding: '8px' }}>Tenant</th></tr></thead><tbody>{units.map((unit) => <tr key={unit.id} style={{ borderBottom: '1px solid var(--line-soft)' }}><td style={{ padding: '8px' }}>{unit.unit_number}</td><td style={{ padding: '8px', color: unit.occupancy_status === 'occupied' ? 'var(--accent)' : 'var(--amber)' }}>{unit.occupancy_status ?? 'unknown'}</td><td style={{ padding: '8px', color: 'var(--ink-3)' }}>{unit.tenant?.full_name ?? '—'}</td></tr>)}</tbody></table>}</div>); setShowModal(true); }} />

            <StatCard title="Occupied" value={units.filter((u) => u.occupancy_status === 'occupied').length} caption="units with tenants" accent="emerald" icon={<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#10b981" strokeWidth="2"><path d="M22 11.08V12a10 12 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 8 10.01"/></svg>} trend={<span className="status-pill">{units.filter((u) => u.occupancy_status === 'vacant').length} vacant</span>} onClick={() => { setModalTitle('Occupied Units'); setModalContent(<div style={{ maxHeight: '300px', overflow: 'auto' }}>{units.filter(u => u.occupancy_status === 'occupied').length === 0 ? <p style={{ color: 'var(--ink-3)' }}>No occupied units.</p> : <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '14px' }}><thead><tr style={{ borderBottom: '1px solid var(--line)' }}><th style={{ textAlign: 'left', padding: '8px' }}>Unit</th><th style={{ textAlign: 'left', padding: '8px' }}>Tenant</th><th style={{ textAlign: 'left', padding: '8px' }}>Email</th></tr></thead><tbody>{units.filter(u => u.occupancy_status === 'occupied').map((unit) => <tr key={unit.id} style={{ borderBottom: '1px solid var(--line-soft)' }}><td style={{ padding: '8px' }}>{unit.unit_number}</td><td style={{ padding: '8px' }}>{unit.tenant?.full_name ?? '—'}</td><td style={{ padding: '8px', color: 'var(--ink-3)' }}>{unit.tenant?.email ?? '—'}</td></tr>)}</tbody></table>}</div>); setShowModal(true); }} />

            <StatCard title="Vacant" value={units.filter((u) => u.occupancy_status === 'vacant').length} caption="available for rent" accent="sky" icon={<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#0ea5e9" strokeWidth="2"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>} trend={<span className="status-pill warning">ready to lease</span>} onClick={() => { setModalTitle('Vacant Units'); setModalContent(<div style={{ maxHeight: '300px', overflow: 'auto' }}>{units.filter(u => u.occupancy_status === 'vacant').length === 0 ? <p style={{ color: 'var(--ink-3)' }}>No vacant units.</p> : <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '14px' }}><thead><tr style={{ borderBottom: '1px solid var(--line)' }}><th style={{ textAlign: 'left', padding: '8px' }}>Unit</th></tr></thead><tbody>{units.filter(u => u.occupancy_status === 'vacant').map((unit) => <tr key={unit.id} style={{ borderBottom: '1px solid var(--line-soft)' }}><td style={{ padding: '8px' }}>{unit.unit_number}</td></tr>)}</tbody></table>}</div>); setShowModal(true); }} />

            <StatCard title="Active Tenants" value={tenants.length} caption="registered" accent="amber" icon={<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="var(--amber)" strokeWidth="2"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/></svg>} trend={<span className="status-pill">{tenants.length > 0 ? 'healthy' : 'new'}</span>} onClick={() => { setModalTitle('All Tenants'); setModalContent(<div style={{ maxHeight: '300px', overflow: 'auto' }}>{tenants.length === 0 ? <p style={{ color: 'var(--ink-3)' }}>No tenants found.</p> : <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '14px' }}><thead><tr style={{ borderBottom: '1px solid var(--line)' }}><th style={{ textAlign: 'left', padding: '8px' }}>Name</th><th style={{ textAlign: 'left', padding: '8px' }}>Unit</th><th style={{ textAlign: 'left', padding: '8px' }}>Email</th></tr></thead><tbody>{tenants.map((tenant) => <tr key={tenant.id} style={{ borderBottom: '1px solid var(--line-soft)' }}><td style={{ padding: '8px' }}>{tenant.full_name}</td><td style={{ padding: '8px' }}>{tenant.unit}</td><td style={{ padding: '8px', color: 'var(--ink-3)' }}>{tenant.email}</td></tr>)}</tbody></table>}</div>); setShowModal(true); }} />

            <StatCard title="Occupancy Rate" value={`${units.length > 0 ? Math.round((units.filter((u) => u.occupancy_status === 'occupied').length / units.length) * 100) : 0}%`} caption="occupied / total" accent="rose" icon={<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#ec4899" strokeWidth="2"><path d="M22 11.08V12a10 12 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 8 10.01"/></svg>} trend={<Suspense fallback={<div style={{ width: 56, height: 56 }} />}><DonutChart data={[{ label: 'Occupied', value: units.filter((u) => u.occupancy_status === 'occupied').length, color: '#10b981' }, { label: 'Vacant', value: units.filter((u) => u.occupancy_status === 'vacant').length, color: '#9ca3af' }]} size={56} centerLabel={`${units.filter((u) => u.occupancy_status === 'occupied').length}/${units.length}`} /></Suspense>} />
          </section>

          <section className="dashboard-grid">
            <SectionCard title="Tenant Management" subtitle="Capture new residents with structured details and clear next steps.">
              <form onSubmit={handleAgentTenantCreate} className="form-grid">
                <FormField label="Tenant full name"><input value={agentTenantName} onChange={(event) => setAgentTenantName(event.target.value)} required placeholder="Tenant full name" /></FormField>
                <FormField label="Email"><input type="email" value={agentTenantEmail} onChange={(event) => setAgentTenantEmail(event.target.value)} required placeholder="Tenant email" /></FormField>
                <FormField label="Phone"><input value={agentTenantPhone} onChange={(event) => setAgentTenantPhone(event.target.value)} placeholder="Phone" /></FormField>
                <FormField label="National ID"><input value={agentNationalId} onChange={(event) => setAgentNationalId(event.target.value)} placeholder="National ID (Optional)" /></FormField>
                <FormField label="KRA PIN"><input value={agentKraPin} onChange={(event) => setAgentKraPin(event.target.value)} placeholder="KRA PIN (Optional)" /></FormField>
                <FormField label="Unit assignment"><select value={agentTenantUnitId} onChange={(event) => setAgentTenantUnitId(event.target.value)}><option value="">Auto-create unit</option>{units.map((unit) => <option key={unit.id} value={unit.id}>Unit {unit.unit_number}</option>)}</select></FormField>
                <FormField label="Lease start"><input type="date" value={agentLeaseStart} onChange={(event) => setAgentLeaseStart(event.target.value)} required /></FormField>
                <FormField label="Lease end"><input type="date" value={agentLeaseEnd} onChange={(event) => setAgentLeaseEnd(event.target.value)} required /></FormField>
                <FormField label="Deposit"><input type="number" value={agentDeposit} onChange={(event) => setAgentDeposit(event.target.value)} placeholder="Deposit" /></FormField>
                <FormField label="Next of kin"><input value={agentNextOfKinName} onChange={(event) => setAgentNextOfKinName(event.target.value)} placeholder="Next of Kin Name (Optional)" /></FormField>
                <FormField label="Next of kin ID"><input value={agentNextOfKinId} onChange={(event) => setAgentNextOfKinId(event.target.value)} placeholder="Next of Kin ID (Optional)" /></FormField>
                <FormField label="Next of kin phone"><input value={agentNextOfKinPhone} onChange={(event) => setAgentNextOfKinPhone(event.target.value)} placeholder="Next of Kin Phone (Optional)" /></FormField>
                <FormField label="Relationship"><select value={agentNextOfKinRelationship} onChange={(event) => setAgentNextOfKinRelationship(event.target.value)}><option value="">Next of Kin Relationship (Optional)</option><option value="partner">Partner</option><option value="spouse">Spouse</option><option value="parent">Parent</option><option value="sister">Sister</option><option value="brother">Brother</option><option value="roommate">Roommate</option><option value="uncle">Uncle</option><option value="grandparent">Grandparent</option></select></FormField>
                <button type="submit" className="btn" disabled={agentLoading}>{agentLoading ? 'Adding…' : 'Add Tenant'}</button>
              </form>
            </SectionCard>

            <SectionCard title="Water Meter Billing" subtitle="Capture utility usage and turn it into actionable billing entries.">
              <p style={{ margin: 0, color: 'var(--ink-3)', fontSize: '13px' }}>Enter current meter reading. Water is billed at tiered rates: 0-6m³ (88 KES), 7-20m³ (132 KES), 21-50m³ (137 KES), 51-100m³ (148 KES), 101-300m³ (165 KES), 300+m³ (custom). Consumption = Current - Previous.</p>
              <FormField label="Billing month"><input type="month" value={waterMonthDue} onChange={(event) => setWaterMonthDue(event.target.value)} placeholder="Billing month" /></FormField>
              {units.length === 0 ? (
                <p style={{ color: 'var(--ink-3)', fontSize: '13px', margin: 0 }}>No units available. Add tenants first to create units.</p>
              ) : (
                <div style={{ maxHeight: '240px', overflow: 'auto', border: '1px solid var(--line)', borderRadius: '12px', padding: '8px', display: 'grid', gap: 8 }}>
                  {units.map((unit) => (
                    <div key={unit.id} style={{ display: 'grid', gridTemplateColumns: 'minmax(90px, 1fr) auto minmax(120px, 1fr) auto', alignItems: 'center', gap: 8, padding: '8px 0', borderBottom: '1px solid var(--line-soft)' }}>
                      <span style={{ fontSize: '13px', fontWeight: 600 }}>Unit {unit.unit_number}</span>
                      <span style={{ fontSize: '12px', color: 'var(--ink-3)' }}>{unit.previous_water_reading ?? 0} →</span>
                      <input type="number" value={waterMeterReadings[unit.id] || ''} onChange={(e) => setWaterMeterReadings((prev) => ({ ...prev, [unit.id]: e.target.value }))} placeholder="Current" />
                      <button type="button" className="btn btn-secondary" onClick={() => handleWaterMeterReading(unit.id)} disabled={!waterMeterReadings[unit.id]} style={{ padding: '8px 12px', fontSize: '12px' }}>Bill</button>
                    </div>
                  ))}
                </div>
              )}
            </SectionCard>
          </section>

          <section className="dashboard-stack" style={{ marginTop: 24 }}>
            <SectionCard title="Tenant Records" subtitle="Keep your occupancy history and lease details neatly organized.">
              {tenants.length === 0 ? <p style={{ color: 'var(--ink-3)', margin: 0 }}>No tenants found.</p> : (
                <PremiumTable headers={['Tenant', 'Unit', 'Lease', 'Actions']}>
                  {tenants.map((tenant) => (
                    <tr key={tenant.id}>
                      <td>
                        <strong>{tenant.full_name}</strong>
                        <div style={{ color: 'var(--ink-3)', fontSize: '13px' }}>{tenant.email}</div>
                      </td>
                      <td>{tenant.unit}</td>
                      <td>{tenant.lease_start} → {tenant.lease_end}</td>
                      <td><button className="btn btn-secondary" style={{ padding: '8px 12px', fontSize: '12px' }} onClick={() => handleAgentTenantRemove(tenant.id)}>Mark Relocated</button></td>
                    </tr>
                  ))}
                </PremiumTable>
              )}
            </SectionCard>

            <section className="dashboard-grid">
              <SectionCard title="Overdue Notifications" subtitle="Send timely reminders to the right tenants.">
                <form onSubmit={handleSendNotification} className="form-grid">
                  <FormField label="Select tenant"><select value={notificationTenantId} onChange={(event) => setNotificationTenantId(event.target.value)} required><option value="">Select tenant</option>{tenants.map((tenant) => <option key={tenant.id} value={tenant.id}>{tenant.full_name} — Unit {tenant.unit}</option>)}</select></FormField>
                  <FormField label="Message"><textarea value={notificationMessage} onChange={(event) => setNotificationMessage(event.target.value)} required placeholder="Overdue rent reminder..." style={{ minHeight: 100 }} /></FormField>
                  <button type="submit" className="btn">Send Notification</button>
                </form>

                <h4 style={{ margin: '8px 0 0' }}>Tenant Complaints</h4>
                {comments.length === 0 ? <p style={{ color: 'var(--ink-3)', margin: 0 }}>No complaints yet.</p> : comments.map((comment) => (
                  <div key={comment.id} style={{ padding: '12px 0', borderBottom: '1px solid var(--line-soft)' }}>
                    <strong>{comment.tenant}</strong>
                    <div style={{ color: 'var(--ink-3)', fontSize: '13px' }}>{comment.message}</div>
                    <span className={`status-pill ${comment.status === 'open' ? 'warning' : ''}`} style={{ marginTop: 8 }}>{comment.status}</span>
                  </div>
                ))}
              </SectionCard>

              <SectionCard title="Water Bills" subtitle="Review the latest utility billing records.">
                {waterBills.length === 0 ? <p style={{ color: 'var(--ink-3)', margin: 0 }}>No water bills generated yet.</p> : (
                  <PremiumTable headers={['Tenant', 'Consumption', 'Amount', 'Status']}>
                    {waterBills.slice(0, 5).map((bill) => (
                      <tr key={bill.id}>
                        <td>{bill.tenants?.full_name ?? '—'}</td>
                        <td>{bill.water_consumption ?? 0} units</td>
                        <td>{formatCurrency(bill.amount)}</td>
                        <td><span className={`status-pill ${bill.status === 'paid' ? '' : 'warning'}`}>{bill.status}</span></td>
                      </tr>
                    ))}
                  </PremiumTable>
                )}
              </SectionCard>
            </section>
          </section>
        </>
      )}

{!isAgent && stats && (
        <section className="dashboard-stats-grid">
          <StatCard title="Properties" value={stats.properties} caption="total" accent="indigo" icon={<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#1e3a8a" strokeWidth="2"><path d="M3 21h18"/><path d="M5 21V7l8-4v18"/><path d="M19 21V11l-6-4"/></svg>} trend={<span className="status-pill">{stats.properties > 0 ? 'active' : 'new'}</span>} />

          <StatCard title="Agents" value={stats.agents} caption="assigned" accent="amber" icon={<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="var(--amber)" strokeWidth="2"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/></svg>} trend={<span className="status-pill">{stats.agents > 0 ? 'ready' : 'needed'}</span>} />

          <StatCard title="Tenants" value={stats.tenants} caption="active records" accent="emerald" icon={<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="var(--accent)" strokeWidth="2"><path d="M22 11.08V12a10 12 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 8 10.01"/></svg>} trend={<span className="status-pill">{stats.tenants > 0 ? 'stable' : 'growing'}</span>} />

          <StatCard title="Collections" value={formatCurrency(stats.total_payments)} caption="total payments" accent="sky" icon={<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#0ea5e9" strokeWidth="2"><path d="M12 1v22"/><path d="M5 5h14"/><path d="M5 19h14"/></svg>} trend={<span className="status-pill">{formatCurrency(stats.total_payments)}</span>} />

          <StatCard title="Revenue Trend" value={formatCurrency(currentMonthPayment)} caption="per month collected" accent="slate" icon={<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="var(--accent)" strokeWidth="2"><path d="M3 21h18"/><path d="M5 21V7l8-4v18"/><path d="M19 21V11l-6-4"/></svg>} trend={<div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}><span style={{ color: trendPercent >= 0 ? 'var(--accent)' : '#b91c1c', fontWeight: 700 }}>{trendPercent >= 0 ? '+' : ''}{trendPercent.toFixed(1)}%</span><Suspense fallback={<div style={{ width: 220, height: 40 }} />}><Sparkline data={monthlyPayments.map((m) => m.value).length > 0 ? monthlyPayments.map((m) => m.value) : [0, 0, 0]} color="var(--accent)" w={220} h={40} /></Suspense></div>} />

          <StatCard title="Occupancy" value={`${stats.occupiedUnits}/${stats.occupiedUnits + stats.vacantUnits}`} caption="occupied / vacant" accent="rose" icon={<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#10b981" strokeWidth="2"><path d="M3 21h18"/><path d="M5 21V7l8-4v18"/><path d="M19 21V11l-6-4"/></svg>} trend={<Suspense fallback={<div style={{ width: 58, height: 58 }} />}><DonutChart data={[{ label: 'Occupied', value: stats.occupiedUnits, color: '#10b981' }, { label: 'Vacant', value: stats.vacantUnits, color: '#9ca3af' }]} size={58} centerLabel={`${stats.occupiedUnits}`} /></Suspense>} />

          <StatCard title="Outstanding" value={formatCurrency(totalBalance)} caption="rent owed" accent="rose" icon={<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#b91c1c" strokeWidth="2"><path d="M12 9v2m0 4h.01"/><circle cx="12" cy="12" r="10"/></svg>} trend={<span className="status-pill danger">needs follow-up</span>} />
        </section>
      )}

      {!isAgent && (
        <>
          <section className="dashboard-stack" style={{ marginTop: 24 }}>
            <SectionCard title="Available for Rent" subtitle="A focused view of units that are currently vacant and ready for leasing.">
              {stats?.vacantUnitsList && stats.vacantUnitsList.length > 0 ? (
                <PremiumTable headers={['Unit', 'Property', 'Rent Amount']}>
                  {stats.vacantUnitsList.map((u, i) => (
                    <tr key={i}>
                      <td>{u.unit_number}</td>
                      <td>{u.property_name}</td>
                      <td>{formatCurrency(u.rent_amount)}</td>
                    </tr>
                  ))}
                </PremiumTable>
              ) : <p className="landlord-muted" style={{ margin: 0 }}>No vacant units.</p>}
            </SectionCard>

            <SectionCard title="Tenants with Outstanding Balances" subtitle="Track overdue balances and keep collections moving.">
              {rentOwedByTenant && rentOwedByTenant.some((t) => t.net_balance > 0) ? (
                <PremiumTable headers={['Tenant', 'Unit', 'Monthly Rent', 'Due Date', 'Overdue Dates', 'Total Paid', 'Balance', 'Last Payment']}>
                  {(rentOwedTenants.length > 0 ? rentOwedTenants : rentOwedByTenant)
                    .filter((t) => t.net_balance > 0)
                    .map((t) => (
                    <tr key={t.id}>
                      <td>{t.full_name}</td>
                      <td>{t.unit}</td>
                      <td>{formatCurrency(t.rent_amount ?? 0)}</td>
                      <td>{t.next_due_date ? new Date(t.next_due_date).toLocaleDateString() : '—'}</td>
                      <td>
                        {(t.overdue_dates ?? []) && (t.overdue_dates as Array<{ month_due: string; due_date: string; days_overdue: number }>).length > 0
                          ? (t.overdue_dates as Array<{ month_due: string; due_date: string; days_overdue: number }>)
                              .sort((a, b) => new Date(b.due_date).getTime() - new Date(a.due_date).getTime())
                              .slice(0, 3)
                              .map((od) => (
                                <div key={od.due_date} style={{ fontSize: '12px', marginBottom: '2px' }}>
                                  <span style={{ color: od.days_overdue >= 14 ? '#dc2626' : '#f59e0b', fontWeight: 600 }}>{od.month_due}</span>
                                  <span style={{ color: 'var(--ink-3)' }}> — {od.days_overdue}d overdue</span>
                                </div>
                              ))
                          : <span style={{ color: 'var(--ink-3)', fontSize: '12px' }}>No overdue records</span>}
                      </td>
                      <td>{formatCurrency(t.total_paid)}</td>
                      <td style={{ color: '#dc2626', fontWeight: 600 }}>{formatCurrency(t.net_balance)}</td>
                      <td>{t.last_payment ? new Date(t.last_payment).toLocaleDateString() : '—'}</td>
                    </tr>
                  ))}
                </PremiumTable>
              ) : <p className="landlord-muted" style={{ margin: 0 }}>All tenants have paid.</p>}
            </SectionCard>
          </section>
        </>
      )}

      {!isAgent && (
          <section className="dashboard-grid" style={{ marginTop: 24 }}>
            <SectionCard title="Properties and Agents" subtitle="Create new properties, onboard agents, and manage access from one place." className="property-card-dark">
              <form onSubmit={handleAddProperty} className="form-grid" style={{ marginBottom: 24 }}>
                <FormField label="Property name"><input value={propertyName} onChange={(event) => setPropertyName(event.target.value)} required placeholder="Property name" /></FormField>
                <FormField label="Address"><input value={propertyAddress} onChange={(event) => setPropertyAddress(event.target.value)} required placeholder="Property address" /></FormField>
                <FormField label="Size / units"><input value={propertySize} onChange={(event) => setPropertySize(event.target.value)} placeholder="Size / units" /></FormField>
                <button type="submit" className="btn" disabled={propertyLoading}>{propertyLoading ? 'Adding…' : 'Add Property'}</button>
              </form>

              <h4 style={{ margin: '4px 0 10px' }}>Add Agent</h4>
              {properties.length === 0 ? <p style={{ padding: '12px', borderRadius: '10px', background: 'rgba(245,158,11,0.1)', color: '#92400e', marginBottom: 16 }}>Add a property first, then assign an agent to that property.</p> : null}
              <form onSubmit={handleAddAgent} className="form-grid">
                <FormField label="Agent full name"><input value={agentName} onChange={(event) => setAgentName(event.target.value)} required placeholder="Agent full name" /></FormField>
                <FormField label="Email"><input type="email" value={agentEmail} onChange={(event) => setAgentEmail(event.target.value)} required placeholder="Agent email" /></FormField>
                <FormField label="Password"><input type="password" value={agentPassword} onChange={(event) => setAgentPassword(event.target.value)} required placeholder="Password" /></FormField>
                <FormField label="Property"><select value={agentPropertyId} onChange={(event) => setAgentPropertyId(event.target.value)} required><option value="">Select property</option>{properties.map((property) => <option key={property.id} value={property.id}>{property.name}</option>)}</select></FormField>
                <button type="submit" className="btn" disabled={agentLoading}>{agentLoading ? 'Adding…' : 'Add Agent'}</button>
              </form>

              <h4 style={{ margin: '18px 0 10px' }}>Assigned Agents</h4>
              {agents.length === 0 ? <p style={{ color: 'var(--ink-3)', margin: 0 }}>No agents assigned yet.</p> : (
                <div style={{ display: 'grid', gap: 12 }}>
                  {agents.map((agent) => (
                    <div key={agent.id} className={`bento-card ${agent.status === 'active' ? 'accent-emerald' : 'accent-amber'}`} style={{ padding: 14, gap: 12 }}>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <strong style={{ display: 'block', marginBottom: 4 }}>{agent.full_name}</strong>
                        <div style={{ color: 'var(--ink-3)', fontSize: '13px' }}>{agent.email}</div>
                        <div style={{ color: 'var(--ink-3)', fontSize: '13px' }}>{agent.property_name || 'Unassigned'} · {agent.status}</div>
                      </div>
                      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', justifyContent: 'flex-end', alignItems: 'center' }}>
                        {agent.status === 'active' ? (
                          <>
                            <button className="btn btn-secondary" style={{ padding: '6px 10px', fontSize: '12px' }} onClick={() => handleReassignAgent(agent.id)}>Reassign</button>
                            <button className="btn btn-secondary" style={{ padding: '6px 10px', fontSize: '12px' }} onClick={() => handleEditAgent(agent)}>Edit</button>
                            <button className="btn btn-secondary" style={{ padding: '6px 10px', fontSize: '12px' }} onClick={() => handleRemoveAgent(agent.id)}>Remove</button>
                            <button className="btn" style={{ padding: '6px 10px', fontSize: '12px', background: '#dc2626', color: '#fff', border: 'none' }} onClick={() => handleDeleteAgent(agent.id)}>Delete</button>
                          </>
                        ) : (
                          <button className="btn btn-secondary" style={{ padding: '6px 10px', fontSize: '12px' }} onClick={() => handleReactivateAgent(agent.id)}>Reactivate</button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </SectionCard>

            <SectionCard title="Portfolio" subtitle="Keep an eye on the properties you manage and the latest payment activity.">
              {properties.length === 0 ? <p style={{ color: 'var(--ink-3)', margin: 0 }}>No properties added yet.</p> : properties.map((property) => (
                <div key={property.id} style={{ padding: '12px 0', borderBottom: '1px solid var(--line-soft)' }}>
                  <strong>{property.name}</strong>
                  <div style={{ color: 'var(--ink-3)', fontSize: '13px' }}>{property.address}</div>
                </div>
              ))}
              <h4 style={{ margin: '18px 0 10px' }}>Recent Payments</h4>
              {payments.length === 0 ? <p style={{ color: 'var(--ink-3)', margin: 0 }}>No payments recorded yet.</p> : [...payments].sort((a, b) => {
                const monthNames = ['january', 'february', 'march', 'april', 'may', 'june', 'july', 'august', 'september', 'october', 'november', 'december'];
                const parseMonthDue = (monthDue: string | undefined): { year: number; month: number } => {
                  if (!monthDue) return { year: 0, month: 0 };
                  const trimmed = monthDue.trim();
                  const ymdMatch = trimmed.match(/^(\d{4})-(\d{1,2})$/);
                  if (ymdMatch) {
                    return { year: parseInt(ymdMatch[1], 10), month: parseInt(ymdMatch[2], 10) };
                  }
                  const parts = trimmed.split(' ');
                  const monthName = (parts[0] || '').toLowerCase();
                  const year = Number(parts[1]) || 0;
                  const monthIdx = monthNames.indexOf(monthName);
                  return { year, month: monthIdx >= 0 ? monthIdx + 1 : 0 };
                };
                const aKey = parseMonthDue((a as any).month_due);
                const bKey = parseMonthDue((b as any).month_due);
                if (aKey.year !== bKey.year) return aKey.year - bKey.year;
                const aOrder = aKey.month;
                const bOrder = bKey.month;
                return aOrder - bOrder;
              }).slice(0, 6).map((payment) => (
                <div key={payment.id} style={{ padding: '12px 0', borderBottom: '1px solid var(--line-soft)' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12 }}>
                    <strong>{payment.tenant}</strong>
                    <span style={{ color: payment.balance_remaining > 0 ? '#dc2626' : 'var(--accent)', fontWeight: 700 }}>{formatCurrency(payment.balance_remaining)}</span>
                  </div>
                  <div style={{ color: 'var(--ink-3)', fontSize: '13px' }}>{payment.property} · {(payment as any).month_due || ''} {(payment as any).source === 'bills' && (payment as any).payment_date ? new Date((payment as any).payment_date).toLocaleDateString() : (payment.created_at ? new Date(payment.created_at).toLocaleDateString() : '')}</div>
                </div>
              ))}
            </SectionCard>
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
        {showEditModal && (
          <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }} onClick={() => setShowEditModal(false)}>
            <div className="card" style={{ maxWidth: '420px', width: '90%', padding: 20 }} onClick={(e) => e.stopPropagation()}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
                <h3 style={{ margin: 0 }}>Edit Agent</h3>
                <button type="button" onClick={() => setShowEditModal(false)} style={{ background: 'none', border: 'none', fontSize: '20px', cursor: 'pointer', color: 'var(--ink-2)' }}>×</button>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                <label style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                  <span style={{ fontSize: 13, fontWeight: 600 }}>Full name</span>
                  <input value={editForm.name} onChange={(e) => setEditForm({ ...editForm, name: e.target.value })} required />
                </label>
                <label style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                  <span style={{ fontSize: 13, fontWeight: 600 }}>Email</span>
                  <input type="email" value={editForm.email} onChange={(e) => setEditForm({ ...editForm, email: e.target.value })} required />
                </label>
                <label style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                  <span style={{ fontSize: 13, fontWeight: 600 }}>Property</span>
                  <select value={editForm.propertyName} onChange={(e) => setEditForm({ ...editForm, propertyName: e.target.value })}>
                    <option value="">Unassigned</option>
                    {properties.map((property) => <option key={property.id} value={property.name}>{property.name}</option>)}
                  </select>
                </label>
                <button type="button" className="btn" onClick={handleSaveAgentEdit} style={{ marginTop: 4 }}>Save changes</button>
              </div>
            </div>
          </div>
        )}
      </main>
    </>
  );
}













