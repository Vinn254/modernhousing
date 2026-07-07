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

    let propertiesQuery: any = supabaseAdmin.from('properties').select('id');
    let unitsQuery: any = supabaseAdmin.from('units').select('id, occupancy_status, property_id');
    let tenantsQuery: any = supabaseAdmin.from('tenants').select('id, lease_start, deposit_amount, unit_id');
    let paymentsQuery: any = supabaseAdmin.from('payments').select('id, tenant_id, amount, balance_remaining, created_at');
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
          paymentsQuery = paymentsQuery.in('tenant_id', (await supabaseAdmin.from('tenants').select('id').in('unit_id', unitIds)).data?.map((t: any) => t.id) ?? []);
        }
      } else {
        // No properties in org
        return NextResponse.json({
          properties: 0, agents: 0, tenants: 0, total_payments: 0, total_balance: 0,
          occupiedUnits: 0, vacantUnits: 0, subscribedLandlords: 0, totalLandlords: 0, totalPayments: 0, tenants_with_analytics: [],
        });
      }
    } else if (effectivePropertyId) {
      propertiesQuery = propertiesQuery.eq('id', effectivePropertyId);
      unitsQuery = unitsQuery.eq('property_id', effectivePropertyId);
      const { data: unitsInProp } = await supabaseAdmin.from('units').select('id').eq('property_id', effectivePropertyId);
      const unitIds = (unitsInProp ?? []).map((u: any) => u.id);
      if (unitIds.length > 0) {
        tenantsQuery = tenantsQuery.in('unit_id', unitIds);
        paymentsQuery = paymentsQuery.in('tenant_id', (await supabaseAdmin.from('tenants').select('id').in('unit_id', unitIds)).data?.map((t: any) => t.id) ?? []);
      }
    }

    const [{ data: propertiesData }, { data: unitsData }, { data: tenantsData }, { data: paymentsData }, { data: subscriptionsData }] = await Promise.all([
      propertiesQuery,
      unitsQuery,
      tenantsQuery,
      paymentsQuery,
      subscriptionsQuery,
    ]);

    const allTenants = tenantsData ?? [];
    const allUnits = unitsData ?? [];

    const occupiedUnits = (allUnits ?? []).filter((u: any) => u.occupancy_status === 'occupied').length;
    const vacantUnits = (allUnits ?? []).length - occupiedUnits;

    const propertyCount = effectivePropertyId ? 1 : (propertiesData?.length ?? 0);
    const financialPayments = (paymentsData ?? []).filter((p: any) => !nonPaymentTypes.includes(p.transaction_type));
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

    return NextResponse.json({
      properties: propertyCount,
      agents: 0,
      tenants: allTenants.length,
      total_payments: totalPayments,
      total_balance: totalBalance,
      occupiedUnits,
      vacantUnits,
      subscribedLandlords: 0,
      totalLandlords: 0,
      totalPayments: paymentsData?.length ?? 0,
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