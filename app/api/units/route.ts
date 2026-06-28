import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL ?? '';
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? '';
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY ?? '';

if (!supabaseUrl || !supabaseAnonKey || !serviceRoleKey) {
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

  // Method 2: Try cookie-based session
  if (!sessionUser && cookie) {
    try {
      const supabaseAuth = createClient(supabaseUrl, supabaseAnonKey, {
        global: { headers: { cookie } },
      });
      const { data: { user } } = await supabaseAuth.auth.getUser();
      sessionUser = user;
    } catch (e) {}
  }

  if (!sessionUser) {
    return { isSuperAdmin: false, profile: null, organizationId: null };
  }

  const userMetadata = sessionUser.user_metadata || {};

  const { data: profile } = await supabaseAdmin
    .from('profiles')
    .select('id, user_id, organization_id, role, full_name, email')
    .eq('user_id', sessionUser.id)
    .single();

  let orgId = profile?.organization_id ?? userMetadata.organization_id ?? null;

  // Fallback: query by email
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
    profile,
    organizationId: orgId,
  };
}

export async function GET(request: NextRequest) {
  try {
    const authContext = await getAuthContext(request);
    const propertyId = request.nextUrl.searchParams.get('propertyId');

    let query = supabaseAdmin
      .from('units')
      .select(`
        id,
        property_id,
        unit_number,
        rent_amount,
        occupancy_status,
        created_at,
        tenants(id, full_name, email, lease_start, lease_end)
      `);

    if (!authContext.isSuperAdmin) {
      if (!authContext.organizationId) {
        return NextResponse.json({ units: [] });
      }

      // Get properties in this organization
      const { data: orgProps } = await supabaseAdmin
        .from('properties')
        .select('id')
        .eq('organization_id', authContext.organizationId);
      const propIds = (orgProps ?? []).map((p: any) => p.id);

      if (propIds.length === 0) {
        return NextResponse.json({ units: [] });
      }

      if (propertyId) {
        query = query.eq('property_id', propertyId);
      } else {
        query = query.in('property_id', propIds);
      }
    } else if (propertyId) {
      query = query.eq('property_id', propertyId);
    }

    const { data: units, error } = await query.order('unit_number', { ascending: true });

    if (error) {
      return NextResponse.json({ message: error.message }, { status: 500 });
    }

    const processedUnits = (units ?? []).map((unit: any) => ({
      id: unit.id,
      property_id: unit.property_id,
      unit_number: unit.unit_number,
      rent_amount: Number(unit.rent_amount ?? 0),
      occupancy_status: unit.occupancy_status ?? 'vacant',
      created_at: unit.created_at,
      tenant: unit.tenants?.full_name ?? null,
      tenant_email: unit.tenants?.email ?? null,
      lease_start: unit.tenants?.lease_start ?? null,
      lease_end: unit.tenants?.lease_end ?? null,
    }));

    return NextResponse.json({ units: processedUnits });
  } catch (error: any) {
    return NextResponse.json({ message: error.message ?? 'Unable to fetch units.' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { propertyId, unitNumber, rentAmount, unitType, size, agentEmail, occupancyStatus } = body;

    if (!propertyId || !unitNumber) {
      return NextResponse.json({ message: 'Property ID and unit number are required.' }, { status: 400 });
    }

    const authContext = await getAuthContext(request);
    if (!authContext.isSuperAdmin) {
      if (!authContext.organizationId) {
        return NextResponse.json({ message: 'Unable to verify property access.' }, { status: 403 });
      }
      const { data: prop } = await supabaseAdmin
        .from('properties')
        .select('id')
        .eq('id', propertyId)
        .eq('organization_id', authContext.organizationId)
        .maybeSingle();

      if (!prop) {
        return NextResponse.json({ message: 'You can only add units to properties in your own landlord workspace.' }, { status: 403 });
      }
    }

    const result = await supabaseAdmin.from('units').insert({
      property_id: propertyId,
      unit_number: unitNumber,
      rent_amount: rentAmount ?? 0,
      unit_type: unitType ?? 'single-room',
      size,
      agent_email: agentEmail,
      occupancy_status: occupancyStatus ?? 'vacant',
    }).select().single();

    if (result.error) {
      return NextResponse.json({ message: result.error.message }, { status: 500 });
    }

    return NextResponse.json({ unit: result.data, message: 'Unit created.' }, { status: 201 });
  } catch (error: any) {
    return NextResponse.json({ message: error.message ?? 'Unable to create unit.' }, { status: 500 });
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const body = await request.json();
    const { id, unitNumber, rentAmount, size, agentEmail, occupancyStatus } = body;

    if (!id) {
      return NextResponse.json({ message: 'Unit ID is required.' }, { status: 400 });
    }

    const authContext = await getAuthContext(request);
    if (!authContext.isSuperAdmin) {
      if (!authContext.organizationId) {
        return NextResponse.json({ message: 'You can only manage units in your own landlord workspace.' }, { status: 403 });
      }
      const { data: unitProp } = await supabaseAdmin
        .from('units')
        .select('property_id, properties!inner(organization_id)')
        .eq('id', id)
        .eq('properties.organization_id', authContext.organizationId)
        .maybeSingle();

      if (!unitProp) {
        return NextResponse.json({ message: 'You can only manage units in your own landlord workspace.' }, { status: 403 });
      }
    }

    const updates: Record<string, any> = {};
    if (unitNumber !== undefined) updates.unit_number = unitNumber;
    if (rentAmount !== undefined) updates.rent_amount = rentAmount;
    if (size !== undefined) updates.size = size;
    if (agentEmail !== undefined) updates.agent_email = agentEmail;
    if (occupancyStatus !== undefined) updates.occupancy_status = occupancyStatus;

    const result = await supabaseAdmin.from('units').update(updates).eq('id', id).select().single();

    if (result.error) {
      return NextResponse.json({ message: result.error.message }, { status: 500 });
    }

    return NextResponse.json({ unit: result.data, message: 'Unit updated.' });
  } catch (error: any) {
    return NextResponse.json({ message: error.message ?? 'Unable to update unit.' }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const id = request.nextUrl.searchParams.get('id');

    if (!id) {
      return NextResponse.json({ message: 'Unit ID is required.' }, { status: 400 });
    }

    const authContext = await getAuthContext(request);
    if (!authContext.isSuperAdmin) {
      if (!authContext.organizationId) {
        return NextResponse.json({ message: 'You can only manage units in your own landlord workspace.' }, { status: 403 });
      }
      const { data: unitProp } = await supabaseAdmin
        .from('units')
        .select('property_id, properties!inner(organization_id)')
        .eq('id', id)
        .eq('properties.organization_id', authContext.organizationId)
        .maybeSingle();

      if (!unitProp) {
        return NextResponse.json({ message: 'You can only manage units in your own landlord workspace.' }, { status: 403 });
      }
    }

    const result = await supabaseAdmin.from('units').delete().eq('id', id);

    if (result.error) {
      return NextResponse.json({ message: result.error.message }, { status: 500 });
    }

    return NextResponse.json({ message: 'Unit deleted.' });
  } catch (error: any) {
    return NextResponse.json({ message: error.message ?? 'Unable to delete unit.' }, { status: 500 });
  }
}