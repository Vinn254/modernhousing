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

export async function GET(request: NextRequest) {
  try {
    const propertyId = request.nextUrl.searchParams.get('propertyId');

    let propertiesResult: any;
    let tenantsResult: any;
    let paymentsResult: any;
    let users: any[];

    try {
      propertiesResult = await supabaseAdmin.from('properties').select('id');
    } catch {
      propertiesResult = { data: [], error: null };
    }

    try {
      tenantsResult = await supabaseAdmin.from('tenants').select('id, lease_start, deposit_amount, unit_id');
    } catch {
      tenantsResult = { data: [], error: null };
    }

    try {
      paymentsResult = await supabaseAdmin.from('payments').select('id, tenant_id, amount, balance_remaining, created_at');
    } catch {
      paymentsResult = { data: [], error: null };
    }

    try {
      users = await getAllAdminUsers();
    } catch {
      users = [];
    }

    if (propertiesResult.error) throw propertiesResult.error;
    if (tenantsResult.error) throw tenantsResult.error;
    if (paymentsResult.error) throw paymentsResult.error;

    const allTenants = tenantsResult.data ?? [];
    const tenantList = allTenants;

    const propertyTenantIds = new Set<string>();
    if (propertyId) {
      try {
        const { data: units } = await supabaseAdmin.from('units').select('id, property_id').eq('property_id', propertyId);
        const unitIds = new Set((units ?? []).map((unit: any) => unit.id));
        allTenants.forEach((tenant: any) => {
          if (unitIds.has(tenant.unit_id)) propertyTenantIds.add(tenant.id);
        });
      } catch {
        // continue without property-specific filtering
      }
    }

    const filteredTenantList = propertyId ? allTenants.filter((tenant: any) => propertyTenantIds.has(tenant.id)) : allTenants;
    const filteredTenantIdSet = new Set(filteredTenantList.map((tenant: any) => tenant.id));
    const paymentList = propertyId ? (paymentsResult.data ?? []).filter((payment: any) => filteredTenantIdSet.has(payment.tenant_id)) : (paymentsResult.data ?? []);
    const financialPayments = paymentList.filter((payment: any) => !nonPaymentTypes.includes(payment.transaction_type));
    const agents = users.filter((user: any) => user.user_metadata?.role === 'agent' && (!propertyId || user.user_metadata?.property_id === propertyId));

    const propertyCount = propertyId ? 1 : (propertiesResult.data?.length ?? 0);
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
      agents: agents.length,
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
