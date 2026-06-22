import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { adminRequest, badRequest, isMissingTableError, requestError } from '../../../lib/supabaseAdmin';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL ?? '';
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY ?? '';

if (!supabaseUrl || !serviceRoleKey) {
  throw new Error('Missing Supabase server environment variables');
}

const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey);

async function ensureNotificationTable() {
  const { error } = await supabaseAdmin.from('notifications').select('id').limit(1);

  if (!error) {
    await Promise.all([
      adminRequest('/rest/v1/notifications', { method: 'PATCH', body: JSON.stringify({ tenant_id: null, property_id: null }) }).catch(() => undefined),
      adminRequest('/rest/v1/notifications', { method: 'PATCH', body: JSON.stringify({ recipient: 'tenant' }) }).catch(() => undefined),
      adminRequest('/rest/v1/notifications', { method: 'PATCH', body: JSON.stringify({ admin_id: null, admin_name: null, admin_email: null }) }).catch(() => undefined),
    ]);
    return;
  }

  if (!isMissingTableError(error, 'notifications')) throw error;

  await adminRequest('/rest/v1/notifications', {
    method: 'POST',
    body: JSON.stringify({
      tenant_id: null,
      property_id: null,
      agent_id: null,
      recipient: 'tenant',
      admin_id: null,
      admin_name: null,
      admin_email: null,
      type: 'overdue',
      message: 'Notification table initialized.',
      status: 'sent',
    }),
  });
}

async function getFallbackLandlordNotifications() {
  const { data, error } = await supabaseAdmin
    .from('payments')
    .select('*')
    .eq('transaction_type', 'landlord_notification')
    .order('created_at', { ascending: false });

  if (error) throw error;

  return (data ?? []).map((item: any) => ({
    ...item,
    recipient: 'landlord',
    admin_id: item.admin_id ?? null,
    admin_name: item.admin_name ?? null,
    admin_email: item.admin_email ?? null,
    message: item.description ?? '',
    status: item.transaction_type === 'landlord_notification' ? 'sent' : item.status,
  }));
}

async function insertFallbackLandlordNotification(body: {
  adminId: string;
  adminName: string;
  adminEmail: string;
  type: string;
  message: string;
}) {
  const { data, error } = await supabaseAdmin
    .from('payments')
    .insert({
      tenant_id: null,
      description: body.message,
      transaction_type: 'landlord_notification',
      amount: 0,
      balance_remaining: 0,
      paid_at: new Date().toISOString(),
    })
    .select('*')
    .single();

  if (error) throw error;

  return {
    ...data,
    recipient: 'project_manager',
    admin_id: body.adminId,
    admin_name: body.adminName,
    admin_email: body.adminEmail,
    type: body.type,
    message: body.message,
    status: 'sent',
  };
}

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
    recipient: 'tenant',
    tenant: item.tenants?.full_name ?? '',
    tenant_email: item.tenants?.email ?? '',
    message: item.description ?? '',
    status: item.transaction_type === 'notification' ? 'sent' : item.status,
  }));
}

export async function GET(request: NextRequest) {
  try {
    const recipient = request.nextUrl.searchParams.get('recipient');
    const propertyId = request.nextUrl.searchParams.get('propertyId');
    const query = supabaseAdmin
      .from('notifications')
      .select('*')
      .order('created_at', { ascending: false });

if (recipient === 'landlord' || recipient === 'project_manager') {
       query.eq('recipient', recipient);
     } else if (recipient === 'tenant') {
       query.eq('recipient', 'tenant');
     }

    if (propertyId) {
      query.eq('property_id', propertyId);
    }

    const tenantId = request.nextUrl.searchParams.get('tenantId') ?? request.nextUrl.searchParams.get('tenant_id');
    const { data, error } = await query;
    if (error) {
      if (recipient === 'landlord' || recipient === 'project_manager') {
        return NextResponse.json({ notifications: await getFallbackLandlordNotifications() });
      }
      if (isMissingTableError(error, 'notifications')) {
        return NextResponse.json({ notifications: await getFallbackNotifications(propertyId || undefined, tenantId || undefined) });
      }
      throw error;
    }

    return NextResponse.json({ notifications: data ?? [] });
  } catch (error) {
    const requestUrl = request.nextUrl.toString();
    if (requestUrl.includes('recipient=landlord') || requestUrl.includes('recipient=project_manager')) {
      try {
        return NextResponse.json({ notifications: await getFallbackLandlordNotifications() });
      } catch {
        return requestError(error);
      }
    }
    return requestError(error);
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const tenantId = String(body.tenantId ?? body.tenant_id ?? '').trim();
    const propertyId = String(body.propertyId ?? body.property_id ?? '').trim();
    const agentId = String(body.agentId ?? body.agent_id ?? '').trim() || null;
    const adminId = String(body.adminId ?? body.admin_id ?? '').trim() || null;
    const adminName = String(body.adminName ?? body.admin_name ?? '').trim();
    const adminEmail = String(body.adminEmail ?? body.admin_email ?? '').trim();
    const recipient = String(body.recipient ?? '').trim() || (tenantId || propertyId ? 'tenant' : 'project_manager');
    const type = String(body.type ?? 'overdue').trim();
    const message = String(body.message ?? '').trim();

    if (!message) {
      return badRequest('Notification message is required.');
    }

    if (recipient === 'landlord' || recipient === 'project_manager') {
      if (!adminId || !adminName || !adminEmail) {
        return badRequest('Landlord ID, name, and email are required for notifications.');
      }

      await ensureNotificationTable();

      const { data, error } = await supabaseAdmin
        .from('notifications')
        .insert({
          tenant_id: null,
          property_id: null,
          agent_id: null,
          recipient: 'project_manager',
          admin_id: adminId,
          admin_name: adminName,
          admin_email: adminEmail,
          type,
          message,
          status: 'sent',
        })
        .select('*')
        .single();

      if (error) {
        const fallbackNotification = await insertFallbackLandlordNotification({ adminId, adminName, adminEmail, type, message });
        return NextResponse.json({ notification: fallbackNotification, message: 'Notification saved.' }, { status: 201 });
      }

      return NextResponse.json({ notification: data, message: 'Notification sent.' }, { status: 201 });
    }

    if (!tenantId || !propertyId) {
      return badRequest('Tenant and property are required for tenant notifications.');
    }

    const { data, error } = await supabaseAdmin
      .from('notifications')
      .insert({
        tenant_id: tenantId,
        property_id: propertyId,
        agent_id: agentId,
        recipient: 'tenant',
        type,
        message,
        status: 'sent',
      })
      .select('*')
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
        return NextResponse.json({ notification: fallbackData, message: 'Tenant notification sent.' }, { status: 201 });
      }
      throw error;
    }

    return NextResponse.json({ notification: data, message: 'Tenant notification sent.' }, { status: 201 });
  } catch (error: any) {
    return NextResponse.json({ message: error.message ?? 'Unable to send notification.' }, { status: 500 });
  }
}
