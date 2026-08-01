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

async function getUserFromCookie(request: NextRequest) {
  const cookie = request.headers.get('cookie') ?? '';
  if (!cookie) return null;
  const supabaseAuth = createClient(supabaseUrl, supabaseAnonKey, { global: { headers: { cookie } } });
  try {
    const { data: userData } = await supabaseAuth.auth.getUser();
    if (userData.user) return userData.user;
  } catch {
    // ignore
  }

  try {
    const { data: sessionData } = await supabaseAuth.auth.getSession();
    return sessionData.session?.user ?? null;
  } catch {
    return null;
  }
}

export async function GET(request: NextRequest) {
  const authorization = request.headers.get('authorization') ?? request.headers.get('Authorization');
  let sessionUser: any | null = null;

  if (authorization?.startsWith('Bearer ')) {
    const token = authorization.split(' ')[1];
    const decoded = decodeJWT(token);
    if (decoded?.sub) {
      sessionUser = { id: decoded.sub, email: decoded.email, user_metadata: decoded.user_metadata || {} };
    }
  }

  if (!sessionUser) {
    const user = await getUserFromCookie(request);
    if (user) sessionUser = user;
  }

  if (!sessionUser) {
    return NextResponse.json({ message: 'Not authenticated' }, { status: 401 });
  }

  const userMetadata = sessionUser.user_metadata || {};
  const { data: profile } = await supabaseAdmin
    .from('profiles')
    .select('organization_id, role, email')
    .eq('user_id', sessionUser.id)
    .maybeSingle();

  const orgId = profile?.organization_id ?? userMetadata.organization_id ?? null;
  const role = profile?.role ?? userMetadata.role ?? null;

  return NextResponse.json({
    userId: sessionUser.id,
    email: sessionUser.email,
    role,
    organizationId: orgId,
    tenantId: userMetadata.tenant_id ?? null,
    userMetadata,
    profile,
  });
}
