import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL ?? '';
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY ?? '';

if (!supabaseUrl || !serviceRoleKey) {
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
      sessionUser = { id: decoded.sub, email: decoded.email };
    }
  }

  if (!sessionUser && cookie) {
    try {
      const supabaseAnon = createClient(supabaseUrl, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? '', {
        global: { headers: { cookie } },
      });
      const { data: { user } } = await supabaseAnon.auth.getUser();
      sessionUser = user;
    } catch (e) {}
  }

  return { userId: sessionUser?.id ?? null, userEmail: sessionUser?.email ?? null };
}

export async function GET(request: NextRequest) {
  const authContext = await getAuthContext(request);

  if (!authContext.userId) {
    return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });
  }

  const { data: profile } = await supabaseAdmin
    .from('profiles')
    .select('role')
    .eq('user_id', authContext.userId)
    .single();

  if (profile?.role !== 'super_admin') {
    return NextResponse.json({ message: 'Forbidden - Super admin only' }, { status: 403 });
  }

  const resourceType = request.nextUrl.searchParams.get('resourceType');
  const action = request.nextUrl.searchParams.get('action');
  const limit = parseInt(request.nextUrl.searchParams.get('limit') ?? '100');

  let query: any = supabaseAdmin.from('audit_logs').select('*').order('created_at', { ascending: false }).limit(limit);

  if (resourceType) query = query.eq('resource_type', resourceType);
  if (action) query = query.eq('action', action);

  const { data, error } = await query;

  if (error) {
    return NextResponse.json({ message: error.message }, { status: 500 });
  }

  return NextResponse.json({ auditLogs: data ?? [] });
}

export async function POST(request: NextRequest) {
  const body = await request.json();
  const { action, resourceType, resourceId, details } = body;

  if (!action || !resourceType) {
    return NextResponse.json({ message: 'Action and resource type are required' }, { status: 400 });
  }

  const authContext = await getAuthContext(request);
  const ipAddress = request.headers.get('x-forwarded-for') ?? request.headers.get('x-real-ip') ?? '';

  const { data, error } = await supabaseAdmin.from('audit_logs').insert({
    user_id: authContext.userId,
    user_email: authContext.userEmail,
    action,
    resource_type: resourceType,
    resource_id: resourceId ?? null,
    details: details ?? null,
    ip_address: ipAddress,
    user_agent: request.headers.get('user-agent') ?? '',
  }).select().single();

  if (error) {
    return NextResponse.json({ message: error.message }, { status: 500 });
  }

  return NextResponse.json({ auditLog: data }, { status: 201 });
}