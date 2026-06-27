import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { adminRequest, badRequest, isMissingTableError, requestError } from '../../../lib/supabaseAdmin';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL ?? '';
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY ?? '';

if (!supabaseUrl || !serviceRoleKey) {
  throw new Error('Missing Supabase server environment variables');
}

const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey);

async function getUserContext(request: NextRequest) {
  const headers: Record<string, string> = {
    cookie: request.headers.get('cookie') ?? '',
  };
  const authorization = request.headers.get('authorization') ?? request.headers.get('Authorization');
  if (authorization) headers.Authorization = authorization;

  const supabaseAuth = createClient(supabaseUrl, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? '', {
    global: { headers },
  });

  const { data: sessionData } = await supabaseAuth.auth.getSession();
  return { userId: sessionData.session?.user?.id ?? null };
}

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

async function getFallbackLandlordNotifications(adminEmail?: string) {
  let query: any = supabaseAdmin
    .from('payments')
    .select('*')
    .eq('transaction_type', 'landlord_notification')
    .order('created_at', { ascending: false });

  if (adminEmail) {
    query = query.eq('admin_email', adminEmail);
  }

  const { data, error } = await query;
  if (error) throw error;

  return (data ?? []).map((item: any) => ({
    ...item,
    recipient: 'project_manager',
    admin_id: item.admin_id ?? null,
    admin_name: item.admin_name ?? null,
    admin_email: item.admin_email ?? null,
    message: item.description ?? '',
    status: item.status,
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

async function getFallbackNotifications(propertyId?: string, tenantId?: string, adminEmail?: string) {
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

  let query = supabaseAdmin
    .from('payments')
    .select('*, tenants(full_name, email)')
    .eq('transaction_type', 'notification')
    .order('created_at', { ascending: false });

  if (tenantIds && tenantIds.length > 0) {
    query = query.in('tenant_id', tenantIds);
  }

  if (adminEmail) {
    query = query.eq('admin_email', adminEmail);
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
    const userContext = await getUserContext(request);
    const recipient = request.nextUrl.searchParams.get('recipient');
    const propertyId = request.nextUrl.searchParams.get('propertyId');
    const adminEmail = request.nextUrl.searchParams.get('adminEmail');

    let query: any = supabaseAdmin
      .from('notifications')
      .select('*')
      .order('created_at', { ascending: false });

    if (recipient === 'landlord' || recipient === 'project_manager') {
      query = query.eq('recipient', 'project_manager');
    } else if (recipient === 'tenant') {
      query = query.eq('recipient', 'tenant');
    }

    if (propertyId) {
      query = query.eq('property_id', propertyId);
    }

    if (adminEmail) {
      query = query.eq('admin_email', adminEmail);
    } else if (userContext.userId && (recipient === 'landlord' || recipient === 'project_manager')) {
      const { data: userProps } = await supabaseAdmin
        .from('properties')
        .select('id')
        .eq('created_by', userContext.userId);
      const propIds = (userProps ?? []).map((p: any) => p.id);
      if (propIds.length > 0) {
        query = query.in('property_id', propIds);
      }
    }

    const tenantId = request.nextUrl.searchParams.get('tenantId') ?? request.nextUrl.searchParams.get('tenant_id');
    const { data, error } = await query;
    if (error) {
      if (recipient === 'landlord' || recipient === 'project_manager') {
        return NextResponse.json({ notifications: await getFallbackLandlordNotifications(adminEmail ?? undefined) });
      }
      if (isMissingTableError(error, 'notifications')) {
        return NextResponse.json({ notifications: await getFallbackNotifications(propertyId || undefined, tenantId || undefined, adminEmail ?? undefined) });
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
    const userContext = await getUserContext(request);

    let tenantId = String(body.tenantId ?? body.tenant_id ?? '').trim();
    const propertyId = String(body.propertyId ?? body.property_id ?? '').trim();
    const agentId = String(body.agentId ?? body.agent_id ?? '').trim() || null;
    let adminId = String(body.adminId ?? body.admin_id ?? '').trim() || userContext.userId;
    let adminName = String(body.adminName ?? body.admin_name ?? '').trim();
    let adminEmail = String(body.adminEmail ?? body.admin_email ?? '').trim();
    const recipient = String(body.recipient ?? '').trim() || (tenantId || propertyId ? 'tenant' : 'project_manager');
    const type = String(body.type ?? 'overdue').trim();
    const message = String(body.message ?? '').trim();

    if (!message) {
      return badRequest('Notification message is required.');
    }

    if (recipient === 'landlord' || recipient === 'project_manager') {
      if (!adminId || !adminName || !adminEmail) {
        const { data: profile } = await supabaseAdmin
          .from('profiles')
          .select('full_name, email')
          .eq('user_id', userContext.userId)
          .single();
        if (!adminId) adminId = userContext.userId ?? '';
        if (!adminName) adminName = profile?.full_name ?? 'Landlord';
        if (!adminEmail) adminEmail = profile?.email ?? '';
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

    const { data: property } = await supabaseAdmin.from('properties').select('organization_id').eq('id', propertyId).single();
    const orgId = property?.organization_id;

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
        admin_email: adminEmail || '',
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
            admin_email: adminEmail || '',
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