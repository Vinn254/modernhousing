import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

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

  if (!sessionUser) return { isSuperAdmin: false, isLandlord: false, sessionUser: null, userMetadata: {}, organizationId: null };

  const userMetadata = sessionUser.user_metadata || {};

  const { data: profile } = await supabaseAdmin
    .from('profiles')
    .select('organization_id, role')
    .eq('user_id', sessionUser.id)
    .single();

  let orgId = profile?.organization_id ?? userMetadata.organization_id ?? null;

  if (!orgId && sessionUser.email) {
    const { data: profileByEmail } = await supabaseAdmin
      .from('profiles')
      .select('organization_id')
      .eq('email', sessionUser.email)
      .single();
    orgId = profileByEmail?.organization_id ?? null;
  }

  if (!orgId && userMetadata.role === 'tenant' && userMetadata.tenant_id) {
    const { data: tenantData } = await supabaseAdmin
      .from('tenants')
      .select('units!inner(properties!inner(organization_id))')
      .eq('id', userMetadata.tenant_id)
      .single();
    orgId = (tenantData as any)?.units?.properties?.organization_id ?? null;
  }

  return {
    isSuperAdmin: userMetadata.role === 'super_admin' || profile?.role === 'super_admin',
    isLandlord: userMetadata.role === 'project_manager' || profile?.role === 'project_manager',
    sessionUser,
    userMetadata,
    organizationId: orgId,
  };
}

async function getTenantOrganizationId(tenantId: string): Promise<string | null> {
  const { data: tenantData } = await supabaseAdmin
    .from('tenants')
    .select('units!inner(properties!inner(organization_id))')
    .eq('id', tenantId)
    .single();
  return (tenantData as any)?.units?.properties?.organization_id ?? null;
}

export async function GET(request: NextRequest) {
  try {
    const tenantId = request.nextUrl.searchParams.get('tenantId');
    let orgId: string | null = null;

    if (tenantId) {
      orgId = await getTenantOrganizationId(tenantId);
    } else {
      const authContext = await getAuthContext(request);
      orgId = authContext.organizationId;
    }

    if (!orgId) {
      return NextResponse.json({
        paybill: '', paybillAccount: '', till: '', pochi: '', mobile: '',
        consumerKey: '', consumerSecret: '', passkey: '',
      });
    }

    const { data: settings } = await supabaseAdmin
      .from('payment_settings')
      .select('paybill, paybill_account, till, pochi, mobile, consumer_key, consumer_secret, passkey')
      .eq('organization_id', orgId)
      .maybeSingle();

    return NextResponse.json({
      paybill: settings?.paybill ?? '',
      paybillAccount: settings?.paybill_account ?? '',
      till: settings?.till ?? '',
      pochi: settings?.pochi ?? '',
      mobile: settings?.mobile ?? '',
      consumerKey: settings?.consumer_key ?? '',
      consumerSecret: settings?.consumer_secret ?? '',
      passkey: settings?.passkey ?? '',
    });
  } catch (error: any) {
    return NextResponse.json({
      paybill: '', paybillAccount: '', till: '', pochi: '', mobile: '',
      consumerKey: '', consumerSecret: '', passkey: '',
    });
  }
}

export async function POST(request: NextRequest) {
  try {
    const authContext = await getAuthContext(request);
    
    if (!authContext.isSuperAdmin && !authContext.organizationId) {
      return NextResponse.json({ message: 'Unable to verify organization access.' }, { status: 403 });
    }

    const body = await request.json();
    const { paybill, paybillAccount, till, pochi, mobile, consumerKey, consumerSecret, passkey } = body;

    const { data: existing } = await supabaseAdmin
      .from('payment_settings')
      .select('id')
      .eq('organization_id', authContext.organizationId ?? '')
      .limit(1)
      .single();

    const data = {
      organization_id: authContext.organizationId ?? '',
      paybill: paybill ?? '',
      paybill_account: paybillAccount ?? '',
      till: till ?? '',
      pochi: pochi ?? '',
      mobile: mobile ?? '',
      consumer_key: consumerKey ?? '',
      consumer_secret: consumerSecret ?? '',
      passkey: passkey ?? '',
      updated_at: new Date().toISOString(),
    };

    if (existing) {
      const result = await supabaseAdmin
        .from('payment_settings')
        .update(data)
        .eq('id', existing.id)
        .select()
        .single();
      if (result.error) throw result.error;
    } else {
      const result = await supabaseAdmin
        .from('payment_settings')
        .insert({ ...data, created_at: new Date().toISOString() })
        .select()
        .single();
      if (result.error) throw result.error;
    }

    return NextResponse.json({ message: 'Payment settings saved.' });
  } catch (error: any) {
    return NextResponse.json({ message: error.message ?? 'Unable to save payment settings.' }, { status: 500 });
  }
}