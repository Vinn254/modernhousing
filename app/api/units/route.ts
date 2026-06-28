import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import {
  badRequest,
  requestError,
} from '../../../lib/supabaseAdmin';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL ?? '';
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY ?? '';

if (!supabaseUrl || !serviceRoleKey) {
  throw new Error('Missing Supabase server environment variables');
}

const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey);

async function getAuthContext(request: NextRequest) {
  const headers: Record<string, string> = {
    cookie: request.headers.get('cookie') ?? '',
  };
  const authorization = request.headers.get('authorization') ?? request.headers.get('Authorization');
  if (authorization) headers.Authorization = authorization;

  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? '';
  const supabaseAuth = createClient(supabaseUrl, supabaseAnonKey, {
    global: { headers },
  });

  const { data: sessionData, error: sessionError } = await supabaseAuth.auth.getSession();

  if (sessionError || !sessionData.session) {
    return { isSuperAdmin: false, profile: null };
  }

  const { data: profile } = await supabaseAdmin
    .from('profiles')
    .select('id, user_id, organization_id, role, full_name, email')
    .eq('user_id', sessionData.session.user.id)
    .single();

  // Fallback: query by email if user_id lookup fails
  if (!profile && sessionData.session.user.email) {
    const { data: profileByEmail } = await supabaseAdmin
      .from('profiles')
      .select('id, user_id, organization_id, role, full_name, email')
      .eq('email', sessionData.session.user.email)
      .single();
    return {
      isSuperAdmin: profileByEmail?.role === 'super_admin',
      profile: profileByEmail,
      userId: sessionData.session.user.id,
    };
  }

  return {
    isSuperAdmin: profile?.role === 'super_admin',
    profile,
    userId: sessionData.session.user.id,
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
      const userId = authContext.profile?.user_id ?? authContext.userId;
      if (!userId) {
        return NextResponse.json({ units: [] });
      }

      // Get properties owned by this user
      const { data: userProps } = await supabaseAdmin
        .from('properties')
        .select('id')
        .eq('user_id', userId);
      const propIds = (userProps ?? []).map((p: any) => p.id);

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
      return requestError(error);
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
      const { propertyId, unitNumber, rentAmount, size, agentEmail, occupancyStatus } = body;

      if (!propertyId || !unitNumber) {
        return badRequest('Property ID and unit number are required.');
      }

      const authContext = await getAuthContext(request);
      if (!authContext.isSuperAdmin) {
        const userId = authContext.profile?.user_id ?? authContext.userId;
        if (!userId) {
          return NextResponse.json({ message: 'Unable to verify property access.' }, { status: 403 });
        }
        const { data: prop } = await supabaseAdmin
          .from('properties')
          .select('id')
          .eq('id', propertyId)
          .eq('user_id', userId)
          .maybeSingle();

        if (!prop) {
          return NextResponse.json({ message: 'You can only add units to properties in your own landlord workspace.' }, { status: 403 });
        }
      }

      const result = await supabaseAdmin.from('units').insert({
        property_id: propertyId,
        unit_number: unitNumber,
        rent_amount: rentAmount ?? 0,
        size,
        agent_email: agentEmail,
        occupancy_status: occupancyStatus ?? 'vacant',
      }).select().single();

      if (result.error) {
        return requestError(result.error);
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
      return badRequest('Unit ID is required.');
    }

    const authContext = await getAuthContext(request);
    if (!authContext.isSuperAdmin) {
      const userId = authContext.profile?.user_id ?? authContext.userId;
      if (!userId) {
        return NextResponse.json({ message: 'You can only manage units in your own landlord workspace.' }, { status: 403 });
      }
      const { data: unitProp } = await supabaseAdmin
        .from('units')
        .select('property_id, properties!inner(user_id)')
        .eq('id', id)
        .eq('properties.user_id', userId)
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
      return requestError(result.error);
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
      return badRequest('Unit ID is required.');
    }

    const authContext = await getAuthContext(request);
    if (!authContext.isSuperAdmin) {
      const userId = authContext.profile?.user_id ?? authContext.userId;
      if (!userId) {
        return NextResponse.json({ message: 'You can only manage units in your own landlord workspace.' }, { status: 403 });
      }
      const { data: unitProp } = await supabaseAdmin
        .from('units')
        .select('property_id, properties!inner(user_id)')
        .eq('id', id)
        .eq('properties.user_id', userId)
        .maybeSingle();

      if (!unitProp) {
        return NextResponse.json({ message: 'You can only manage units in your own landlord workspace.' }, { status: 403 });
      }
    }

    const result = await supabaseAdmin.from('units').delete().eq('id', id);

    if (result.error) {
      return requestError(result.error);
    }

    return NextResponse.json({ message: 'Unit deleted.' });
  } catch (error: any) {
    return NextResponse.json({ message: error.message ?? 'Unable to delete unit.' }, { status: 500 });
  }
  }