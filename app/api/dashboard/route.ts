import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { getAllAdminUsers, requestError } from '../../../lib/supabaseAdmin';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL ?? '';
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

async function getAuthContext(request: NextRequest) {
  const cookie = request.headers.get('cookie') ?? '';
  const authorization = request.headers.get('authorization') ?? request.headers.get('Authorization');

  const headers: Record<string, string> = {};
  if (cookie) headers.cookie = cookie;
  if (authorization) headers.Authorization = authorization;

  const supabaseAuth = createClient(supabaseUrl, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? '', {
    global: { headers },
  });

  let sessionUser: any = null;
  const { data: sessionData } = await supabaseAuth.auth.getSession();
  sessionUser = sessionData?.session?.user;

  if (!sessionUser && authorization?.startsWith('Bearer ')) {
    try {
      const token = authorization.split(' ')[1];
      const { data: { user } } = await supabaseAuth.auth.getUser(token);
      sessionUser = user;
    } catch (e) {}
  }

  if (!sessionUser) {
    return { isSuperAdmin: false, userId: undefined };
  }

  return {
    isSuperAdmin: sessionUser.user_metadata?.role === 'super_admin',
    userId: sessionUser.id,
  };
}

export async function GET(request: NextRequest) {
  try {
    const authContext = await getAuthContext(request);
    const propertyId = request.nextUrl.searchParams.get('propertyId');

    let propertiesQuery: any = supabaseAdmin.from('properties').select('id');
    let tenantsQuery: any = supabaseAdmin.from('tenants').select('id, lease_start, deposit_amount, unit_id');
    let paymentsQuery: any = supabaseAdmin.from('payments').select('id, tenant_id, amount, balance_remaining, created_at');

    if (!authContext.isSuperAdmin) {
      if (authContext.userId) {
        propertiesQuery = propertiesQuery.eq('user_id', authContext.userId);
        const orgProps = await propertiesQuery;
        const propIds = (orgProps.data ?? []).map((p: any) => p.id);

        if (propIds.length === 0) {
          return NextResponse.json({
            properties: 0,
            agents: 0,
            tenants: 0,
            total_payments: 0,
            total_balance: 0,
            tenants_with_analytics: [],
          });
        }

        const unitIds = (await supabaseAdmin.from('units').select('id').in('property_id', propIds)).data?.map((u: any) => u.id) ?? [];
        if (unitIds.length > 0) {
          tenantsQuery = tenantsQuery.in('unit_id', unitIds);
          paymentsQuery = paymentsQuery.in('tenant_id', (await supabaseAdmin.from('tenants').select('id').in('unit_id', unitIds)).data?.map((t: any) => t.id) ?? []);
        } else {
          return NextResponse.json({
            properties: 0,
            agents: 0,
            tenants: 0,
            total_payments: 0,
            total_balance: 0,
            tenants_with_analytics: [],
          });
        }
      } else {
        return NextResponse.json({
          properties: 0,
          agents: 0,
          tenants: 0,
          total_payments: 0,
          total_balance: 0,
          tenants_with_analytics: [],
        });
      }
    }

    const [{ data: propertiesData, error: propertiesError }, { data: tenantsData, error: tenantsError }, { data: paymentsData, error: paymentsError }] = await Promise.all([
      propertiesQuery,
      tenantsQuery,
      paymentsQuery,
    ]);

    if (propertiesError) throw propertiesError;
    if (tenantsError) throw tenantsError;
    if (paymentsError) throw paymentsError;

    const allTenants = tenantsData ?? [];

    const propertyTenantIds = new Set<string>();
    if (propertyId && !authContext.isSuperAdmin && authContext.userId) {
      try {
        const { data: units } = await supabaseAdmin.from('units').select('id').eq('property_id', propertyId);
        const unitIds = new Set((units ?? []).map((unit: any) => unit.id));
        allTenants.forEach((tenant: any) => {
          if (unitIds.has(tenant.unit_id)) propertyTenantIds.add(tenant.id);
        });
      } catch {}
    } else if (propertyId && authContext.isSuperAdmin) {
      try {
        const { data: units } = await supabaseAdmin.from('units').select('id, property_id').eq('property_id', propertyId);
        const unitIds = new Set((units ?? []).map((unit: any) => unit.id));
        allTenants.forEach((tenant: any) => {
          if (unitIds.has(tenant.unit_id)) propertyTenantIds.add(tenant.id);
        });
      } catch {}
    }

    const filteredTenantList = propertyId ? allTenants.filter((tenant: any) => propertyTenantIds.has(tenant.id)) : allTenants;
    const filteredTenantIdSet = new Set(filteredTenantList.map((tenant: any) => tenant.id));
    const paymentList = propertyId ? (paymentsData ?? []).filter((payment: any) => filteredTenantIdSet.has(payment.tenant_id)) : (paymentsData ?? []);
    const financialPayments = paymentList.filter((payment: any) => !nonPaymentTypes.includes(payment.transaction_type));

    let agentList = (await getAllAdminUsers().catch(() => []))?.filter((user: any) => user.user_metadata?.role === 'agent') ?? [];
    if (!authContext.isSuperAdmin && authContext.userId) {
      const { data: orgPropsForAgents } = await supabaseAdmin
        .from('properties')
        .select('id')
        .eq('user_id', authContext.userId);
      const validAgentPropIds = new Set((orgPropsForAgents ?? []).map((p: any) => p.id));
      agentList = agentList.filter((user) => {
        if (propertyId) return user.user_metadata?.property_id === propertyId;
        return user.user_metadata?.property_id && validAgentPropIds.has(user.user_metadata?.property_id);
      });
    } else if (propertyId && authContext.isSuperAdmin) {
      agentList = agentList.filter((user) => user.user_metadata?.property_id === propertyId);
    }

    const propertyCount = propertyId ? 1 : (propertiesData?.length ?? 0);
    const totalPayments = financialPayments.reduce((sum: number, payment: any) => sum + toNumber(payment.amount), 0);
    const totalBalance = financialPayments.reduce((sum: number, payment: any) => sum + toNumber(payment.balance_remaining), 0);

    const paymentsByTenant = new Map<string, number>();
    financialPayments.forEach((payment: any) => {
      const tenantId = String(payment.tenant_id ?? '');
      if (!tenantId) return;
      const current = paymentsByTenant.get(tenantId) ?? 0;
      paymentsByTenant.set(tenantId, current + 1);
    });

    const tenantsWithAnalytics = filteredTenantList.map((tenant: any) => {
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
      agents: agentList.length,
      tenants: filteredTenantList.length,
      total_payments: totalPayments,
      total_balance: totalBalance,
      tenants_with_analytics: tenantsWithAnalytics,
    });
  } catch (error) {
    return NextResponse.json({
      properties: 0,
      agents: 0,
      tenants: 0,
      total_payments: 0,
      total_balance: 0,
      tenants_with_analytics: [],
      message: error instanceof Error ? error.message : 'Unable to load dashboard',
    });
  }
}