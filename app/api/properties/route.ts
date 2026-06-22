import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL ?? '';
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? '';
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY ?? '';

if (!supabaseUrl || !supabaseAnonKey || !serviceRoleKey) {
  throw new Error('Missing Supabase server environment variables');
}

type AuthContext = {
  session: { user: { id: string } } | null;
  profile: {
    id: string;
    user_id: string;
    organization_id: string | null;
    role: string;
    full_name: string;
    email: string;
  } | null;
  isSuperAdmin: boolean;
};

const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey);

function unauthorized(message: string) {
  return NextResponse.json({ message }, { status: 401 });
}

function forbidden(message: string) {
  return NextResponse.json({ message }, { status: 403 });
}

async function getAuthContext(request: NextRequest): Promise<AuthContext | NextResponse> {
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
      session: { user: { id: '' } },
      profile: {
        id: '',
        user_id: '',
        organization_id: null,
        role: 'project_manager',
        full_name: '',
        email: '',
      },
      isSuperAdmin: false,
    };
  }

  const { data: profile, error: profileError } = await supabaseAdmin
    .from('profiles')
    .select('id, user_id, organization_id, role, full_name, email')
    .eq('user_id', sessionData.session.user.id)
    .single();

  if (profileError && profileError.code === 'PGRST116') {
    const role = sessionData.session.user.user_metadata?.role ?? 'project_manager';
    const fullName = sessionData.session.user.user_metadata?.full_name ?? sessionData.session.user.email ?? 'User';
    const { data: createdProfile, error: createError } = await supabaseAdmin
      .from('profiles')
      .insert({
        user_id: sessionData.session.user.id,
        full_name: fullName,
        email: sessionData.session.user.email,
        role,
        organization_id: null,
        status: 'active',
      })
      .select('*')
      .single();
    if (createError) {
      return {
        session: sessionData.session,
        profile: {
          id: '',
          user_id: '',
          organization_id: null,
          role: 'project_manager',
          full_name: '',
          email: '',
        },
        isSuperAdmin: false,
      };
    }
    return {
      session: sessionData.session,
      profile: createdProfile,
      isSuperAdmin: createdProfile.role === 'super_admin',
    };
  }

  return {
    session: sessionData.session,
    profile: profile ?? {
      id: '',
      user_id: '',
      organization_id: null,
      role: 'project_manager',
      full_name: '',
      email: '',
    },
    isSuperAdmin: profile?.role === 'super_admin',
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

async function assertPropertyAccess(request: NextRequest, propertyId: string, authContext: AuthContext) {
  const property = await getPropertyById(propertyId);
  if (!property) return null;

  if (!authContext.isSuperAdmin && property.organization_id !== authContext.profile?.organization_id) {
    return forbidden('You can only manage properties in your own landlord workspace.');
  }

  return property;
}

export async function GET(request: NextRequest) {
  const query = supabaseAdmin.from('properties').select('*');

  const { data, error } = await query.order('created_at', { ascending: false });

  if (error) {
    return NextResponse.json({ message: error.message }, { status: 500 });
  }

  return NextResponse.json({ properties: await enrichProperties(data ?? []) });
}

export async function POST(request: NextRequest) {
  const body = await request.json();
  const { name, address, size, amenities, ownershipInfo, organizationId } = body;

  if (!name?.trim() || !address?.trim()) {
    return NextResponse.json({ message: 'Property name and address are required.' }, { status: 400 });
  }

  const result = await supabaseAdmin
    .from('properties')
    .insert({
      organization_id: organizationId ?? null,
      name: name.trim(),
      address: address.trim(),
      size,
      amenities,
      ownership_info: ownershipInfo,
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
  const body = await request.json();
  const propertyId = body.id;

  if (!propertyId) {
    return NextResponse.json({ message: 'Property id is required.' }, { status: 400 });
  }

  const { name, address, size, amenities, ownershipInfo } = body;

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
}

export async function DELETE(request: NextRequest) {
  const propertyId = request.nextUrl.searchParams.get('id');
  if (!propertyId) {
    return NextResponse.json({ message: 'Property id is required.' }, { status: 400 });
  }

  const { error } = await supabaseAdmin.from('properties').delete().eq('id', propertyId);

  if (error) {
    return NextResponse.json({ message: error.message }, { status: 500 });
  }

  return NextResponse.json({ message: 'Property removed.' });
}
