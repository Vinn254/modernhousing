import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL ?? '';
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? '';
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY ?? '';

if (!supabaseUrl || !supabaseAnonKey || !serviceRoleKey) {
  throw new Error('Missing Supabase server environment variables');
}

type AuthContext = {
  isSuperAdmin: boolean;
  organization_id: string | null;
  userId?: string;
  userEmail?: string;
  profile?: any;
  userMetadata?: any;
};

const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey);

function unauthorized(message: string) {
  return NextResponse.json({ message }, { status: 401 });
}

function forbidden(message: string) {
  return NextResponse.json({ message }, { status: 403 });
}

async function getAuthContext(request: NextRequest) {
  const headers: Record<string, string> = {
    cookie: request.headers.get('cookie') ?? '',
  };
  const authorization = request.headers.get('authorization') ?? request.headers.get('Authorization');
  if (authorization) headers.Authorization = authorization;

  const supabaseAuth = createClient(supabaseUrl, supabaseAnonKey, {
    global: {
      headers,
    },
  });

  const { data: sessionData, error: sessionError } = await supabaseAuth.auth.getSession();

  if (sessionError || !sessionData.session) {
    return {
      isSuperAdmin: false,
      organization_id: null,
      userId: undefined,
      userEmail: undefined,
      profile: null,
      userMetadata: null,
    };
  }

  let { data: profile } = await supabaseAdmin
    .from('profiles')
    .select('id, user_id, organization_id, role, full_name, email')
    .eq('user_id', sessionData.session.user.id)
    .single();

    let orgId = profile?.organization_id ?? sessionData.session.user?.user_metadata?.organization_id ?? null;

    // If no org and user is project_manager, create org
    if (!orgId) {
      const role = profile?.role ?? sessionData.session.user.user_metadata?.role ?? 'project_manager';
      if (role === 'project_manager') {
        const { data: newOrg } = await supabaseAdmin
          .from('organizations')
          .insert({ name: `${sessionData.session.user.email?.split('@')[0] ?? 'Property Manager'} Organization` })
          .select('id')
          .single();
        orgId = newOrg?.id ?? null;

        if (orgId) {
          // Update or create profile with org
          if (profile) {
            await supabaseAdmin
              .from('profiles')
              .update({ organization_id: orgId })
              .eq('id', profile.id);
          } else {
            const fullName = sessionData.session.user.user_metadata?.full_name ?? sessionData.session.user.email ?? 'User';
            const { data: createdProfile } = await supabaseAdmin
              .from('profiles')
              .insert({
                user_id: sessionData.session.user.id,
                full_name: fullName,
                email: sessionData.session.user.email,
                role: 'project_manager',
                organization_id: orgId,
                status: 'active',
              })
              .select('id, user_id, organization_id, role, full_name, email')
              .single();
            profile = createdProfile;
          }

          // Assign any orphaned properties to this org
          await supabaseAdmin
            .from('properties')
            .update({ organization_id: orgId })
            .eq('organization_id', null);
        }
      }
    }

    return {
      isSuperAdmin: profile?.role === 'super_admin',
      organization_id: orgId,
      userId: sessionData.session.user.id,
      userEmail: sessionData.session.user.email,
      profile: orgId ? { ...profile, organization_id: orgId } as any : profile,
      userMetadata: sessionData.session.user.user_metadata,
    };
  }

async function getPropertyById(id: string) {
  const { data: property, error } = await supabaseAdmin.from('properties').select('*').eq('id', id).single();
  if (error || !property) return null;
  const enriched = await enrichProperties([property]);
  return enriched[0] ?? null;
}

async function enrichProperties(rows: any[]) {
  if (rows.length === 0) return [];

  const propertyIds = rows.map((row) => row.id);
  const [{ data: units, error: unitsError }, { data: tenants, error: tenantsError }] = await Promise.all([
    supabaseAdmin.from('units').select('id, property_id, occupancy_status, rent_amount').in('property_id', propertyIds),
    supabaseAdmin
      .from('tenants')
      .select('id, unit_id')
      .in(
        'unit_id',
        (await supabaseAdmin.from('units').select('id').in('property_id', propertyIds)).data?.map((unit) => unit.id) ?? []
      ),
  ]);

  if (unitsError || tenantsError) {
    return rows.map((row) => ({
      ...row,
      unit_count: 0,
      tenant_count: 0,
      rent_roll: 0,
    }));
  }

  const unitsByProperty = units?.reduce<Record<string, any[]>>((acc, unit) => {
    acc[unit.property_id] = acc[unit.property_id] ?? [];
    acc[unit.property_id].push(unit);
    return acc;
  }, {}) ?? {};

  const tenantsByProperty = tenants?.reduce<Record<string, number>>((acc, tenant) => {
    const unit = units?.find((item) => item.id === tenant.unit_id);
    if (!unit) return acc;
    acc[unit.property_id] = (acc[unit.property_id] ?? 0) + 1;
    return acc;
  }, {}) ?? {};

  return rows.map((row) => {
    const propertyUnits = unitsByProperty[row.id] ?? [];
    const rentRoll = propertyUnits.reduce((sum, unit) => sum + Number(unit.rent_amount ?? 0), 0);
    return {
      ...row,
      unit_count: propertyUnits.length,
      tenant_count: tenantsByProperty[row.id] ?? 0,
      rent_roll: rentRoll,
    };
  });
}

async function assertPropertyAccess(request: NextRequest, propertyId: string, organizationId: string | null, isSuperAdmin: boolean) {
  const property = await getPropertyById(propertyId);
  if (!property) return null;

  if (!isSuperAdmin && property.organization_id !== organizationId) {
    return forbidden('You can only manage properties in your own landlord workspace.');
  }

  return property;
}

export async function GET(request: NextRequest) {
    const authContext = await getAuthContext(request);

    let query: any = supabaseAdmin.from('properties').select('*');

    if (!authContext.isSuperAdmin) {
      // Check if user is an agent and should only see their assigned property
      if (authContext.profile?.role === 'agent' || authContext.userMetadata?.role === 'agent') {
        const agentPropertyId = authContext.userMetadata?.property_id;
        if (agentPropertyId) {
          query = query.eq('id', agentPropertyId);
        } else {
          return NextResponse.json({ properties: [] });
        }
      } else if (authContext.organization_id) {
        query = query.eq('organization_id', authContext.organization_id);
      } else {
        return NextResponse.json({ properties: [] });
      }
    }

    const { data, error } = await query.order('created_at', { ascending: false });

    if (error) {
      return NextResponse.json({ message: error.message }, { status: 500 });
    }

    return NextResponse.json({ properties: await enrichProperties(data ?? []) });
  }

export async function POST(request: NextRequest) {
    const body = await request.json();
    const { name, address, size, amenities, ownershipInfo } = body;

    if (!name?.trim() || !address?.trim()) {
      return NextResponse.json({ message: 'Property name and address are required.' }, { status: 400 });
    }

    const authContext = await getAuthContext(request);

    let orgId = authContext.organization_id;

    if (!orgId && !authContext.isSuperAdmin) {
      const { data: newOrg } = await supabaseAdmin
        .from('organizations')
        .insert({ name: `${authContext.userEmail?.split('@')[0] ?? 'Property Manager'} Organization` })
        .select('id')
        .single();
      orgId = newOrg?.id ?? null;

      if (orgId) {
        if (authContext.profile) {
          await supabaseAdmin
            .from('profiles')
            .update({ organization_id: orgId })
            .eq('id', authContext.profile.id);
        } else {
          const fullName = authContext.userMetadata?.full_name ?? authContext.userEmail ?? 'User';
          const role = authContext.userMetadata?.role ?? 'project_manager';
          if (role === 'project_manager') {
            await supabaseAdmin
              .from('profiles')
              .insert({
                user_id: authContext.userId,
                full_name: fullName,
                email: authContext.userEmail,
                role: 'project_manager',
                organization_id: orgId,
                status: 'active',
              });
          }
        }

        if (authContext.userMetadata?.role === 'project_manager' || !authContext.profile) {
          await supabaseAdmin
            .from('properties')
            .update({ organization_id: orgId })
            .eq('organization_id', null);
        }
      }
    }

    if (!orgId) {
      return NextResponse.json({ message: 'Unable to create property - no organization assigned.' }, { status: 403 });
    }

    const result = await supabaseAdmin
      .from('properties')
      .insert({
        name: name.trim(),
        address: address.trim(),
        size,
        amenities,
        ownership_info: ownershipInfo,
        organization_id: orgId,
      })
      .select()
      .single();

    if (result.error) {
      return NextResponse.json({ message: result.error.message }, { status: 500 });
    }

    const enriched = await enrichProperties([result.data]);
    return NextResponse.json({ message: 'Property created.', property: enriched[0] }, { status: 201 });
  }

export async function PATCH(request: NextRequest) {
  try {
    const body = await request.json();
    const propertyId = body.id;

    if (!propertyId) {
      return NextResponse.json({ message: 'Property id is required.' }, { status: 400 });
    }

    const { name, address, size, amenities, ownershipInfo } = body;

    const authContext = await getAuthContext(request);
    const property = await assertPropertyAccess(request, propertyId, authContext.organization_id, authContext.isSuperAdmin);
    if (!property) {
      return NextResponse.json({ message: 'You can only manage properties in your own landlord workspace.' }, { status: 403 });
    }

    const result = await supabaseAdmin
      .from('properties')
      .update({
        name: name?.trim() ?? undefined,
        address: address?.trim() ?? undefined,
        size,
        amenities,
        ownership_info: ownershipInfo,
      })
      .eq('id', propertyId)
      .select()
      .single();

    if (result.error) {
      return NextResponse.json({ message: result.error.message }, { status: 500 });
    }

    const enriched = await enrichProperties([result.data]);
    return NextResponse.json({ message: 'Property updated.', property: enriched[0] });
  } catch (error: any) {
    return NextResponse.json({ message: error.message ?? 'Unable to update property.' }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const propertyId = request.nextUrl.searchParams.get('id');
    if (!propertyId) {
      return NextResponse.json({ message: 'Property id is required.' }, { status: 400 });
    }

    const authContext = await getAuthContext(request);
    const property = await assertPropertyAccess(request, propertyId, authContext.organization_id, authContext.isSuperAdmin);
    if (!property) {
      return NextResponse.json({ message: 'You can only manage properties in your own landlord workspace.' }, { status: 403 });
    }

    const { error } = await supabaseAdmin.from('properties').delete().eq('id', propertyId);

    if (error) {
      return NextResponse.json({ message: error.message }, { status: 500 });
    }

    return NextResponse.json({ message: 'Property removed.' });
  } catch (error: any) {
    return NextResponse.json({ message: error.message ?? 'Unable to delete property.' }, { status: 500 });
  }
}
