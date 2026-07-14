import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { logAuditEvent } from '../../../lib/auditLogger';

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

  // Method 3: Try session from cookie (fallback)
  if (!sessionUser && cookie) {
    try {
      const supabaseAuth = createClient(supabaseUrl, supabaseAnonKey, {
        global: { headers: { cookie } },
      });
      const { data: { session } } = await supabaseAuth.auth.getSession();
      sessionUser = session?.user;
    } catch (e) {}
  }

  if (!sessionUser) {
    return { isSuperAdmin: false, profile: null, organizationId: null };
  }

  const userMetadata = sessionUser.user_metadata || {};

  const { data: profile } = await supabaseAdmin
    .from('profiles')
    .select('id, user_id, organization_id, role, full_name, email, user_metadata')
    .eq('user_id', sessionUser.id)
    .single();

  let orgId = profile?.organization_id ?? userMetadata.organization_id ?? null;

  return {
    isSuperAdmin: profile?.role === 'super_admin' || userMetadata.role === 'super_admin',
    profile,
    organizationId: orgId,
    sessionUser,
    userId: sessionUser?.id,
    userEmail: sessionUser?.email,
  };
}

export async function GET(request: NextRequest) {
  try {
    const authContext = await getAuthContext(request);
    const propertyId = request.nextUrl.searchParams.get('propertyId');

    // Get all properties the user owns/assigned to
    let propertyIds: string[] = [];
    
    if (authContext.isSuperAdmin) {
      // Super admin - can see all units
    } else {
      // Get the user's profile with organization_id (fresh from DB)
      const sessionUser = authContext.sessionUser;
      const userId = sessionUser?.id ?? '';
      
      const { data: freshProfile } = await supabaseAdmin
        .from('profiles')
        .select('id, organization_id')
        .eq('user_id', userId)
        .single();
      
      const orgId = freshProfile?.organization_id || authContext.organizationId;
      
      if (orgId) {
        const { data: orgProps } = await supabaseAdmin
          .from('properties')
          .select('id')
          .eq('organization_id', orgId);
        propertyIds = (orgProps ?? []).map((p: any) => p.id);
      }
      
      // For agents, get units from assigned property
      const userMetadata = sessionUser?.user_metadata || authContext.profile?.user_metadata || {};
      if (userMetadata?.property_id && !propertyIds.includes(userMetadata.property_id)) {
        propertyIds.push(userMetadata.property_id);
      }
      
      if (propertyIds.length === 0 && !propertyId) {
        return NextResponse.json({ units: [] });
      }
    }

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

    if (propertyId) {
      query = query.eq('property_id', propertyId);
    } else if (propertyIds.length > 0) {
      query = query.in('property_id', propertyIds);
    } else {
      query = query.limit(50);
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
      unit_type: unit.unit_type ?? null,
      created_at: unit.created_at,
      previous_water_reading: unit.previous_water_reading ?? null,
      current_water_reading: unit.current_water_reading ?? null,
      last_meter_update: unit.last_meter_update ?? null,
      tenant: unit.tenants?.full_name ?? null,
      tenant_email: unit.tenants?.email ?? null,
      tenant_id: unit.tenants?.id ?? null,
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
    const userMetadata = authContext.sessionUser?.user_metadata || authContext.profile?.user_metadata || {};

    if (!authContext.isSuperAdmin) {
      // For agents without organization: use property_id from user_metadata
      if (!authContext.organizationId && userMetadata?.property_id && userMetadata.property_id !== propertyId) {
        return NextResponse.json({ message: 'You can only add units to your assigned property.' }, { status: 403 });
      }

      // Verify property exists
      const { data: prop } = await supabaseAdmin
        .from('properties')
        .select('id, organization_id')
        .eq('id', propertyId)
        .maybeSingle();

      if (!prop) {
        return NextResponse.json({ message: 'Property not found.' }, { status: 404 });
      }

      // For landlords: check if property belongs to their organization
      if (authContext.organizationId && prop.organization_id !== authContext.organizationId) {
        return NextResponse.json({ message: 'You can only add units to properties in your own landlord workspace.' }, { status: 403 });
      }

      // For users without organization but with a valid property, allow access
      if (!authContext.organizationId && !userMetadata?.property_id) {
        // Check if user is a landlord/project_manager of this property via profile
        const { data: userProperty } = await supabaseAdmin
          .from('profiles')
          .select('id')
          .eq('user_id', authContext.sessionUser?.id ?? '')
          .eq('organization_id', prop.organization_id)
          .maybeSingle();

        if (!userProperty) {
          return NextResponse.json({ message: 'Unable to verify property access.' }, { status: 403 });
        }
      }
    }

    const insertData: any = {
      property_id: propertyId,
      unit_number: unitNumber,
      rent_amount: rentAmount ?? 0,
      size,
      agent_email: agentEmail,
      occupancy_status: occupancyStatus ?? 'vacant',
    };
    if (unitType) insertData.unit_type = unitType;

    const result = await supabaseAdmin.from('units').insert(insertData).select().single();

    if (result.error) {
      return NextResponse.json({ message: result.error.message }, { status: 500 });
    }

    // Log audit
    await logAuditEvent(
      authContext.userId,
      authContext.userEmail,
      'create',
      'unit',
      result.data?.id,
      { unit_number: unitNumber, property_id: propertyId, rent_amount: rentAmount }
    );

    return NextResponse.json({ unit: result.data, message: 'Unit created.' }, { status: 201 });
  } catch (error: any) {
    return NextResponse.json({ message: error.message ?? 'Unable to create unit.' }, { status: 500 });
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const id = request.nextUrl.searchParams.get('id');
    const body = await request.json().catch(() => ({}));
    const { unitNumber, rentAmount, size, agentEmail, occupancyStatus, unitType } = body || {};

    if (!id) {
      return NextResponse.json({ message: 'Unit ID is required.', receivedId: id }, { status: 400 });
    }

    const authContext = await getAuthContext(request);
    const userMetadata = authContext.sessionUser?.user_metadata || authContext.profile?.user_metadata || {};

    if (!authContext.isSuperAdmin) {
      if (authContext.organizationId) {
        const { data: unitData } = await supabaseAdmin
          .from('units')
          .select('property_id, properties!inner(organization_id)')
          .eq('id', id)
          .eq('properties.organization_id', authContext.organizationId)
          .maybeSingle();

        if (!unitData) {
          return NextResponse.json({ message: 'You can only manage units in your own landlord workspace.' }, { status: 403 });
        }
      } else if (userMetadata?.property_id) {
        const { data: unitData } = await supabaseAdmin
          .from('units')
          .select('property_id')
          .eq('id', id)
          .eq('property_id', userMetadata.property_id)
          .maybeSingle();

        if (!unitData) {
          return NextResponse.json({ message: 'You can only manage units in your assigned property.' }, { status: 403 });
        }
      }
    }

    const updates: Record<string, any> = {};
    if (unitNumber !== undefined) updates.unit_number = unitNumber;
    if (rentAmount !== undefined) updates.rent_amount = rentAmount;
    if (size !== undefined) updates.size = size;
    if (agentEmail !== undefined) updates.agent_email = agentEmail;
    if (occupancyStatus !== undefined) updates.occupancy_status = occupancyStatus;
    if (unitType !== undefined) updates.unit_type = unitType;

    const result = await supabaseAdmin.from('units').update(updates).eq('id', id).select().single();

    if (result.error) {
      return NextResponse.json({ message: result.error.message }, { status: 500 });
    }

    // Log audit
    await logAuditEvent(
      authContext.userId,
      authContext.userEmail,
      'update',
      'unit',
      id,
      { unit_number: unitNumber, rent_amount: rentAmount, occupancy_status: occupancyStatus }
    );

    return NextResponse.json({ unit: result.data, message: 'Unit updated.' });
  } catch (error: any) {
    console.error('PATCH /api/units error:', error);
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
    const userMetadata = authContext.sessionUser?.user_metadata || authContext.profile?.user_metadata || {};

    if (!authContext.isSuperAdmin) {
      if (authContext.organizationId) {
        const { data: unitProp } = await supabaseAdmin
          .from('units')
          .select('property_id, properties!inner(organization_id)')
          .eq('id', id)
          .eq('properties.organization_id', authContext.organizationId)
          .maybeSingle();

        if (!unitProp) {
          return NextResponse.json({ message: 'You can only manage units in your own landlord workspace.' }, { status: 403 });
        }
      } else if (userMetadata?.property_id) {
        const { data: unitProp } = await supabaseAdmin
          .from('units')
          .select('property_id')
          .eq('id', id)
          .eq('property_id', userMetadata.property_id)
          .maybeSingle();

        if (!unitProp) {
          return NextResponse.json({ message: 'You can only manage units in your assigned property.' }, { status: 403 });
        }
      }
    }

    const result = await supabaseAdmin.from('units').delete().eq('id', id);

    if (result.error) {
      return NextResponse.json({ message: result.error.message }, { status: 500 });
    }

    // Log audit
    await logAuditEvent(
      authContext.userId,
      authContext.userEmail,
      'delete',
      'unit',
      id,
      { unitId: id }
    );

    return NextResponse.json({ message: 'Unit deleted.' });
  } catch (error: any) {
    return NextResponse.json({ message: error.message ?? 'Unable to delete unit.' }, { status: 500 });
  }
}
