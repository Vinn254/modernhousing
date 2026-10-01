import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey);

async function getAuthContext(request: NextRequest) {
  const cookie = request.headers.get('cookie') ?? '';
  const authorization = request.headers.get('authorization') ?? request.headers.get('Authorization');

  let sessionUser: any = null;

  if (authorization?.startsWith('Bearer ')) {
    const token = authorization.split(' ')[1];
    const { data, error } = await supabaseAdmin.auth.getUser(token);
    if (!error) {
      sessionUser = data.user;
    }
  }

  if (!sessionUser && cookie) {
    try {
      const supabaseAuth = createClient(supabaseUrl, supabaseAnonKey, { global: { headers: { cookie } } });
      const { data: { user } } = await supabaseAuth.auth.getUser();
      sessionUser = user;
    } catch (e) {}
  }

  if (!sessionUser && cookie) {
    try {
      const supabaseAuth = createClient(supabaseUrl, supabaseAnonKey, { global: { headers: { cookie } } });
      const { data: { session } } = await supabaseAuth.auth.getSession();
      if (session?.user) sessionUser = session.user;
    } catch (e) {}
  }

  if (!sessionUser) return { isSuperAdmin: false, isLandlord: false, sessionUser: null, userMetadata: {}, organizationId: null };

  const userMetadata = sessionUser.user_metadata || {};

  const { data: profile } = await supabaseAdmin
    .from('profiles')
    .select('organization_id, role')
    .eq('user_id', sessionUser.id)
    .maybeSingle();

  let orgId = profile?.organization_id ?? userMetadata.organization_id ?? null;

  if (!orgId && sessionUser.email) {
    const { data: profileByEmail } = await supabaseAdmin
      .from('profiles')
      .select('organization_id')
      .eq('email', sessionUser.email)
      .maybeSingle();
    orgId = profileByEmail?.organization_id ?? null;
  }

if (!orgId && userMetadata.role === 'tenant' && userMetadata.tenant_id) {
    const { data: tenantData } = await supabaseAdmin
      .from('tenants')
      .select('unit_id')
      .eq('id', userMetadata.tenant_id)
      .maybeSingle();
    
    if (tenantData?.unit_id) {
      const { data: unitData } = await supabaseAdmin
        .from('units')
        .select('property_id')
        .eq('id', tenantData.unit_id)
        .maybeSingle();
      
      if (unitData?.property_id) {
        const { data: propData } = await supabaseAdmin
          .from('properties')
          .select('organization_id')
          .eq('id', unitData.property_id)
          .maybeSingle();
        orgId = propData?.organization_id ?? null;
      }
    }
  }

  if (!orgId && userMetadata.role === 'project_manager' && sessionUser?.id) {
    const { data: propData } = await supabaseAdmin
      .from('properties')
      .select('organization_id')
      .eq('created_by', sessionUser.id)
      .maybeSingle();
    orgId = propData?.organization_id ?? null;
  }

  return {
    isSuperAdmin: userMetadata.role === 'super_admin' || profile?.role === 'super_admin',
    isLandlord: userMetadata.role === 'project_manager' || profile?.role === 'project_manager',
    sessionUser,
    userMetadata,
    organizationId: orgId,
    userId: sessionUser?.id ?? null,
  };
}

async function getTenantOrganizationId(tenantId: string): Promise<string | null> {
  const { data: tenantData } = await supabaseAdmin
    .from('tenants')
    .select('unit_id')
    .eq('id', tenantId)
    .maybeSingle();
  
  if (!tenantData?.unit_id) return null;
  
  const { data: unitData } = await supabaseAdmin
    .from('units')
    .select('property_id')
    .eq('id', tenantData.unit_id)
    .maybeSingle();
  
  if (!unitData?.property_id) return null;
  
  const { data: propData } = await supabaseAdmin
    .from('properties')
    .select('organization_id')
    .eq('id', unitData.property_id)
    .maybeSingle();
  
  return propData?.organization_id ?? null;
}

export async function GET(request: NextRequest) {
  try {
    const tenantId = request.nextUrl.searchParams.get('tenantId');
    let orgId: string | null = null;
    let tenantShortCode: string | null = null;

    if (tenantId) {
      orgId = await getTenantOrganizationId(tenantId);
      
      // Get the tenant's unit short code (used as the payment account number)
      const { data: tenantData } = await supabaseAdmin
        .from('tenants')
        .select('unit_id')
        .eq('id', tenantId)
        .maybeSingle();
      
      if (tenantData?.unit_id) {
        const { data: unitData } = await supabaseAdmin
          .from('units')
          .select('short_code')
          .eq('id', tenantData.unit_id)
          .maybeSingle();
        
        tenantShortCode = unitData?.short_code ?? null;
      }
    } else {
      const authContext = await getAuthContext(request);
      orgId = authContext.organizationId;
      if (!orgId && authContext.isLandlord && authContext.userId) {
        const { data: propData } = await supabaseAdmin
          .from('properties')
          .select('organization_id')
          .eq('created_by', authContext.userId)
          .maybeSingle();
        orgId = propData?.organization_id ?? null;
      }
    }

    if (!orgId) {
      return NextResponse.json({
        paybill: '',
        tenantShortCode: tenantShortCode ?? '',
      });
    }

    const { data: settings } = await supabaseAdmin
      .from('payment_settings')
      .select('paybill')
      .eq('organization_id', orgId)
      .maybeSingle();

    return NextResponse.json({
      paybill: settings?.paybill ?? '',
      tenantShortCode: tenantShortCode ?? '',
    });
  } catch (error: any) {
    return NextResponse.json({
      paybill: '',
      tenantShortCode: '',
    });
  }
}

export async function POST(request: NextRequest) {
  try {
    const authContext = await getAuthContext(request);
    
    let orgId = authContext.organizationId;
    if (!orgId && authContext.isLandlord && authContext.userId) {
      const { data: propData } = await supabaseAdmin
        .from('properties')
        .select('organization_id')
        .eq('created_by', authContext.userId)
        .maybeSingle();
      orgId = propData?.organization_id ?? null;
    }
    
    if (!authContext.isSuperAdmin && !authContext.isLandlord) {
      return NextResponse.json({ message: 'Only project managers can update payment settings.' }, { status: 403 });
    }

    if (!orgId) {
      return NextResponse.json({ message: 'Unable to verify organization access.' }, { status: 403 });
    }

    const { paybill } = await request.json();
    if (typeof paybill !== 'string' || !paybill.trim()) {
      return NextResponse.json({ message: 'A Co-operative Bank Paybill number is required.' }, { status: 400 });
    }

    const { data: existing } = await supabaseAdmin
      .from('payment_settings')
      .select('id')
      .eq('organization_id', orgId ?? '')
      .limit(1)
      .maybeSingle();

    const data = {
      organization_id: orgId ?? '',
      paybill: paybill.trim(),
      updated_at: new Date().toISOString(),
    };

    if (existing) {
      const result = await supabaseAdmin
        .from('payment_settings')
        .update(data)
        .eq('id', existing.id)
        .select()
        .maybeSingle();
      if (result.error) throw result.error;
    } else {
      const result = await supabaseAdmin
        .from('payment_settings')
        .insert({ ...data, created_at: new Date().toISOString() })
        .select()
        .maybeSingle();
      if (result.error) throw result.error;
    }

    return NextResponse.json({ message: 'Payment settings saved.' });
  } catch (error: any) {
    return NextResponse.json({ message: error.message ?? 'Unable to save payment settings.' }, { status: 500 });
  }
}