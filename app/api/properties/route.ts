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
  organizationId: string | null;
  profile?: any;
  userMetadata?: any;
};

const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey);

function forbidden(message: string) {
  return NextResponse.json({ message }, { status: 403 });
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

async function getAuthContext(request: NextRequest): Promise<AuthContext> {
  const cookie = request.headers.get('cookie') ?? '';
  const authorization = request.headers.get('authorization') ?? request.headers.get('Authorization');

  let sessionUser: any = null;

  // Method 1: Try Bearer token auth with JWT decoding
  if (authorization?.startsWith('Bearer ')) {
    const token = authorization.split(' ')[1];
    const decoded = decodeJWT(token);
    if (decoded?.sub) {
      sessionUser = {
        id: decoded.sub,
        email: decoded.email,
        user_metadata: decoded.user_metadata || {},
      };
    }
  }

  // Method 2: Try cookie-based session via getUser
  if (!sessionUser && cookie) {
    try {
      const supabaseAuth = createClient(supabaseUrl, supabaseAnonKey, {
        global: { headers: { cookie } },
      });
      const { data: { user } } = await supabaseAuth.auth.getUser();
      sessionUser = user;
    } catch (e) {}
  }

  // Method 3: Try session from cookie
  if (!sessionUser && cookie) {
    try {
      const supabaseAuth = createClient(supabaseUrl, supabaseAnonKey, {
        global: { headers: { cookie } },
      });
      const { data: { session } } = await supabaseAuth.auth.getSession();
      sessionUser = session?.user;
    } catch (e) {}
  }

  // Debug logging
  if (!sessionUser) {
    console.log('Auth context - no session found. Cookie:', cookie ? 'present' : 'missing', 'Auth:', authorization ? 'present' : 'missing');
  }

  if (!sessionUser) {
    return {
      isSuperAdmin: false,
      userId: undefined,
      userEmail: undefined,
      organizationId: null,
      profile: null,
      userMetadata: null,
    };
  }

  // Merge user_metadata from JWT decoded data
  const userMetadata = sessionUser.user_metadata || {};

  const { data: profile } = await supabaseAdmin
    .from('profiles')
    .select('id, user_id, organization_id, role, full_name, email')
    .eq('user_id', sessionUser.id)
    .single();

  let orgId = profile?.organization_id ?? userMetadata.organization_id ?? null;

  // Fallback: query by email if user_id lookup fails
  if (!orgId && sessionUser.email) {
    const { data: profileByEmail } = await supabaseAdmin
      .from('profiles')
      .select('id, user_id, organization_id, role, full_name, email')
      .eq('email', sessionUser.email)
      .single();
    orgId = profileByEmail?.organization_id ?? null;
  }

  return {
    isSuperAdmin: profile?.role === 'super_admin' || userMetadata.role === 'super_admin',
    userId: sessionUser.id,
    userEmail: sessionUser.email,
    organizationId: orgId,
    profile,
    userMetadata,
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
    const occupiedUnits = propertyUnits.filter((u) => u.occupancy_status === 'occupied').length;
    const rentRoll = propertyUnits.reduce((sum, unit) => sum + Number(unit.rent_amount ?? 0), 0);
    const storedUnitCount = Number(row.unit_count ?? 0);
    const totalUnits = storedUnitCount > 0 ? storedUnitCount : propertyUnits.length;
    return {
      ...row,
      unit_count: totalUnits,
      occupied_units: occupiedUnits,
      tenant_count: tenantsByProperty[row.id] ?? 0,
      rent_roll: rentRoll,
    };
  });
}

async function assertPropertyAccess(propertyId: string, authContext: AuthContext) {
  const property = await getPropertyById(propertyId);
  if (!property) return null;

  if (!authContext.isSuperAdmin) {
    // Check if user is an agent with access to this property
    if (authContext.profile?.role === 'agent' || authContext.userMetadata?.role === 'agent') {
      if (propertyId !== authContext.userMetadata?.property_id) {
        return forbidden('You can only manage properties assigned to you.');
      }
    } else if (property.organization_id !== authContext.organizationId) {
      return forbidden('You can only manage properties in your own landlord workspace.');
    }
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
      } else if (authContext.organizationId) {
        // Project managers see properties in their organization
        query = query.eq('organization_id', authContext.organizationId);
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
    const { name, address, unitCount, amenities, ownershipInfo } = body;

    if (!name?.trim() || !address?.trim()) {
      return NextResponse.json({ message: 'Property name and address are required.' }, { status: 400 });
    }

    const authContext = await getAuthContext(request);

    // Debug: log auth context for property creation
    console.log('Property POST authContext:', { 
      isSuperAdmin: authContext.isSuperAdmin, 
      userId: authContext.userId, 
      organizationId: authContext.organizationId 
    });

    if (!authContext.isSuperAdmin) {
      let orgId = authContext.organizationId;

      // If no org_id, create one and update profile
      if (!orgId && authContext.userId) {
        const { data: newOrg } = await supabaseAdmin
          .from('organizations')
          .insert({ name: `${authContext.userEmail?.split('@')[0] ?? 'PM'}_Organization` })
          .select('id')
          .single();
        orgId = newOrg?.id ?? null;

        // Update profile with org
        const { data: profile } = await supabaseAdmin
          .from('profiles')
          .select('id')
          .eq('user_id', authContext.userId)
          .single();

if (profile && orgId && authContext.userId) {
           await supabaseAdmin
             .from('profiles')
             .update({ organization_id: orgId, role: 'project_manager' })
             .eq('id', profile.id);
           
           // Also update auth user metadata for session consistency
           await supabaseAdmin.auth.admin.updateUserById(authContext.userId, {
             user_metadata: { 
               organization_id: orgId,
               role: 'project_manager'
             }
           });
         }
      }

      if (!orgId) {
        return NextResponse.json({ message: 'Unable to create property - no organization assigned. Please contact support.' }, { status: 403 });
      }

      const result = await supabaseAdmin
        .from('properties')
        .insert({
          name: name.trim(),
          address: address.trim(),
          unit_count: unitCount ? Number(unitCount) : 0,
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

    // Super admin can create without organization
    const result = await supabaseAdmin
      .from('properties')
      .insert({
        name: name.trim(),
        address: address.trim(),
        unit_count: unitCount ? Number(unitCount) : 0,
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
  try {
    const body = await request.json();
    const propertyId = body.id;

    if (!propertyId) {
      return NextResponse.json({ message: 'Property id is required.' }, { status: 400 });
    }

    const { name, address, unitCount, amenities, ownershipInfo } = body;

    const authContext = await getAuthContext(request);
    const property = await assertPropertyAccess(propertyId, authContext);
    if (!property) {
      return NextResponse.json({ message: 'You can only manage properties in your own landlord workspace.' }, { status: 403 });
    }

    const result = await supabaseAdmin
      .from('properties')
      .update({
        name: name?.trim() ?? undefined,
        address: address?.trim() ?? undefined,
        unit_count: unitCount !== undefined ? Number(unitCount) : undefined,
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
    const property = await assertPropertyAccess(propertyId, authContext);
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