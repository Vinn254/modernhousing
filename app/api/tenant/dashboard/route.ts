import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { getAllAdminUsers, isMissingTableError, requestError } from '../../../../lib/supabaseAdmin';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL ?? '';
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY ?? '';

if (!supabaseUrl || !serviceRoleKey) {
  throw new Error('Missing Supabase server environment variables');
}

const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey);
const dayMs = 24 * 60 * 60 * 1000;
const nonPaymentTypes = ['complaint', 'notification'];

async function getTenantPayments(tenantId: string) {
  const { data, error } = await supabaseAdmin
    .from('payments')
    .select('*')
    .eq('tenant_id', tenantId)
    .order('created_at', { ascending: false });

  if (error) throw error;
  return (data ?? []).filter((payment: any) => !nonPaymentTypes.includes(payment.transaction_type));
}

async function getTenantNotifications(tenantId: string) {
  const { data, error } = await supabaseAdmin
    .from('notifications')
    .select('*')
    .eq('tenant_id', tenantId)
    .order('created_at', { ascending: false });

  if (!error) return data ?? [];

  if (!isMissingTableError(error, 'notifications')) throw error;

  const { data: fallbackData, error: fallbackError } = await supabaseAdmin
    .from('payments')
    .select('*')
    .eq('tenant_id', tenantId)
    .eq('transaction_type', 'notification')
    .order('created_at', { ascending: false });

  if (fallbackError) throw fallbackError;
  return (fallbackData ?? []).map((item: any) => ({
    ...item,
    message: item.description ?? '',
    status: 'sent',
  }));
}

async function getTenantComments(tenantId: string) {
  const { data, error } = await supabaseAdmin
    .from('comments')
    .select('*')
    .eq('tenant_id', tenantId)
    .order('created_at', { ascending: false });

  if (!error) return data ?? [];

  if (!isMissingTableError(error, 'comments')) throw error;

  const { data: fallbackData, error: fallbackError } = await supabaseAdmin
    .from('payments')
    .select('*')
    .eq('tenant_id', tenantId)
    .eq('transaction_type', 'complaint')
    .order('created_at', { ascending: false });

  if (fallbackError) throw fallbackError;
  return (fallbackData ?? []).map((item: any) => ({
    ...item,
    message: item.description ?? '',
    status: 'open',
  }));
}

function findTenantByEmail(tenants: any[], email: string) {
  const normalized = email.trim().toLowerCase();
  return tenants.find((tenant) => tenant.email?.trim().toLowerCase() === normalized) ?? null;
}

export async function GET(request: NextRequest) {
  try {
    const email = request.nextUrl.searchParams.get('email');
    const userId = request.nextUrl.searchParams.get('userId');
    if (!email && !userId) return NextResponse.json({ message: 'Tenant email or account is required.' }, { status: 400 });

    const { data: allTenants, error: tenantError } = await supabaseAdmin
      .from('tenants')
      .select('*, units(property_id, unit_number, properties(name, address))')
      .order('created_at', { ascending: false });

    if (tenantError) throw tenantError;

    let tenants = allTenants ?? [];
    let tenant = email ? findTenantByEmail(tenants, email) : null;

    if (!tenant && userId) {
      const users = await getAllAdminUsers();
      const user = users.find((item: any) => item.id === userId);
      const tenantId = user?.user_metadata?.tenant_id;
      const authEmail = user?.email;

      if (tenantId) {
        tenant = tenants.find((item) => item.id === tenantId) ?? null;
      }

      if (!tenant && authEmail) {
        tenant = findTenantByEmail(tenants, authEmail);
      }
    }

    if (!tenant) {
      return NextResponse.json({
        tenant: null,
        payments: [],
        notifications: [],
        comments: [],
        searched_email: email ?? '',
      });
    }

    const property = tenant.units?.properties;

    const [payments, notifications, comments] = await Promise.all([
      getTenantPayments(tenant.id),
      getTenantNotifications(tenant.id),
      getTenantComments(tenant.id),
    ]);

    const firstPayment = [...payments]
      .sort((a, b) => new Date(a.created_at ?? 0).getTime() - new Date(b.created_at ?? 0).getTime())[0];

    const nextPaymentDate = firstPayment?.created_at
      ? new Date(new Date(firstPayment.created_at).getTime() + 30 * dayMs).toISOString().slice(0, 10)
      : tenant.lease_start
        ? new Date(new Date(tenant.lease_start).getTime() + 30 * dayMs).toISOString().slice(0, 10)
        : '';

    return NextResponse.json({
      tenant: {
        ...tenant,
        property_id: tenant.units?.property_id ?? '',
        property_name: property?.name ?? '',
        property_address: property?.address ?? '',
        unit_number: tenant.units?.unit_number ?? '',
        next_payment_date: nextPaymentDate,
      },
      payments: payments ?? [],
      notifications: notifications ?? [],
      comments: comments ?? [],
    });
  } catch (error) {
    return requestError(error);
  }
}
