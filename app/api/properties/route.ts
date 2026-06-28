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
  userId?: string;
  userEmail?: string;
  profile?: any;
  userMetadata?: any;
};

const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey);
const supabaseAnon = createClient(supabaseUrl, supabaseAnonKey);

function unauthorized(message: string) {
  return NextResponse.json({ message }, { status: 401 });
}

function forbidden(message: string) {
  return NextResponse.json({ message }, { status: 403 });
}

async function getAuthContext(request: NextRequest) {
  const cookie = request.headers.get('cookie') ?? '';
  const authorization = request.headers.get('authorization') ?? request.headers.get('Authorization');

  // Try to get session from cookie first, then from authorization header
  let sessionUser: any = null;

  // Method 1: Cookie-based session
  if (cookie) {
    const { data: cookieSession } = await supabaseAnon.auth.getSession();
    sessionUser = cookieSession.session?.user;
  }

  // Method 2: Token-based session
  if (!sessionUser && authorization?.startsWith('Bearer ')) {
    try {
      const token = authorization.split(' ')[1];
      const { data: { user } } = await supabaseAnon.auth.getUser(token);
      sessionUser = user;
    } catch (e) {
      // ignore token errors
    }
  }

  if (!sessionUser) {
    return {
      isSuperAdmin: false,
      userId: undefined,
      userEmail: undefined,
      profile: null,
      userMetadata: null,
    };
  }

  const { data: profile } = await supabaseAdmin
    .from('profiles')
    .select('id, user_id, organization_id, role, full_name, email')
    .eq('user_id', sessionUser.id)
    .single();

  // Fallback: query by email if user_id lookup fails
  if (!profile && sessionUser.email) {
    const { data: profileByEmail } = await supabaseAdmin
      .from('profiles')
      .select('id, user_id, organization_id, role, full_name, email')
      .eq('email', sessionUser.email)
      .single();
    return {
      isSuperAdmin: profileByEmail?.role === 'super_admin',
      userId: sessionUser.id,
      userEmail: sessionUser.email,
      profile: profileByEmail,
      userMetadata: sessionUser.user_metadata,
    };
  }

  return {
    isSuperAdmin: profile?.role === 'super_admin',
    userId: sessionUser.id,
    userEmail: sessionUser.email,
    profile,
    userMetadata: sessionUser.user_metadata,
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

async function assertPropertyAccess(propertyId: string, profileUserId: string | undefined | null, isSuperAdmin: boolean) {
  const property = await getPropertyById(propertyId);
  if (!property) return null;

  if (!isSuperAdmin && property.user_id !== profileUserId) {
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
      } else if (authContext.profile?.user_id || authContext.userId) {
        // Project managers see properties they created
        query = query.eq('user_id', authContext.profile?.user_id ?? authContext.userId);
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

    // Use session user_id - must exist for non-super-admin users
    const userId = authContext.isSuperAdmin ? null : authContext.userId;

    if (!authContext.isSuperAdmin && !userId) {
      console.log('Auth context:', JSON.stringify({ isSuperAdmin: authContext.isSuperAdmin, userId: authContext.userId }));
      return NextResponse.json({ message: 'Unable to create property - please log in.' }, { status: 403 });
    }

    const result = await supabaseAdmin
      .from('properties')
      .insert({
        name: name.trim(),
        address: address.trim(),
        size,
        amenities,
        ownership_info: ownershipInfo,
        user_id: userId,
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
    const profileUserId = authContext.profile?.user_id ?? authContext.userId;
    const property = await assertPropertyAccess(propertyId, profileUserId, authContext.isSuperAdmin);
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
    const profileUserId = authContext.profile?.user_id ?? authContext.userId;
    const property = await assertPropertyAccess(propertyId, profileUserId, authContext.isSuperAdmin);
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