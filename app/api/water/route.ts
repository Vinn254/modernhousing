import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

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

  if (authorization?.startsWith('Bearer ')) {
    const token = authorization.split(' ')[1];
    const decoded = decodeJWT(token);
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

  if (!sessionUser) return { isSuperAdmin: false, sessionUser: null, userMetadata: {}, userId: undefined };

  const userMetadata = sessionUser.user_metadata || {};
  
  // Get organization_id from profile fallback
  let orgId = userMetadata.organization_id ?? null;
  if (!orgId && sessionUser.email) {
    const { data: profileByEmail } = await supabaseAdmin
      .from('profiles')
      .select('organization_id')
      .eq('email', sessionUser.email)
      .single();
    orgId = profileByEmail?.organization_id ?? null;
  }
  
  return {
    isSuperAdmin: userMetadata.role === 'super_admin',
    sessionUser,
    userMetadata,
    userId: sessionUser.id,
    organizationId: orgId,
  };
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { unitId, currentReading, monthDue } = body;

    if (!unitId || currentReading === undefined) {
      return NextResponse.json({ message: 'Unit ID and current reading are required.' }, { status: 400 });
    }

    const authContext = await getAuthContext(request);
    const userMetadata = authContext.userMetadata || {};
    const isAgent = userMetadata?.role === 'agent';
    const agentPropertyId = isAgent ? userMetadata?.property_id : null;

    const { data: unit, error: unitError } = await supabaseAdmin
      .from('units')
      .select('id, property_id, previous_water_reading, current_water_reading')
      .eq('id', unitId)
      .single();

    if (unitError) {
      console.error('Unit lookup error:', unitError);
      return NextResponse.json({ message: 'Unit not found.', error: unitError.message, unitId }, { status: 404 });
    }
    if (!unit) {
      return NextResponse.json({ message: 'Unit not found.', unitId }, { status: 404 });
    }

    if (isAgent && agentPropertyId !== unit.property_id) {
      return NextResponse.json({ message: 'You can only record meter readings for units in your assigned property.' }, { status: 403 });
    }

    // For landlords - verify unit belongs to their properties (created_by or organization)
    if (!isAgent && !authContext.isSuperAdmin) {
      if (authContext.organizationId) {
        const { data: unitOrgCheck } = await supabaseAdmin
          .from('units')
          .select('id, property_id, properties!inner(organization_id)')
          .eq('id', unitId)
          .eq('properties.organization_id', authContext.organizationId)
          .single();
        if (!unitOrgCheck) {
          return NextResponse.json({ message: 'You can only record meter readings for units in your landlord workspace.' }, { status: 403 });
        }
      } else if (authContext.userId) {
        const { data: unitCreatedCheck } = await supabaseAdmin
          .from('units')
          .select('id, property_id, properties!inner(created_by)')
          .eq('id', unitId)
          .eq('properties.created_by', authContext.userId)
          .single();
        if (!unitCreatedCheck) {
          return NextResponse.json({ message: 'You can only record meter readings for units in properties you created.' }, { status: 403 });
        }
      }
    }

    const consumption = Math.max(0, Number(currentReading) - Number(unit.previous_water_reading || 0));
    
    if (consumption === 0) {
      return NextResponse.json({ message: 'Consumption is 0 - no bill generated.' }, { status: 200 });
    }

    let amount: number;
    if (consumption <= 6) {
      amount = 88;
    } else if (consumption <= 20) {
      amount = 132;
    } else if (consumption <= 50) {
      amount = 137;
    } else if (consumption <= 100) {
      amount = 148;
    } else if (consumption <= 300) {
      amount = 165;
    } else {
      amount = 0;
    }

    const { error: updateError } = await supabaseAdmin
      .from('units')
      .update({
        previous_water_reading: unit.current_water_reading || 0,
        current_water_reading: Number(currentReading),
        last_meter_update: new Date().toISOString(),
      })
      .eq('id', unitId);

    if (updateError) {
      return NextResponse.json({ message: `Failed to update meter: ${updateError.message}` }, { status: 500 });
    }

    const { data: tenant } = await supabaseAdmin
      .from('tenants')
      .select('id')
      .eq('unit_id', unitId)
      .single();

    if (tenant?.id) {
      const { error: invoiceError } = await supabaseAdmin
        .from('invoices')
        .insert({
          tenant_id: tenant.id,
          property_id: unit.property_id,
          invoice_type: 'water',
          description: `Water bill for ${monthDue || 'current period'}`,
          amount,
          water_consumption: consumption,
          month_due: monthDue || null,
          due_date: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10),
        });

      if (invoiceError) {
        return NextResponse.json({ message: `Failed to create invoice: ${invoiceError.message}` }, { status: 500 });
      }

      const { error: billError } = await supabaseAdmin
        .from('bills')
        .insert({
          tenant_id: tenant.id,
          unit_id: unitId,
          property_id: unit.property_id,
          description: `Water bill for ${monthDue || 'current period'}`,
          month_due: monthDue || null,
          due_amount: amount,
          paid_amount: 0,
          penalty_fee: 0,
          balance: amount,
          transaction_type: 'water',
          transaction_number: `WTR-${Date.now().toString().slice(-8)}`,
          payment_date: null,
          payment_method: null,
          reference_number: null,
        });

      if (billError) {
        return NextResponse.json({ message: `Failed to create bill: ${billError.message}` }, { status: 500 });
      }

      await supabaseAdmin.from('notifications').insert({
        tenant_id: tenant.id,
        property_id: unit.property_id,
        recipient: 'tenant',
        type: 'water_bill',
        message: `Your water bill of ${amount.toLocaleString()} KES for ${consumption} units has been generated.`,
        status: 'sent',
      });
    }

    return NextResponse.json({
      message: 'Water meter reading recorded and bill generated.',
      consumption,
      amount,
    }, { status: 200 });
  } catch (error: any) {
    return NextResponse.json({ message: error.message ?? 'Unable to record meter reading.' }, { status: 500 });
  }
}

export async function GET(request: NextRequest) {
  try {
    const authContext = await getAuthContext(request);
    const propertyId = request.nextUrl.searchParams.get('propertyId');

    const userMetadata = authContext.userMetadata || {};
    const isAgent = userMetadata?.role === 'agent';

    // For agents - check property access
    if (isAgent) {
      if (!userMetadata?.property_id) {
        return NextResponse.json({ units: [] });
      }
      if (propertyId && userMetadata.property_id !== propertyId) {
        return NextResponse.json({ message: 'Access denied to this property.' }, { status: 403 });
      }
    }

    let effectivePropertyIds = propertyId ? [propertyId] : [];

    // For landlords without propertyId - filter by properties created_by
    if (!isAgent && !propertyId && authContext.userId) {
      const { data: userProps } = await supabaseAdmin
        .from('properties')
        .select('id')
        .eq('created_by', authContext.userId);
      effectivePropertyIds = (userProps ?? []).map((p: any) => p.id);
    }

    // For landlords - also filter by created_by when propertyId is provided
    if (!isAgent && propertyId && authContext.userId && !authContext.isSuperAdmin) {
      const { data: propCheck } = await supabaseAdmin
        .from('properties')
        .select('id')
        .eq('id', propertyId)
        .eq('created_by', authContext.userId)
        .single();
      if (!propCheck) {
        return NextResponse.json({ units: [] });
      }
    }

    if (effectivePropertyIds.length === 0 && !propertyId) {
      return NextResponse.json({ units: [] });
    }

    const { data: units, error } = await supabaseAdmin
      .from('units')
      .select('id, unit_number, current_water_reading, previous_water_reading, last_meter_update, property_id')
      .in('property_id', propertyId ? [propertyId] : effectivePropertyIds)
      .order('unit_number');

    if (error) throw error;

    return NextResponse.json({ units });
  } catch (error: any) {
    return NextResponse.json({ message: error.message ?? 'Unable to fetch units.' }, { status: 500 });
  }
}