import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL ?? '';
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY ?? '';

if (!supabaseUrl || !serviceRoleKey) {
  throw new Error('Missing Supabase server environment variables');
}

const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey);

async function getAuthContext(request: NextRequest) {
  const cookie = request.headers.get('cookie') ?? '';
  const authorization = request.headers.get('authorization') ?? request.headers.get('Authorization');

  const headers: Record<string, string> = {};
  if (cookie) headers.cookie = cookie;
  if (authorization) headers.Authorization = authorization;

  const supabaseAuth = createClient(supabaseUrl, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? '', {
    global: { headers },
  });

  let sessionUser: any = null;
  const { data: sessionData } = await supabaseAuth.auth.getSession();
  sessionUser = sessionData?.session?.user;

  if (!sessionUser && authorization?.startsWith('Bearer ')) {
    try {
      const token = authorization.split(' ')[1];
      const { data: { user } } = await supabaseAuth.auth.getUser(token);
      sessionUser = user;
    } catch (e) {}
  }

  if (!sessionUser) {
    return { isSuperAdmin: false, userId: undefined };
  }

  return {
    isSuperAdmin: sessionUser.user_metadata?.role === 'super_admin',
    userId: sessionUser.id,
  };
}

export async function GET(request: NextRequest) {
   try {
      const authContext = await getAuthContext(request);

      const userId = authContext.userId;
      if (!authContext.isSuperAdmin && !userId) {
        return NextResponse.json({ payments: [] });
      }

      // Get properties for this PM
      const { data: orgProps } = await supabaseAdmin
        .from('properties')
        .select('id')
        .eq('user_id', userId ?? '');
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
          tenant: payment.tenants?.full_name ?? payment.tenant ?? '',
          tenant_email: payment.tenants?.email ?? '',
          property: '',
          unit: '',
        }));
        return NextResponse.json({ payments });
      }
      return NextResponse.json({ payments: [] });
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