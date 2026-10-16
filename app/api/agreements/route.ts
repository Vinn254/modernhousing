import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { rentTypeForStorage } from '../../../lib/rentTypes';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL ?? '';
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? '';
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
    let payload = parts[1].replace(/-/g, '+').replace(/_/g, '/');
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
    const decoded = decodeJWT(authorization.split(' ')[1]);
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
    return { userId: undefined as string | undefined, email: undefined as string | undefined, organizationId: null as string | null, tenantId: null as string | null, userMetadata: {} as any, isSuperAdmin: false };
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
    userId: sessionUser.id as string,
    email: sessionUser.email as string | undefined,
    organizationId: orgId as string | null,
    tenantId: tenantId as string | null,
    userMetadata,
    isSuperAdmin: userMetadata.role === 'super_admin',
  };
}

// Property IDs a landlord can act on: properties they created, falling back
// to their organization (handles legacy properties with null created_by).
async function landlordPropertyIds(client: any, authContext: any): Promise<string[]> {
  const { data: createdProps } = await client
    .from('properties').select('id').eq('created_by', authContext.userId);
  let propIds = (createdProps ?? []).map((p: any) => p.id);
  if (propIds.length === 0 && authContext.organizationId) {
    const { data: orgProps } = await client
      .from('properties').select('id').eq('organization_id', authContext.organizationId);
    propIds = (orgProps ?? []).map((p: any) => p.id);
  }
  return propIds;
}

async function attachItems(client: any, agreements: any[]) {
  const allIds = Array.from(new Set(agreements.flatMap((a) => (a.selected_item_ids ?? []) as string[])));
  if (allIds.length === 0) return agreements.map((a) => ({ ...a, items: [] }));
  const { data } = await client
    .from('agreement_items')
    .select('id, category, label, body_text, sort_order')
    .in('id', allIds);
  const map = new Map<string, any>();
  (data ?? []).forEach((it: any) => map.set(it.id, it));
  return agreements.map((a) => ({
    ...a,
    items: ((a.selected_item_ids ?? []) as string[]).map((id) => map.get(id)).filter(Boolean),
  }));
}

export async function GET(request: NextRequest) {
  try {
    const client = getSupabaseAdmin();
    const authContext = await getAuthContext(request);
    if (!authContext.userId) {
      return NextResponse.json({ agreements: [], message: 'Authentication required.' }, { status: 401 });
    }

    const tenantIdParam = request.nextUrl.searchParams.get('tenantId');
    const effectiveTenantId = authContext.tenantId || tenantIdParam;

    // Tenant view: only their own agreements.
    if (authContext.tenantId) {
      const { data, error } = await client
        .from('tenancy_agreements')
        .select('*, tenants(full_name, email, phone, national_id, kra_pin, picture_url, address, units(unit_number, short_code, properties(name)))')
        .eq('tenant_id', authContext.tenantId)
        .order('created_at', { ascending: false });
      if (error) throw error;
      const mapped = (data ?? []).map((a: any) => ({
        ...a,
        tenant_name: a.tenants?.full_name ?? '',
        tenant_email: a.tenants?.email ?? '',
        tenant_phone: a.tenants?.phone ?? '',
        tenant_national_id: a.tenants?.national_id ?? '',
        tenant_kra_pin: a.tenants?.kra_pin ?? '',
        tenant_picture_url: a.tenants?.picture_url ?? '',
        tenant_address: a.tenants?.address ?? '',
        unit_number: a.tenants?.units?.unit_number ?? a.tenants?.units?.short_code ?? '',
        property_name: a.tenants?.units?.properties?.name ?? '',
        tenants: undefined,
      }));
      const enriched = await attachItems(client, mapped);
      return NextResponse.json({ agreements: enriched });
    }

    // Landlord view: agreements on their properties or created by them.
    const propIds = await landlordPropertyIds(client, authContext);
    let query = client
      .from('tenancy_agreements')
      .select('*, tenants(full_name, email, phone, national_id, kra_pin, picture_url, address, units(unit_number, short_code, properties(name)))')
      .order('created_at', { ascending: false });

    if (!authContext.isSuperAdmin) {
      const orParts = [`created_by.eq.${authContext.userId}`];
      if (propIds.length > 0) orParts.push(`property_id.in.(${propIds.join(',')})`);
      if (authContext.organizationId) orParts.push(`organization_id.eq.${authContext.organizationId}`);
      query = query.or(orParts.join(','));
    }

    const { data, error } = await query;
    if (error) throw error;

    const agreements = (data ?? []).map((a: any) => ({
      ...a,
      tenant_name: a.tenants?.full_name ?? '',
      tenant_email: a.tenants?.email ?? '',
      tenant_phone: a.tenants?.phone ?? '',
      tenant_national_id: a.tenants?.national_id ?? '',
      tenant_kra_pin: a.tenants?.kra_pin ?? '',
      tenant_picture_url: a.tenants?.picture_url ?? '',
      tenant_address: a.tenants?.address ?? '',
      unit_number: a.tenants?.units?.unit_number ?? a.tenants?.units?.short_code ?? '',
      property_name: a.tenants?.units?.properties?.name ?? '',
      tenants: undefined,
    }));

    const enriched = await attachItems(client, agreements);
    return NextResponse.json({ agreements: enriched, effectiveTenantId });
  } catch (error: any) {
    return NextResponse.json({ agreements: [], message: error.message ?? 'Unable to load agreements.' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const client = getSupabaseAdmin();
    const authContext = await getAuthContext(request);
    if (!authContext.userId) {
      return NextResponse.json({ message: 'Authentication required.' }, { status: 401 });
    }

    const body = await request.json();
    const { tenantId, title, description, selectedItemIds, send, rentType } = body;
    if (!tenantId) {
      return NextResponse.json({ message: 'A tenant is required.' }, { status: 400 });
    }
    if (!Array.isArray(selectedItemIds) || selectedItemIds.length === 0) {
      return NextResponse.json({ message: 'Select at least one agreement item.' }, { status: 400 });
    }

    // Resolve the tenant's property and confirm it belongs to this landlord.
    const { data: tenant, error: tenantError } = await client
      .from('tenants')
      .select('id, full_name, email, unit_id, units(property_id, properties(organization_id, created_by, name))')
      .eq('id', tenantId)
      .maybeSingle();
    if (tenantError) throw tenantError;
    if (!tenant) {
      return NextResponse.json({ message: 'Invalid tenant.' }, { status: 400 });
    }

    const propertyId = tenant.units?.property_id ?? null;
    const organizationId = tenant.units?.properties?.organization_id ?? authContext.organizationId ?? null;

    if (!authContext.isSuperAdmin) {
      const propIds = await landlordPropertyIds(client, authContext);
      if (propertyId && !propIds.includes(propertyId)) {
        return NextResponse.json({ message: 'You can only create agreements for your own tenants.' }, { status: 403 });
      }
      if (!propertyId && propIds.length === 0) {
        return NextResponse.json({ message: 'You can only create agreements for your own tenants.' }, { status: 403 });
      }
    }

    const { data: profile } = await client
      .from('profiles').select('email').eq('user_id', authContext.userId).maybeSingle();
    const landlordEmail = profile?.email ?? authContext.email ?? null;

    const status = send ? 'sent' : 'draft';
    const rentTypeValue = rentTypeForStorage(rentType);
    const { data: created, error: insertError } = await client
      .from('tenancy_agreements')
      .insert({
        tenant_id: tenantId,
        property_id: propertyId,
        organization_id: organizationId,
        landlord_email: landlordEmail,
        created_by: authContext.userId,
        title: (title || 'Tenancy Agreement').trim(),
        description: description ?? '',
        selected_item_ids: selectedItemIds,
        status,
        sent_at: send ? new Date().toISOString() : null,
        ...(rentTypeValue ? { rent_type: rentTypeValue } : {}),
      })
      .select()
      .single();
    if (insertError) throw insertError;

    if (send && propertyId) {
      const { error: noteError } = await client.from('notifications').insert({
        recipient: 'tenant',
        tenant_id: tenantId,
        property_id: propertyId,
        admin_email: landlordEmail,
        type: 'tenancy_agreement',
        message: `Your tenancy agreement "${created.title}" is ready to review. Please tick each item, acknowledge and submit it.`,
        status: 'sent',
        created_at: new Date().toISOString(),
      });
      if (noteError) console.error('[agreements] tenant notification failed', noteError);
    }

    const enriched = await attachItems(client, [{ ...created, tenant_name: tenant.full_name }]);
    return NextResponse.json({ message: send ? 'Agreement sent to tenant.' : 'Draft saved.', agreement: enriched[0] }, { status: 201 });
  } catch (error: any) {
    return NextResponse.json({ message: error.message ?? 'Unable to create agreement.' }, { status: 500 });
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const client = getSupabaseAdmin();
    const authContext = await getAuthContext(request);
    if (!authContext.userId) {
      return NextResponse.json({ message: 'Authentication required.' }, { status: 401 });
    }

    const body = await request.json();
    const { id, action } = body;
    if (!id) {
      return NextResponse.json({ message: 'Agreement ID is required.' }, { status: 400 });
    }

    const { data: agreement, error: fetchError } = await client
      .from('tenancy_agreements').select('*').eq('id', id).maybeSingle();
    if (fetchError) throw fetchError;
    if (!agreement) {
      return NextResponse.json({ message: 'Agreement not found.' }, { status: 404 });
    }

    const isTenantOwner = authContext.tenantId && authContext.tenantId === agreement.tenant_id;

    // ---- Tenant submits checked + acknowledged agreement ----
    if (action === 'submit') {
      if (!isTenantOwner) {
        return NextResponse.json({ message: 'You can only submit your own agreement.' }, { status: 403 });
      }
      if (!body.acknowledged) {
        return NextResponse.json({ message: 'You must acknowledge the agreement before submitting.' }, { status: 400 });
      }
      const tenantChecks = Array.isArray(body.tenantChecks) ? body.tenantChecks : [];
      const { data: updated, error } = await client
        .from('tenancy_agreements')
        .update({
          tenant_checks: tenantChecks,
          tenant_acknowledged: true,
          tenant_notes: body.tenantNotes ?? null,
          status: 'submitted',
          submitted_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .eq('id', id).select().single();
      if (error) throw error;

      if (updated.property_id && updated.landlord_email) {
        const { error: noteError } = await client.from('notifications').insert({
          recipient: 'project_manager',
          tenant_id: updated.tenant_id,
          property_id: updated.property_id,
          admin_email: updated.landlord_email,
          type: 'tenancy_agreement',
          message: `A tenancy agreement "${updated.title}" has been submitted by your tenant and is awaiting your review.`,
          status: 'sent',
          created_at: new Date().toISOString(),
        });
        if (noteError) console.error('[agreements] landlord notification failed', noteError);
      }

      const enriched = await attachItems(client, [updated]);
      return NextResponse.json({ message: 'Agreement submitted to landlord.', agreement: enriched[0] });
    }

    // ---- Landlord actions ----
    if (!authContext.isSuperAdmin) {
      const propIds = await landlordPropertyIds(client, authContext);
      const owns = agreement.created_by === authContext.userId
        || (agreement.property_id && propIds.includes(agreement.property_id))
        || (authContext.organizationId && agreement.organization_id === authContext.organizationId);
      if (!owns) {
        return NextResponse.json({ message: 'You can only manage your own agreements.' }, { status: 403 });
      }
    }

    if (action === 'update') {
      const update: any = { updated_at: new Date().toISOString() };
      if (typeof body.title === 'string') update.title = body.title.trim();
      if (typeof body.description === 'string') update.description = body.description;
      if (Array.isArray(body.selectedItemIds)) update.selected_item_ids = body.selectedItemIds;
      if (Object.prototype.hasOwnProperty.call(body, 'rentType')) update.rent_type = rentTypeForStorage(body.rentType);
      const { data: updated, error } = await client
        .from('tenancy_agreements').update(update).eq('id', id).select().single();
      if (error) throw error;
      const enriched = await attachItems(client, [updated]);
      return NextResponse.json({ message: 'Agreement updated.', agreement: enriched[0] });
    }

    if (action === 'send') {
      const { data: updated, error } = await client
        .from('tenancy_agreements')
        .update({ status: 'sent', sent_at: new Date().toISOString(), updated_at: new Date().toISOString() })
        .eq('id', id).select().single();
      if (error) throw error;
      if (updated.property_id) {
        await client.from('notifications').insert({
          recipient: 'tenant',
          tenant_id: updated.tenant_id,
          property_id: updated.property_id,
          admin_email: updated.landlord_email,
          type: 'tenancy_agreement',
          message: `Your tenancy agreement "${updated.title}" is ready to review. Please tick each item, acknowledge and submit it.`,
          status: 'sent',
          created_at: new Date().toISOString(),
        });
      }
      const enriched = await attachItems(client, [updated]);
      return NextResponse.json({ message: 'Agreement sent to tenant.', agreement: enriched[0] });
    }

    if (action === 'review') {
      const finalStatus = body.completed ? 'completed' : 'reviewed';
      const { data: updated, error } = await client
        .from('tenancy_agreements')
        .update({ status: finalStatus, reviewed_at: new Date().toISOString(), updated_at: new Date().toISOString() })
        .eq('id', id).select().single();
      if (error) throw error;
      const enriched = await attachItems(client, [updated]);
      return NextResponse.json({ message: `Agreement marked as ${finalStatus}.`, agreement: enriched[0] });
    }

    return NextResponse.json({ message: 'Unknown action.' }, { status: 400 });
  } catch (error: any) {
    return NextResponse.json({ message: error.message ?? 'Unable to update agreement.' }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const client = getSupabaseAdmin();
    const authContext = await getAuthContext(request);
    if (!authContext.userId) {
      return NextResponse.json({ message: 'Authentication required.' }, { status: 401 });
    }

    const body = await request.json();
    const { id } = body;
    if (!id) {
      return NextResponse.json({ message: 'Agreement ID is required.' }, { status: 400 });
    }

    if (!authContext.isSuperAdmin) {
      const { data: agreement } = await client
        .from('tenancy_agreements').select('*').eq('id', id).maybeSingle();
      if (!agreement) {
        return NextResponse.json({ message: 'Agreement not found.' }, { status: 404 });
      }
      const propIds = await landlordPropertyIds(client, authContext);
      const owns = agreement.created_by === authContext.userId
        || (agreement.property_id && propIds.includes(agreement.property_id))
        || (authContext.organizationId && agreement.organization_id === authContext.organizationId);
      if (!owns) {
        return NextResponse.json({ message: 'You can only delete your own agreements.' }, { status: 403 });
      }
    }

    const { error } = await client.from('tenancy_agreements').delete().eq('id', id);
    if (error) throw error;
    return NextResponse.json({ message: 'Agreement deleted.' });
  } catch (error: any) {
    return NextResponse.json({ message: error.message ?? 'Unable to delete agreement.' }, { status: 500 });
  }
}
