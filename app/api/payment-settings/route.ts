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
    const authContext = await getAuthContext(request);
    if (!authContext.sessionUser) {
      return NextResponse.json({ message: 'Authentication required.' }, { status: 401 });
    }

    const tenantId = request.nextUrl.searchParams.get('tenantId');
    let orgId: string | null = null;
    let tenantShortCode: string | null = null;

    if (tenantId) {
      if (!authContext.isSuperAdmin && authContext.userMetadata.tenant_id !== tenantId) {
        return NextResponse.json({ message: 'Forbidden.' }, { status: 403 });
      }
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
      if (!authContext.isSuperAdmin && !authContext.isLandlord) {
        return NextResponse.json({ message: 'Forbidden.' }, { status: 403 });
      }
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

    const settingsFields = tenantId
      ? 'paybill, sbm_account_number, sbm_enabled'
      : 'paybill, coop_connection_id, coop_connection_password, coop_service_name, coop_institution_code, coop_institution_name, coop_enabled, sbm_account_number, sbm_ipn_username, sbm_ipn_password, sbm_secret_key, sbm_enabled';
    const { data: settings } = await supabaseAdmin
      .from('payment_settings')
      .select(settingsFields)
      .eq('organization_id', orgId)
      .maybeSingle();

    return NextResponse.json({
      paybill: settings?.paybill ?? '',
      sbmAccountNumber: settings?.sbm_enabled ? settings?.sbm_account_number ?? '' : '',
      sbmEnabled: settings?.sbm_enabled ?? false,
      tenantShortCode: tenantShortCode ?? '',
      ...(tenantId ? {} : {
      coopConnectionId: settings?.coop_connection_id ?? '',
        coopConnectionPassword: settings?.coop_connection_password ?? '',
        coopServiceName: settings?.coop_service_name ?? '',
        coopInstitutionCode: settings?.coop_institution_code ?? '',
        coopInstitutionName: settings?.coop_institution_name ?? '',
        coopEnabled: settings?.coop_enabled ?? false,
        sbmIpnUsername: settings?.sbm_ipn_username ?? '',
        sbmIpnPasswordConfigured: Boolean(settings?.sbm_ipn_password),
        sbmSecretKeyConfigured: Boolean(settings?.sbm_secret_key),
      }),
    });
  } catch (error: any) {
    return NextResponse.json({ message: error.message ?? 'Unable to load payment settings.' }, { status: 500 });
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

    const {
      paybill,
      coopConnectionId,
      coopConnectionPassword,
      coopServiceName,
      coopInstitutionCode,
      coopInstitutionName,
      coopEnabled,
      sbmAccountNumber,
      sbmIpnUsername,
      sbmIpnPassword,
      sbmSecretKey,
      sbmEnabled,
    } = await request.json();
    const { data: existing, error: existingError } = await supabaseAdmin
      .from('payment_settings')
      .select('id, sbm_ipn_password, sbm_secret_key')
      .eq('organization_id', orgId ?? '')
      .limit(1)
      .maybeSingle();
    if (existingError) throw existingError;

    if ((coopEnabled === true && (typeof paybill !== 'string' || !paybill.trim())) || (typeof paybill !== 'string' && paybill !== undefined)) {
      return NextResponse.json({ message: 'A Co-operative Bank Paybill number is required.' }, { status: 400 });
    }
    if (
      coopEnabled === true &&
      [coopConnectionId, coopConnectionPassword, coopServiceName, coopInstitutionCode, coopInstitutionName]
        .some((value) => typeof value !== 'string' || !value.trim())
    ) {
      return NextResponse.json({ message: 'Complete all Co-operative Bank credentials before enabling the integration.' }, { status: 400 });
    }
    if (
      sbmEnabled === true &&
      (
        [sbmAccountNumber, sbmIpnUsername]
          .some((value) => typeof value !== 'string' || !value.trim()) ||
        (typeof sbmIpnPassword !== 'string' || !sbmIpnPassword.trim()) && !existing?.sbm_ipn_password ||
        (typeof sbmSecretKey !== 'string' || !sbmSecretKey.trim()) && !existing?.sbm_secret_key
      )
    ) {
      return NextResponse.json({ message: 'Complete the SBM account number, IPN username, IPN password, and secret key before enabling the integration.' }, { status: 400 });
    }
    if (coopEnabled !== true && sbmEnabled !== true && !(typeof paybill === 'string' && paybill.trim())) {
      return NextResponse.json({ message: 'Configure at least one bank payment method before saving.' }, { status: 400 });
    }

    const data = {
      organization_id: orgId ?? '',
      paybill: typeof paybill === 'string' ? paybill.trim() : '',
      coop_connection_id: typeof coopConnectionId === 'string' ? coopConnectionId.trim() : '',
      coop_connection_password: typeof coopConnectionPassword === 'string' ? coopConnectionPassword.trim() : '',
      coop_service_name: typeof coopServiceName === 'string' ? coopServiceName.trim() : '',
      coop_institution_code: typeof coopInstitutionCode === 'string' ? coopInstitutionCode.trim() : '',
      coop_institution_name: typeof coopInstitutionName === 'string' ? coopInstitutionName.trim() : '',
      coop_enabled: coopEnabled === true,
      sbm_account_number: typeof sbmAccountNumber === 'string' ? sbmAccountNumber.trim() : '',
      sbm_ipn_username: typeof sbmIpnUsername === 'string' ? sbmIpnUsername.trim() : '',
      sbm_ipn_password: typeof sbmIpnPassword === 'string' && sbmIpnPassword.trim()
        ? sbmIpnPassword.trim()
        : existing?.sbm_ipn_password ?? '',
      sbm_secret_key: typeof sbmSecretKey === 'string' && sbmSecretKey.trim()
        ? sbmSecretKey.trim()
        : existing?.sbm_secret_key ?? '',
      sbm_enabled: sbmEnabled === true,
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