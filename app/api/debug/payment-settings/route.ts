import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL ?? '';
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? '';
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY ?? '';

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

async function getAuthOrg(request: NextRequest) {
  const authorization = request.headers.get('authorization') ?? request.headers.get('Authorization');

  let orgId: string | null = null;

  if (authorization?.startsWith('Bearer ')) {
    const token = authorization.split(' ')[1];
    const decoded = decodeJWT(token);
    const userId = decoded?.sub;
    const userMetadata = decoded?.user_metadata || {};

    // try profile lookup
    if (userId) {
      const { data: profile } = await supabaseAdmin
        .from('profiles')
        .select('organization_id, role')
        .eq('user_id', userId)
        .maybeSingle();
      orgId = profile?.organization_id ?? userMetadata.organization_id ?? null;
    } else {
      orgId = userMetadata.organization_id ?? null;
    }
  }

  return orgId;
}

export async function GET(request: NextRequest) {
  try {
    const orgId = await getAuthOrg(request);
    if (!orgId) return NextResponse.json({ message: 'organization not found' }, { status: 403 });

    const { data: settings, error } = await supabaseAdmin
      .from('payment_settings')
      .select('*')
      .eq('organization_id', orgId)
      .maybeSingle();

    if (error) {
      return NextResponse.json({ message: 'error fetching settings', error: error.message }, { status: 500 });
    }

    return NextResponse.json({ settings: settings ?? null });
  } catch (err: any) {
    return NextResponse.json({ message: err?.message ?? 'unknown error' }, { status: 500 });
  }
}
