import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL ?? '';
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY ?? '';

if (!supabaseUrl || !serviceRoleKey) {
  throw new Error('Missing Supabase server environment variables');
}

const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey);

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
    return { isSuperAdmin: false, organization_id: null };
  }

  const { data: profile } = await supabaseAdmin
    .from('profiles')
    .select('id, user_id, organization_id, role, full_name, email')
    .eq('user_id', sessionData.session.user.id)
    .single();

  return {
    isSuperAdmin: profile?.role === 'super_admin',
    organization_id: profile?.organization_id ?? null,
  };
}

export async function GET(request: NextRequest) {
  try {
    const authContext = await getAuthContext(request);
    const propertyId = request.nextUrl.searchParams.get('propertyId');

    if (!authContext.isSuperAdmin && !authContext.organization_id) {
      return NextResponse.json({ payments: [] });
    }

    let query: any = supabaseAdmin.from('payments').select('*, tenants!inner(full_name, email, units!inner(property_id, properties!inner(organization_id)))');

    if (!authContext.isSuperAdmin && authContext.organization_id) {
      query = query.eq('tenants.units.properties.organization_id', authContext.organization_id);
    } else if (propertyId) {
      query = query.eq('tenants.units.property_id', propertyId);
    }

    const { data, error } = await query.order('created_at', { ascending: false });

    if (error) {
      const { data: fallbackData } = await supabaseAdmin
        .from('payments')
        .select('*')
        .order('created_at', { ascending: false });
      const payments = (fallbackData ?? []).map((payment: any) => ({
        ...payment,
        tenant: payment.tenant ?? '',
        tenant_email: payment.tenant_email ?? '',
        property: '',
        unit: '',
      }));
      return NextResponse.json({ payments });
    }

    const payments = (data ?? []).map((payment: any) => ({
      ...payment,
      tenant: payment.tenants?.full_name ?? payment.tenant ?? '',
      tenant_email: payment.tenants?.email ?? '',
      property: payment.tenants?.units?.properties?.name ?? '',
      unit: payment.tenants?.units?.unit_number ?? '',
    }));

    return NextResponse.json({ payments });
  } catch (error: any) {
    return NextResponse.json({ payments: [], message: error.message ?? 'Unable to load payments.' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
    const body = await request.json();
    const { tenantId, description, transactionType, amount, balanceRemaining, propertyId } = body;

    if (!tenantId || !description || !transactionType || amount == null || balanceRemaining == null) {
      return NextResponse.json({ message: 'Missing required payment fields.' }, { status: 400 });
    }

    const result = await supabaseAdmin.from('payments').insert({
      tenant_id: tenantId,
      property_id: propertyId ?? null,
      description,
      transaction_type: transactionType,
      amount,
      balance_remaining: balanceRemaining,
      paid_at: new Date().toISOString(),
    });

    if (result.error) {
      return NextResponse.json({ message: result.error.message }, { status: 500 });
    }

    return NextResponse.json({ message: 'Payment recorded.' }, { status: 201 });
  }