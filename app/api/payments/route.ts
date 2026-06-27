import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

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
    const userContext = await getUserContext(request);

    if (userContext.userId) {
      const { data: userProps } = await supabaseAdmin
        .from('properties')
        .select('id')
        .eq('created_by', userContext.userId);
      const propIds = (userProps ?? []).map((p: any) => p.id);

      if (propIds.length > 0) {
        const { data, error } = await supabaseAdmin
          .from('payments')
          .select('*, tenants(full_name, email, units(property_id))')
          .in('tenants.units.property_id', propIds)
          .order('created_at', { ascending: false });

        if (error) throw error;
        const payments = (data ?? []).map((payment: any) => ({
          ...payment,
          tenant: payment.tenants?.full_name ?? payment.tenant ?? '',
          tenant_email: payment.tenants?.email ?? '',
          property: '',
          unit: '',
        }));
        return NextResponse.json({ payments });
      }
      return NextResponse.json({ payments: [] });
    }

    let query: any = supabaseAdmin.from('payments').select('*, tenants(full_name, email, units(property_id, properties(name)))');

    const { data, error } = await query.order('created_at', { ascending: false });

    if (error) throw error;

    const payments = (data ?? []).map((payment: any) => ({
      ...payment,
      tenant: payment.tenants?.full_name ?? payment.tenant ?? '',
      tenant_email: payment.tenants?.email ?? '',
      property: payment.tenants?.units?.properties?.name ?? '',
      unit: '',
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