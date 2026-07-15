import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { getAllAdminUsers, requestError } from '../../../lib/supabaseAdmin';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL ?? '';
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? '';
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY ?? '';

if (!supabaseUrl || !serviceRoleKey) {
  throw new Error('Missing Supabase server environment variables');
}

const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey);
const nonPaymentTypes = ['complaint', 'notification'];

function toNumber(value: unknown) {
  const numeric = Number(value ?? 0);
  return Number.isNaN(numeric) ? 0 : numeric;
}

function decodeJWT(token: string): any | null {
  try {
    const parts = token.split('.');
    if (parts.length !== 3) return null;
    let payload = parts[1];
    payload = payload.replace(/-/g, '+').replace(/_/g, '/');
    while (payload.length % 4) payload += '=';
    try {
      return JSON.parse(atob(payload));
    } catch {
      return JSON.parse(Buffer.from(payload, 'base64').toString('utf8'));
    }
  } catch {
    return null;
  }
}

async function getAuthContext(request: NextRequest) {
  const cookie = request.headers.get('cookie') ?? '';
  const authorization = request.headers.get('authorization') ?? request.headers.get('Authorization');

  let sessionUser: any = null;

  if (authorization?.startsWith('Bearer ')) {
    const token = authorization.split(' ')[1];
    const decoded = decodeJWT(token);
    if (decoded?.sub) {
      sessionUser = { id: decoded.sub, email: decoded.email, user_metadata: decoded.user_metadata || {} };
    }
  }

  if (!sessionUser && cookie) {
    try {
      const supabaseAuth = createClient(supabaseUrl, supabaseAnonKey!, { global: { headers: { cookie } } });
      const { data: { user } } = await supabaseAuth.auth.getUser();
      sessionUser = user;
    } catch (e) {}
  }

  if (!sessionUser) {
    return { isSuperAdmin: false, userId: undefined, organizationId: null, sessionUser: null };
  }

  const userMetadata = sessionUser.user_metadata || {};
  let orgId = userMetadata.organization_id ?? null;

  if (!orgId && sessionUser.email) {
    const { data: profileByEmail } = await supabaseAdmin
      .from('profiles')
      .select('organization_id')
      .eq('email', sessionUser.email)
      .single();
    orgId = profileByEmail?.organization_id ?? null;
  }

  return {
    isSuperAdmin: userMetadata.role === 'super_admin',
    userId: sessionUser.id,
    organizationId: orgId,
    sessionUser,
  };
}

export async function GET(request: NextRequest) {
  try {
    const authContext = await getAuthContext(request);
    const urlPropertyId = request.nextUrl.searchParams.get('propertyId');

    const userMetadata = authContext.sessionUser?.user_metadata || {};
    const agentPropertyId = userMetadata?.property_id;
    const effectivePropertyId = urlPropertyId || agentPropertyId;
    const isAgent = userMetadata?.role === 'agent';
    const isSuperAdmin = authContext.isSuperAdmin;

    let propertiesQuery: any = supabaseAdmin.from('properties').select('id, name');
    let unitsQuery: any = supabaseAdmin.from('units').select('id, occupancy_status, property_id');
    let tenantsQuery: any = supabaseAdmin.from('tenants').select('id, lease_start, deposit_amount, unit_id');
    let subscriptionsQuery: any = supabaseAdmin.from('subscriptions').select('id, admin_id, status');

    // For landlords, filter by organization
    if (!isAgent && !isSuperAdmin && authContext.organizationId) {
      const { data: orgProps } = await supabaseAdmin.from('properties').select('id').eq('organization_id', authContext.organizationId);
      const propIds = (orgProps ?? []).map((p: any) => p.id);
      if (propIds.length > 0) {
        propertiesQuery = propertiesQuery.in('id', propIds);
        unitsQuery = unitsQuery.in('property_id', propIds);
        const { data: unitsInOrg } = await supabaseAdmin.from('units').select('id').in('property_id', propIds);
        const unitIds = (unitsInOrg ?? []).map((u: any) => u.id);
        if (unitIds.length > 0) {
          tenantsQuery = tenantsQuery.in('unit_id', unitIds);
        }
      }
    } else if (!isAgent && !isSuperAdmin && !authContext.organizationId) {
      propertiesQuery = propertiesQuery.eq('id', 'none');
      unitsQuery = unitsQuery.eq('property_id', 'none');
      tenantsQuery = tenantsQuery.eq('unit_id', 'none');
    } else if (effectivePropertyId) {
      propertiesQuery = propertiesQuery.eq('id', effectivePropertyId);
      unitsQuery = unitsQuery.eq('property_id', effectivePropertyId);
      const { data: unitsInProp } = await supabaseAdmin.from('units').select('id').eq('property_id', effectivePropertyId);
      const unitIds = (unitsInProp ?? []).map((u: any) => u.id);
      if (unitIds.length > 0) {
        tenantsQuery = tenantsQuery.in('unit_id', unitIds);
      }
    }

    const [{ data: propertiesData }, { data: unitsData }, { data: tenantsData }, { data: subscriptionsData }, { data: unitsForVacant }] = await Promise.all([
      propertiesQuery,
      unitsQuery,
      tenantsQuery,
      subscriptionsQuery,
      supabaseAdmin.from('units').select('id, unit_number, occupancy_status, rent_amount, property_id').eq('occupancy_status', 'vacant'),
    ]);

    const allTenants = tenantsData ?? [];
    const allUnits = unitsData ?? [];

    const occupiedUnits = (allUnits ?? []).filter((u: any) => u.occupancy_status === 'occupied').length;
    const vacantUnits = (allUnits ?? []).length - occupiedUnits;

    // Filter vacant units by organization if landlord
    let vacantUnitsFiltered = unitsForVacant ?? [];
    if (!isAgent && !isSuperAdmin && authContext.organizationId) {
      const { data: orgProps } = await supabaseAdmin.from('properties').select('id').eq('organization_id', authContext.organizationId);
      const propIds = (orgProps ?? []).map((p: any) => p.id);
      vacantUnitsFiltered = (unitsForVacant ?? []).filter((u: any) => propIds.includes(u.property_id));
    } else if (!isAgent && !isSuperAdmin && !authContext.organizationId) {
      vacantUnitsFiltered = [];
    }

    // Get all tenant IDs for this organization/property
    const allTenantIds = allTenants.map((t: any) => t.id);

    // Get ALL payments for these tenants (no balance filter at query level)
    const { data: allPayments } = allTenantIds.length > 0
      ? await supabaseAdmin.from('payments').select('tenant_id, amount, balance_remaining, created_at, transaction_type').in('tenant_id', allTenantIds)
      : { data: [] };

    // Filter out non-payment types and get only payments with positive balance
    const paymentsWithPositiveBalance = (allPayments ?? []).filter(
      (p: any) => !nonPaymentTypes.includes(p.transaction_type) && toNumber(p.balance_remaining) > 0
    );

    // Get unique tenant IDs that have owed amounts
    const tenantIdsOwed = [...new Set(paymentsWithPositiveBalance.map((p: any) => p.tenant_id))];

    // Fetch full tenant info with unit and property details
    const { data: tenantsOwedInfo } = tenantIdsOwed.length > 0
      ? await supabaseAdmin.from('tenants').select(`
          id, full_name, email,
          units!left(unit_number, rent_amount, properties(name))
        `).in('id', tenantIdsOwed)
      : { data: [] };

    // Build rent owed list - sum up balance per tenant
    const rentOwedList: any[] = [];
    paymentsWithPositiveBalance.forEach((p: any) => {
      const tenantId = p.tenant_id;
      const existing = rentOwedList.find((item) => item.id === tenantId);
      if (existing) {
        existing.balance_remaining = (toNumber(existing.balance_remaining) || 0) + toNumber(p.balance_remaining);
        existing.total_paid = (toNumber(existing.total_paid) || 0) + toNumber(p.amount);
      } else {
        rentOwedList.push({
          id: tenantId,
          balance_remaining: toNumber(p.balance_remaining),
          total_paid: toNumber(p.amount),
        });
      }
    });

    // Enrich with tenant details
    const rentOwedByTenant = rentOwedList.map((item: any) => {
      const tenantInfo = tenantsOwedInfo?.find((t: any) => t.id === item.id);
      const unitInfo = tenantInfo?.units?.[0];
      
      return {
        id: item.id,
        full_name: tenantInfo?.full_name ?? '',
        email: tenantInfo?.email ?? '',
        unit: unitInfo?.unit_number ?? null,
        property: unitInfo?.properties?.[0]?.name ?? null,
        total_paid: toNumber(item.total_paid),
        rent_amount: toNumber(unitInfo?.rent_amount ?? 0),
        balance_remaining: toNumber(item.balance_remaining),
        last_payment: null,
      };
    });

    // Get all payments for analytics (including those without balance)
    const { data: rentPaymentsData } = allTenantIds.length > 0
      ? await supabaseAdmin.from('payments').select('tenant_id, amount, due_amount, balance_remaining, created_at, transaction_type').in('tenant_id', allTenantIds)
      : { data: [] };

    const financialPayments = (rentPaymentsData ?? []).filter((p: any) => !nonPaymentTypes.includes(p.transaction_type));
    const totalPayments = financialPayments.reduce((sum: number, payment: any) => sum + toNumber(payment.amount), 0);
    const totalBalance = financialPayments.reduce((sum: number, payment: any) => sum + toNumber(payment.balance_remaining), 0);

    const paymentsByTenant = new Map<string, number>();
    financialPayments.forEach((payment: any) => {
      const tenantId = String(payment.tenant_id ?? '');
      if (!tenantId) return;
      const current = paymentsByTenant.get(tenantId) ?? 0;
      paymentsByTenant.set(tenantId, current + 1);
    });

    const tenantsWithAnalytics = allTenants.map((tenant: any) => {
      const firstPayment = financialPayments
        .filter((payment: any) => payment.tenant_id === tenant.id)
        .sort((a: any, b: any) => new Date(a.created_at ?? 0).getTime() - new Date(b.created_at ?? 0).getTime())[0];

      const startDate = firstPayment?.created_at ?? tenant.lease_start;
      const dueDate = startDate ? new Date(new Date(startDate).getTime() + 30 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10) : '';
      const paymentCount = paymentsByTenant.get(String(tenant.id)) ?? 0;

      return {
        id: tenant.id,
        payment_count: paymentCount,
        due_date: dueDate,
      };
    });

    const vacantUnitsList = vacantUnitsFiltered.map((u: any) => ({
      unit_number: u.unit_number,
      property_name: (propertiesData ?? []).find((p: any) => p.id === u.property_id)?.name ?? '—',
      rent_amount: u.rent_amount ?? 0,
    }));

    const propertyCount = effectivePropertyId ? 1 : (propertiesData?.length ?? 0);

    return NextResponse.json({
      properties: propertyCount,
      agents: 0,
      tenants: allTenants.length,
      total_payments: totalPayments,
      total_balance: totalBalance,
      occupiedUnits,
      vacantUnits,
      vacantUnitsList,
      rentOwedByTenant,
      subscribedLandlords: 0,
      totalLandlords: 0,
      totalPayments: rentPaymentsData?.length ?? 0,
      tenants_with_analytics: tenantsWithAnalytics,
    });
  } catch (error) {
    return NextResponse.json({
      properties: 0,
      agents: 0,
      tenants: 0,
      total_payments: 0,
      total_balance: 0,
      occupiedUnits: 0,
      vacantUnits: 0,
      subscribedLandlords: 0,
      totalLandlords: 0,
      totalPayments: 0,
      tenants_with_analytics: [],
      message: error instanceof Error ? error.message : 'Unable to load dashboard',
    });
  }
}