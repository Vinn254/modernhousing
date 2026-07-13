import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL ?? '';
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY ?? '';

function getSupabaseAdmin() {
  if (!supabaseUrl || !serviceRoleKey) {
    throw new Error('Missing Supabase server environment variables');
  }
  return createClient(supabaseUrl, serviceRoleKey);
}

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
  const client = getSupabaseAdmin();
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
      const supabaseAuth = createClient(supabaseUrl, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? '', { global: { headers: { cookie } } });
      const { data: { user } } = await supabaseAuth.auth.getUser();
      sessionUser = user;
    } catch (e) {}
  }

  if (!sessionUser) {
    return { isSuperAdmin: false, userId: undefined, organizationId: null, tenantId: null, userMetadata: null };
  }

  const userMetadata = sessionUser.user_metadata || {};
  let orgId = userMetadata.organization_id ?? null;
  const tenantId = userMetadata.tenant_id ?? null;

  if (!orgId && sessionUser.email) {
    const { data: profileByEmail } = await client
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
    tenantId,
    userMetadata,
  };
}

export async function GET(request: NextRequest) {
  try {
    const client = getSupabaseAdmin();
    const authContext = await getAuthContext(request);
    const tenantIdParam = request.nextUrl.searchParams.get('tenantId');

    // For tenants - get their own bundle
    if (authContext.tenantId || tenantIdParam) {
      const effectiveTenantId = authContext.tenantId || tenantIdParam;
      const { data, error } = await client
        .from('document_bundles')
        .select(`*, tenants(full_name, units(unit_number, properties(name)))`)
        .eq('tenant_id', effectiveTenantId)
        .order('created_at', { ascending: false });

      if (error) throw error;

      const bundles = (data ?? []).map((b: any) => ({
        id: b.id,
        tenant_id: b.tenant_id,
        tenant_name: b.tenants?.full_name ?? '',
        property_name: b.tenants?.units?.properties?.name ?? '',
        status: b.status,
        signed_agreement_url: b.signed_agreement_url,
        id_document_url: b.id_document_url,
        passport_photo_url: b.passport_photo_url,
        created_at: b.created_at,
      }));

      return NextResponse.json({ bundles });
    }

    // For agents - get bundles for their property's tenants
    const userMetadata = authContext.userMetadata || {};
    const isAgent = userMetadata.role === 'agent';
    const agentPropertyId = isAgent ? userMetadata.property_id : null;

    if (isAgent && agentPropertyId) {
      const { data: units } = await client
        .from('units')
        .select('id')
        .eq('property_id', agentPropertyId);
      const unitIds = (units ?? []).map((u: any) => u.id);

      if (unitIds.length > 0) {
        const { data: tenantIds } = await client
          .from('tenants')
          .select('id')
          .in('unit_id', unitIds);
        const tenantIdValues = (tenantIds ?? []).map((t: any) => t.id);

        if (tenantIdValues.length > 0) {
          const { data, error } = await client
            .from('document_bundles')
            .select(`*, tenants(full_name, units(unit_number, properties(name)))`)
            .in('tenant_id', tenantIdValues)
            .order('created_at', { ascending: false });

          if (error) throw error;

          const bundles = (data ?? []).map((b: any) => ({
            id: b.id,
            tenant_id: b.tenant_id,
            tenant_name: b.tenants?.full_name ?? '',
            property_name: b.tenants?.units?.properties?.name ?? '',
            status: b.status,
            signed_agreement_url: b.signed_agreement_url,
            id_document_url: b.id_document_url,
            passport_photo_url: b.passport_photo_url,
            created_at: b.created_at,
          }));

          return NextResponse.json({ bundles });
        }
      }
      return NextResponse.json({ bundles: [] });
    }

    // For landlords - get bundles for their tenants (organization-scoped)
    if (!authContext.isSuperAdmin && authContext.organizationId) {
      const { data: orgProps } = await client
        .from('properties')
        .select('id')
        .eq('organization_id', authContext.organizationId);
      const propIds = (orgProps ?? []).map((p: any) => p.id);

      if (propIds.length > 0) {
        const { data: orgUnits } = await client
          .from('units')
          .select('id')
          .in('property_id', propIds);
        const unitIds = (orgUnits ?? []).map((u: any) => u.id);

        if (unitIds.length > 0) {
          const { data: tenantIds } = await client
            .from('tenants')
            .select('id')
            .in('unit_id', unitIds);
          const tenantIdValues = (tenantIds ?? []).map((t: any) => t.id);

          if (tenantIdValues.length > 0) {
            const { data, error } = await client
              .from('document_bundles')
              .select(`*, tenants(full_name, units(unit_number, properties(name)))`)
              .in('tenant_id', tenantIdValues)
              .order('created_at', { ascending: false });

            if (error) throw error;

            const bundles = (data ?? []).map((b: any) => ({
              id: b.id,
              tenant_id: b.tenant_id,
              tenant_name: b.tenants?.full_name ?? '',
              property_name: b.tenants?.units?.properties?.name ?? '',
              status: b.status,
              signed_agreement_url: b.signed_agreement_url,
              id_document_url: b.id_document_url,
              passport_photo_url: b.passport_photo_url,
              created_at: b.created_at,
            }));

            return NextResponse.json({ bundles });
          }
        }
      }
      return NextResponse.json({ bundles: [] });
    }

    // Super admin - get all bundles
    const { data, error } = await client
      .from('document_bundles')
      .select(`*, tenants(full_name, units(unit_number, properties(name)))`)
      .order('created_at', { ascending: false });

    if (error) throw error;

    const bundles = (data ?? []).map((b: any) => ({
      id: b.id,
      tenant_id: b.tenant_id,
      tenant_name: b.tenants?.full_name ?? '',
      property_name: b.tenants?.units?.properties?.name ?? '',
      status: b.status,
      signed_agreement_url: b.signed_agreement_url,
      id_document_url: b.id_document_url,
      passport_photo_url: b.passport_photo_url,
      created_at: b.created_at,
    }));

    return NextResponse.json({ bundles });
  } catch (error: any) {
    return NextResponse.json({ bundles: [], message: error.message ?? 'Unable to load bundles.' }, { status: 500 });
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const client = getSupabaseAdmin();
    const authContext = await getAuthContext(request);
    const body = await request.json();
    const { id, status } = body;

    if (!id) {
      return NextResponse.json({ message: 'Bundle ID is required.' }, { status: 400 });
    }

    // Verify bundle belongs to user's organization
    if (!authContext.isSuperAdmin) {
      const userMetadata = authContext.userMetadata || {};
      const isAgent = userMetadata.role === 'agent';
      const agentPropertyId = isAgent ? userMetadata.property_id : null;
      let tenantIds: string[] = [];

      if (agentPropertyId) {
        const { data: units } = await client
          .from('units')
          .select('id')
          .eq('property_id', agentPropertyId);
        const unitIds = (units ?? []).map((u: any) => u.id);
        const { data: tenants } = await client
          .from('tenants')
          .select('id')
          .in('unit_id', unitIds);
        tenantIds = (tenants ?? []).map((t: any) => t.id);
      } else if (authContext.organizationId) {
        const { data: orgProps } = await client
          .from('properties')
          .select('id')
          .eq('organization_id', authContext.organizationId);
        const propIds = (orgProps ?? []).map((p: any) => p.id);
        const { data: orgUnits } = await client.from('units').select('id').in('property_id', propIds);
        const unitIds = (orgUnits ?? []).map((u: any) => u.id);
        const { data: tenants } = await client
          .from('tenants')
          .select('id')
          .in('unit_id', unitIds);
        tenantIds = (tenants ?? []).map((t: any) => t.id);
      }

      if (tenantIds.length > 0) {
        const { data: bundleCheck } = await client
          .from('document_bundles')
          .select('id')
          .eq('id', id)
          .in('tenant_id', tenantIds)
          .maybeSingle();
        if (!bundleCheck) {
          return NextResponse.json({ message: 'You can only update bundles for your own tenants.' }, { status: 403 });
        }
      }
    }

    const result = await client
      .from('document_bundles')
      .update({ status, updated_at: new Date().toISOString() })
      .eq('id', id)
      .select()
      .single();

    if (result.error) {
      return NextResponse.json({ message: result.error.message }, { status: 500 });
    }

    return NextResponse.json({ message: 'Bundle updated.', bundle: result.data });
  } catch (error: any) {
    return NextResponse.json({ message: error.message ?? 'Unable to update bundle.' }, { status: 500 });
  }
}

