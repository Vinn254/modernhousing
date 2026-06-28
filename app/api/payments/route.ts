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