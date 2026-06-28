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
  const headers: Record<string, string> = {
    cookie: request.headers.get('cookie') ?? '',
  };
  const authorization = request.headers.get('authorization') ?? request.headers.get('Authorization');
  if (authorization) headers.Authorization = authorization;

  const supabaseAuth = createClient(supabaseUrl, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? '', {
    global: { headers },
  });

  const { data: sessionData, error: sessionError } = await supabaseAuth.auth.getSession();

  if (sessionError || !sessionData.session) {
    return { isSuperAdmin: false, organization_id: null, profile: null };
  }

let { data: profile } = await supabaseAdmin
    .from('profiles')
    .select('id, user_id, organization_id, role, full_name, email')
    .eq('user_id', sessionData.session.user.id)
    .single();

  // Fallback: query by email if user_id lookup fails
  if (!profile && sessionData.session.user.email) {
    const { data: profileByEmail } = await supabaseAdmin
      .from('profiles')
      .select('id, user_id, organization_id, role, full_name, email')
      .eq('email', sessionData.session.user.email)
      .single();
    profile = profileByEmail;
  }

  let orgId = profile?.organization_id ?? sessionData.session.user?.user_metadata?.organization_id ?? null;

   if (!orgId) {
     const role = profile?.role ?? sessionData.session.user.user_metadata?.role;
     if (role === 'project_manager') {
       const { data: newOrg } = await supabaseAdmin
         .from('organizations')
         .insert({ name: `${sessionData.session.user.email?.split('@')[0] ?? 'Property Manager'} Organization` })
         .select('id')
         .single();
       orgId = newOrg?.id ?? null;

       if (orgId) {
         if (profile) {
           await supabaseAdmin
             .from('profiles')
             .update({ organization_id: orgId })
             .eq('id', profile.id);
         } else {
           const fullName = sessionData.session.user.user_metadata?.full_name ?? sessionData.session.user.email ?? 'User';
           await supabaseAdmin
             .from('profiles')
             .insert({
               user_id: sessionData.session.user.id,
               full_name: fullName,
               email: sessionData.session.user.email,
               role: 'project_manager',
               organization_id: orgId,
               status: 'active',
             });
         }

         await supabaseAdmin
           .from('properties')
           .update({ organization_id: orgId })
           .eq('organization_id', null);
       }
     }
   }

  return {
    isSuperAdmin: profile?.role === 'super_admin',
    organization_id: orgId,
    profile: orgId ? { ...profile, organization_id: orgId } : profile,
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
      if (authContext.organization_id) {
        propertiesQuery = propertiesQuery.eq('organization_id', authContext.organization_id);
        const orgProps = await propertiesQuery;
        const propIds = (orgProps.data ?? []).map((p: any) => p.id);

        if (propIds.length > 0) {
          const { data: orgUnits } = await supabaseAdmin.from('units').select('id').in('property_id', propIds);
          const unitIds = (orgUnits ?? []).map((u: any) => u.id);
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

    let users: any[];
    try {
      users = await getAllAdminUsers();
    } catch {
      users = [];
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
    const tenantList = allTenants;

    const propertyTenantIds = new Set<string>();
    if (propertyId && !authContext.isSuperAdmin && authContext.organization_id) {
      try {
        const { data: units } = await supabaseAdmin.from('units').select('id').eq('property_id', propertyId);
        const unitIds = new Set((units ?? []).map((unit: any) => unit.id));
        allTenants.forEach((tenant: any) => {
          if (unitIds.has(tenant.unit_id)) propertyTenantIds.add(tenant.id);
        });
      } catch {
        // continue without property-specific filtering
      }
    } else if (propertyId && authContext.isSuperAdmin) {
      try {
        const { data: units } = await supabaseAdmin.from('units').select('id, property_id').eq('property_id', propertyId);
        const unitIds = new Set((units ?? []).map((unit: any) => unit.id));
        allTenants.forEach((tenant: any) => {
          if (unitIds.has(tenant.unit_id)) propertyTenantIds.add(tenant.id);
        });
      } catch {
        // continue
      }
    }

    const filteredTenantList = propertyId ? allTenants.filter((tenant: any) => propertyTenantIds.has(tenant.id)) : allTenants;
    const filteredTenantIdSet = new Set(filteredTenantList.map((tenant: any) => tenant.id));
    const paymentList = propertyId ? (paymentsData ?? []).filter((payment: any) => filteredTenantIdSet.has(payment.tenant_id)) : (paymentsData ?? []);
    const financialPayments = paymentList.filter((payment: any) => !nonPaymentTypes.includes(payment.transaction_type));

    let agentList = users.filter((user: any) => user.user_metadata?.role === 'agent');
    if (!authContext.isSuperAdmin && authContext.organization_id) {
      const { data: orgPropsForAgents } = await supabaseAdmin
        .from('properties')
        .select('id')
        .eq('organization_id', authContext.organization_id);
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
