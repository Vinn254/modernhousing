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

    const [properties, tenants, payments, users] = await Promise.all([
      supabaseAdmin.from('properties').select('id'),
      supabaseAdmin.from('tenants').select('id, lease_start, deposit_amount, unit_id'),
      supabaseAdmin.from('payments').select('id, tenant_id, amount, balance_remaining, created_at'),
      getAllAdminUsers(),
    ]);

    if (properties.error) throw properties.error;
    if (tenants.error) throw tenants.error;
    if (payments.error) throw payments.error;

    const allTenants = tenants.data ?? [];
    const tenantList = allTenants;

    const propertyTenantIds = new Set<string>();
    if (propertyId) {
      const { data: units, error: unitsError } = await supabaseAdmin.from('units').select('id, property_id').eq('property_id', propertyId);
      if (unitsError) throw unitsError;
      const unitIds = new Set((units ?? []).map((unit: any) => unit.id));
      allTenants.forEach((tenant: any) => {
        if (unitIds.has(tenant.unit_id)) propertyTenantIds.add(tenant.id);
      });
    }

    const filteredTenantList = propertyId ? allTenants.filter((tenant: any) => propertyTenantIds.has(tenant.id)) : allTenants;
    const filteredTenantIdSet = new Set(filteredTenantList.map((tenant: any) => tenant.id));
    const paymentList = propertyId ? (payments.data ?? []).filter((payment: any) => filteredTenantIdSet.has(payment.tenant_id)) : (payments.data ?? []);
    const financialPayments = paymentList.filter((payment: any) => !nonPaymentTypes.includes(payment.transaction_type));
    const agents = users.filter((user: any) => user.user_metadata?.role === 'agent' && (!propertyId || user.user_metadata?.property_id === propertyId));

    const propertyCount = propertyId ? 1 : (properties.data?.length ?? 0);
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
    return requestError(error);
  }
}
