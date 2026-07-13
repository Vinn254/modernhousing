import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL ?? '';
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? '';
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY ?? '';

function getSupabaseAdmin() {
  if (!supabaseUrl || !serviceRoleKey) {
    throw new Error('Missing Supabase server environment variables');
  }
  return createClient(supabaseUrl, serviceRoleKey);
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
  const client = getSupabaseAdmin();
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

  if (!sessionUser) return { isSuperAdmin: false, sessionUser: null, userMetadata: {}, organizationId: null };

  const userMetadata = sessionUser.user_metadata || {};

  const { data: profile } = await client
    .from('profiles')
    .select('*')
    .eq('user_id', sessionUser.id)
    .single();

  let orgId = profile?.organization_id ?? userMetadata.organization_id ?? null;

  if (!orgId && sessionUser.email) {
    const { data: profileByEmail } = await client
      .from('profiles')
      .select('organization_id')
      .eq('email', sessionUser.email)
      .single();
    orgId = profileByEmail?.organization_id ?? null;
  }

  return {
    isSuperAdmin: userMetadata.role === 'super_admin',
    sessionUser,
    userMetadata,
    organizationId: orgId,
  };
}

export async function GET(request: NextRequest) {
  try {
    const client = getSupabaseAdmin();
    const authContext = await getAuthContext(request);
    const propertyId = request.nextUrl.searchParams.get('propertyId');
    const tenantEmail = request.nextUrl.searchParams.get('tenantEmail');
    const tenantId = request.nextUrl.searchParams.get('tenantId');

    let targetTenantId: string | null = null;
    if (tenantEmail) {
      const { data: tenant } = await client.from('tenants').select('id').eq('email', tenantEmail).single();
      targetTenantId = tenant?.id ?? null;
    } else if (tenantId) {
      targetTenantId = tenantId;
    }

    const userMetadata = authContext.userMetadata || {};
    const isSuperAdmin = userMetadata?.role === 'super_admin';
    const isAgent = userMetadata?.role === 'agent';
    const isLandlord = !isAgent && !isSuperAdmin;

    let query = client.from('invoices').select('*, tenants(full_name, email, units(unit_number, properties(name)))');

    if (isSuperAdmin) {
    } else if (isAgent && userMetadata?.property_id) {
      query = query.eq('property_id', userMetadata.property_id);
    } else if (isLandlord && authContext.organizationId) {
      const { data: orgProps } = await client.from('properties').select('id').eq('organization_id', authContext.organizationId);
      const propIds = (orgProps ?? []).map((p: any) => p.id);
      if (propIds.length > 0) {
        query = query.in('property_id', propIds);
      } else {
        return NextResponse.json({ invoices: [] });
      }
    } else if (propertyId) {
      query = query.eq('property_id', propertyId);
    } else if (targetTenantId) {
      query = query.eq('tenant_id', targetTenantId);
    }

    const { data: invoices, error } = await query.order('created_at', { ascending: false });

    if (error) throw error;

    const MONTH_ORDER: Record<string, number> = {
      january: 1, february: 2, march: 3, april: 4, may: 5, june: 6,
      july: 7, august: 8, september: 9, october: 10, november: 11, december: 12,
    };

    const sortedInvoices = (invoices ?? []).sort((a: any, b: any) => {
      const aOrder = MONTH_ORDER[(a.month_due || '').toLowerCase()] || 0;
      const bOrder = MONTH_ORDER[(b.month_due || '').toLowerCase()] || 0;
      return aOrder - bOrder || (a.month_due || '').localeCompare(b.month_due || '');
    });

    return NextResponse.json({ invoices: sortedInvoices });
  } catch (error: any) {
    return NextResponse.json({ message: error.message ?? 'Unable to fetch invoices.' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const client = getSupabaseAdmin();
    const body = await request.json();
    const { tenantId, propertyId, invoiceType, description, amount, dueDate, waterConsumption, monthDue } = body;

    if (!tenantId || !invoiceType || !amount) {
      return NextResponse.json({ message: 'Missing required invoice fields.' }, { status: 400 });
    }

    const authContext = await getAuthContext(request);
    const userMetadata = authContext.userMetadata || {};
    const isAgent = userMetadata?.role === 'agent';
    const agentPropertyId = isAgent ? userMetadata?.property_id : null;

    let resolvedPropertyId = propertyId;
    if (!resolvedPropertyId) {
      const { data: tenant } = await client
        .from('tenants')
        .select('units!inner(property_id)')
        .eq('id', tenantId)
        .single();

      resolvedPropertyId = tenant?.units?.[0]?.property_id;

      if (isAgent && agentPropertyId !== resolvedPropertyId) {
        return NextResponse.json({ message: 'You can only create invoices for your assigned property.' }, { status: 403 });
      }
    } else if (isAgent && agentPropertyId !== propertyId) {
      return NextResponse.json({ message: 'You can only create invoices for your assigned property.' }, { status: 403 });
    }

    const insertData: any = {
      tenant_id: tenantId,
      property_id: resolvedPropertyId,
      invoice_type: invoiceType,
      description,
      amount: Number(amount),
      due_date: dueDate,
      status: 'sent',
      created_at: new Date().toISOString(),
    };

    if (monthDue) insertData.month_due = monthDue;
    if (waterConsumption) insertData.water_consumption = waterConsumption;

    const result = await client.from('invoices').insert(insertData).select().single();

    if (result.error) {
      return NextResponse.json({ message: result.error.message }, { status: 500 });
    }

    return NextResponse.json({ message: 'Invoice created.', invoice: result.data }, { status: 201 });
  } catch (error: any) {
    return NextResponse.json({ message: error.message ?? 'Unable to create invoice.' }, { status: 500 });
  }
}