import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { logAuditEvent } from '../../../lib/auditLogger';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL ?? '';
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY ?? '';
const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey);

async function getAuthContext(request: NextRequest) {
  const authorization = request.headers.get('authorization') ?? request.headers.get('Authorization');
  let sessionUser: any = null;

  if (authorization?.startsWith('Bearer ')) {
    const token = authorization.split(' ')[1];
    try {
      const payload = JSON.parse(Buffer.from(token.split('.')[1], 'base64').toString());
      sessionUser = { id: payload.sub, email: payload.email, user_metadata: payload.user_metadata || {} };
    } catch {
      // ignore invalid token
    }
  }

  return {
    isSuperAdmin: sessionUser?.user_metadata?.role === 'super_admin',
    userId: sessionUser?.id ?? null,
    userEmail: sessionUser?.email ?? null,
  };
}

export async function GET(request: NextRequest) {
  try {
    const authContext = await getAuthContext(request);
    const url = new URL(request.url);
    const search = url.searchParams.get('search')?.toLowerCase() ?? '';
    const status = url.searchParams.get('status') ?? '';

    let query = supabaseAdmin
      .from('split_payments')
      .select('*', { count: 'exact' })
      .order('created_at', { ascending: false });

    if (!authContext.isSuperAdmin && authContext.userId) {
      query = query.eq('landlord_id', authContext.userId);
    }

    if (search) {
      query = query.or(`transaction_code.ilike.%${search}%,pesaflow_transaction_id.ilike.%${search}%`);
    }

    if (status) {
      query = query.eq('status', status);
    }

    const { data: splits, error, count } = await query;

    if (error) {
      return NextResponse.json({ message: error.message }, { status: 500 });
    }

    if (authContext.isSuperAdmin && splits && splits.length > 0) {
      const landlordIds = [...new Set(splits.map((s: any) => s.landlord_id).filter(Boolean))];
      const tenantIds = [...new Set(splits.map((s: any) => s.tenant_id).filter(Boolean))];

      const [landlordsResult, tenantsResult] = await Promise.all([
        supabaseAdmin.from('profiles').select('user_id, full_name, email, organization_name').in('user_id', landlordIds),
        supabaseAdmin.from('tenants').select('id, full_name, email').in('id', tenantIds),
      ]);

      const landlordMap = new Map((landlordsResult.data ?? []).map((l: any) => [l.user_id, l]));
      const tenantMap = new Map((tenantsResult.data ?? []).map((t: any) => [t.id, t]));

      const enriched = splits.map((split: any) => ({
        ...split,
        landlord: landlordMap.get(split.landlord_id) || null,
        tenant: tenantMap.get(split.tenant_id) || null,
      }));

      return NextResponse.json({ splits: enriched, total: count ?? 0 });
    }

    return NextResponse.json({ splits: splits ?? [], total: count ?? 0 });
  } catch (error: any) {
    return NextResponse.json({ message: error?.message || 'Internal server error' }, { status: 500 });
  }
}
