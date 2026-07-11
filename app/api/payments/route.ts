import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL ?? '';
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? '';
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY ?? '';

if (!supabaseUrl || !supabaseAnonKey || !serviceRoleKey) {
  throw new Error('Missing Supabase server environment variables');
}

const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey);

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
      const supabaseAuth = createClient(supabaseUrl, supabaseAnonKey, { global: { headers: { cookie } } });
      const { data: { user } } = await supabaseAuth.auth.getUser();
      sessionUser = user;
    } catch (e) {}
  }

  if (!sessionUser) {
    return { isSuperAdmin: false, userId: undefined, organizationId: null };
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
  };
}

export async function GET(request: NextRequest) {
  try {
    const authContext = await getAuthContext(request);
    const propertyId = request.nextUrl.searchParams.get('propertyId');
    const tenantEmail = request.nextUrl.searchParams.get('email');

    // If tenantEmail provided, look up tenant ID
    let effectiveTenantId = null;
    if (tenantEmail && !propertyId) {
      const { data: tenantData } = await supabaseAdmin
        .from('tenants')
        .select('id')
        .eq('email', tenantEmail)
        .single();
      effectiveTenantId = tenantData?.id ?? null;
    }

    if (effectiveTenantId) {
      const { data, error } = await supabaseAdmin
        .from('payments')
        .select('*, tenants(full_name, email, units(property_id))')
        .eq('tenant_id', effectiveTenantId)
        .order('created_at', { ascending: false });

      if (error) throw error;
      const payments = (data ?? []).map((payment: any) => ({
        ...payment,
        tenant: payment.tenants?.full_name ?? '',
        tenant_email: payment.tenants?.email ?? '',
      }));
      return NextResponse.json({ payments });
    }

    // If propertyId is passed, filter by it (for agent dashboard)
    if (propertyId) {
      const { data: units } = await supabaseAdmin.from('units').select('id').eq('property_id', propertyId);
      const unitIds = (units ?? []).map((u: any) => u.id);
      
      if (unitIds.length > 0) {
        const { data: tenants } = await supabaseAdmin.from('tenants').select('id').in('unit_id', unitIds);
        const tenantIds = (tenants ?? []).map((t: any) => t.id);
        
        const { data, error } = await supabaseAdmin
          .from('payments')
          .select('*, tenants(full_name, email, units(property_id))')
          .in('tenant_id', tenantIds)
          .order('created_at', { ascending: false });

        if (error) throw error;
        const payments = (data ?? []).map((payment: any) => ({
          ...payment,
          tenant: payment.tenants?.full_name ?? '',
          tenant_email: payment.tenants?.email ?? '',
        }));
        return NextResponse.json({ payments });
      }
      return NextResponse.json({ payments: [] });
    }

    if (!authContext.isSuperAdmin && !authContext.organizationId) {
      return NextResponse.json({ payments: [] });
    }

    const { data: orgProps } = await supabaseAdmin
      .from('properties')
      .select('id')
      .eq('organization_id', authContext.organizationId ?? '');
    const propIds = (orgProps ?? []).map((p: any) => p.id);

    if (propIds.length > 0) {
      const { data: orgTenants } = await supabaseAdmin
        .from('tenants')
        .select('id')
        .in('unit_id', (await supabaseAdmin.from('units').select('id').in('property_id', propIds)).data?.map(u => u.id) ?? []);
      const tenantIds = (orgTenants ?? []).map((t: any) => t.id);

      const { data, error } = await supabaseAdmin
        .from('payments')
        .select('*, tenants(full_name, email, units(property_id))')
        .in('tenant_id', tenantIds)
        .order('created_at', { ascending: false });

      if (error) throw error;
      const payments = (data ?? []).map((payment: any) => ({
        ...payment,
        tenant: payment.tenants?.full_name ?? '',
        tenant_email: payment.tenants?.email ?? '',
      }));
      return NextResponse.json({ payments });
    }
    return NextResponse.json({ payments: [] });
  } catch (error: any) {
    return NextResponse.json({ payments: [], message: error.message ?? 'Unable to load payments.' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  const authContext = await getAuthContext(request);
  
  if (!authContext.userId) {
    return NextResponse.json({ message: 'Authentication required.' }, { status: 401 });
  }

  const body = await request.json();
  const {
    tenantId,
    description,
    transactionType,
    amount,
    balanceRemaining,
    monthDue,
    dueAmount,
    paidAmount,
    transNumber,
    transCode,
    paymentDate
  } = body;

  // Validate transaction type - only allow rent, overdue, deposit
  const validTypes = ['rent', 'overdue', 'deposit'];
  if (transactionType && !validTypes.includes(transactionType)) {
    return NextResponse.json({ message: 'Invalid transaction type. Only rent, overdue, and deposit are allowed.' }, { status: 400 });
  }

  if (!tenantId || !paidAmount) {
    return NextResponse.json({ message: 'Missing required payment fields.' }, { status: 400 });
  }

  const insertData: any = {
    tenant_id: tenantId,
    description: description ?? `${transactionType || 'Rent'} payment`,
    transaction_type: transactionType || 'rent',
    amount: Number(amount || paidAmount) || 0,
    balance_remaining: Number(balanceRemaining) || 0,
    transaction_number: transNumber ?? `PAY-${Date.now().toString().slice(-6)}`,
    paid_at: paymentDate || new Date().toISOString(),
    month_due: monthDue ?? null,
    due_amount: Number(dueAmount) || null,
    transaction_code: transCode ?? null,
  };

  const result = await supabaseAdmin.from('payments').insert(insertData);

  if (result.error) {
    return NextResponse.json({ message: result.error.message }, { status: 500 });
  }

  const { data: tenant } = await supabaseAdmin
    .from('tenants')
    .select('email, full_name')
    .eq('id', tenantId)
    .single();

  if (tenant?.email) {
    await supabaseAdmin.from('notifications').insert({
      recipient: 'tenant',
      tenant_id: tenantId,
      type: 'rent_payment',
      message: `Rent payment of KSH ${paidAmount} recorded.`,
      status: 'sent',
      created_at: new Date().toISOString(),
    }).select();
  }

  return NextResponse.json({ message: 'Payment recorded.', payment: result.data?.[0] }, { status: 201 });
}

export async function DELETE(request: NextRequest) {
  const authContext = await getAuthContext(request);

  if (!authContext.userId) {
    return NextResponse.json({ message: 'Authentication required.' }, { status: 401 });
  }

  const body = await request.json();
  const { id } = body;

  if (!id) {
    return NextResponse.json({ message: 'Payment ID is required.' }, { status: 400 });
  }

  const result = await supabaseAdmin.from('payments')
    .delete()
    .eq('id', id)
    .select();

  if (result.error) {
    return NextResponse.json({ message: result.error.message }, { status: 500 });
  }

  if (!result.data || result.data.length === 0) {
    return NextResponse.json({ message: 'Payment not found or could not be deleted.' }, { status: 404 });
  }

  return NextResponse.json({ message: 'Payment deleted.' });
}

export async function PUT(request: NextRequest) {
  const authContext = await getAuthContext(request);

  if (!authContext.userId) {
    return NextResponse.json({ message: 'Authentication required.' }, { status: 401 });
  }

  const body = await request.json();
  const {
    id,
    tenantId,
    description,
    transactionType,
    amount,
    balanceRemaining,
    monthDue,
    dueAmount,
    paidAmount,
    transNumber,
    transCode,
    paymentDate
  } = body;

  if (!id) {
    return NextResponse.json({ message: 'Payment ID is required.' }, { status: 400 });
  }

  // Validate transaction type - only allow rent, overdue, deposit
  const validTypes = ['rent', 'overdue', 'deposit'];
  if (transactionType && !validTypes.includes(transactionType)) {
    return NextResponse.json({ message: 'Invalid transaction type. Only rent, overdue, and deposit are allowed.' }, { status: 400 });
  }

  const updateData: any = {
    tenant_id: tenantId || undefined,
    description: description ?? undefined,
    transaction_type: transactionType || 'rent',
    amount: Number(amount || paidAmount) || 0,
    balance_remaining: Number(balanceRemaining) || 0,
    transaction_number: transNumber ?? undefined,
    paid_at: paymentDate || new Date().toISOString(),
    month_due: monthDue ?? null,
    due_amount: Number(dueAmount) || null,
    transaction_code: transCode ?? null,
  };

  const result = await supabaseAdmin.from('payments')
    .update(updateData)
    .eq('id', id)
    .select();

  if (result.error) {
    return NextResponse.json({ message: result.error.message }, { status: 500 });
  }

  return NextResponse.json({ message: 'Payment updated.', payment: result.data?.[0] });
}