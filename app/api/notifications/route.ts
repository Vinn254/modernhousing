import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { badRequest, isMissingTableError, requestError } from '../../../lib/supabaseAdmin';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL ?? '';
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY ?? '';

if (!supabaseUrl || !serviceRoleKey) {
  throw new Error('Missing Supabase server environment variables');
}

const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey);

async function getFallbackNotifications(propertyId?: string, tenantId?: string) {
  let tenantIds: string[] | null = null;

  if (propertyId) {
    const { data: tenants, error: tenantsError } = await supabaseAdmin
      .from('tenants')
      .select('id, units(property_id)')
      .eq('units.property_id', propertyId);

    if (tenantsError) throw tenantsError;
    tenantIds = (tenants ?? []).map((tenant: any) => tenant.id);
  }

  if (tenantId) {
    tenantIds = tenantIds ? tenantIds.filter((id) => id === tenantId) : [tenantId];
  }

  const query = supabaseAdmin
    .from('payments')
    .select('*, tenants(full_name, email)')
    .eq('transaction_type', 'notification')
    .order('created_at', { ascending: false });

  if (tenantIds && tenantIds.length > 0) {
    query.in('tenant_id', tenantIds);
  }

  const { data, error } = await query;
  if (error) throw error;

  return (data ?? []).map((item: any) => ({
    ...item,
    tenant: item.tenants?.full_name ?? '',
    tenant_email: item.tenants?.email ?? '',
    message: item.description ?? '',
    status: item.transaction_type === 'notification' ? 'sent' : item.status,
  }));
}

export async function GET(request: NextRequest) {
  try {
    const propertyId = request.nextUrl.searchParams.get('propertyId');
    const query = supabaseAdmin
      .from('notifications')
      .select('*, tenants(full_name, email)')
      .order('created_at', { ascending: false });

    if (propertyId) {
      query.eq('property_id', propertyId);
    }

    const tenantId = request.nextUrl.searchParams.get('tenantId') ?? request.nextUrl.searchParams.get('tenant_id');
    const { data, error } = await query;
    if (error) {
      if (isMissingTableError(error, 'notifications')) {
        return NextResponse.json({ notifications: await getFallbackNotifications(propertyId || undefined, tenantId || undefined) });
      }
      throw error;
    }

    return NextResponse.json({ notifications: data ?? [] });
  } catch (error) {
    return requestError(error);
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const tenantId = String(body.tenantId ?? body.tenant_id ?? '').trim();
    const propertyId = String(body.propertyId ?? body.property_id ?? '').trim();
    const agentId = String(body.agentId ?? body.agent_id ?? '').trim() || null;
    const message = String(body.message ?? '').trim();

    if (!tenantId || !propertyId || !message) {
      return badRequest('Tenant, property, and message are required.');
    }

    const { data, error } = await supabaseAdmin
      .from('notifications')
      .insert({
        tenant_id: tenantId,
        property_id: propertyId,
        agent_id: agentId,
        type: 'overdue',
        message,
        status: 'sent',
      })
      .select('*, tenants(full_name, email)')
      .single();

    if (error) {
      if (isMissingTableError(error, 'notifications')) {
        const { data: fallbackData, error: fallbackError } = await supabaseAdmin
          .from('payments')
          .insert({
            tenant_id: tenantId,
            description: message,
            transaction_type: 'notification',
            amount: 0,
            balance_remaining: 0,
            paid_at: new Date().toISOString(),
          })
          .select('*, tenants(full_name, email)')
          .single();

        if (fallbackError) throw fallbackError;
        return NextResponse.json({ notification: fallbackData, message: 'Overdue notification sent.' }, { status: 201 });
      }
      throw error;
    }

    return NextResponse.json({ notification: data, message: 'Overdue notification sent.' }, { status: 201 });
  } catch (error: any) {
    return NextResponse.json({ message: error.message ?? 'Unable to send notification.' }, { status: 500 });
  }
}
