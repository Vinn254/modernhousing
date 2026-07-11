import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL ?? '';
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? '';
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY ?? '';

if (!supabaseUrl || !serviceRoleKey) throw new Error('Missing Supabase server environment variables');

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
      const supabaseAuth = createClient(supabaseUrl, supabaseAnonKey!, { global: { headers: { cookie } } });
      const { data: { user } } = await supabaseAuth.auth.getUser();
      sessionUser = user;
    } catch (e) {}
  }

  if (!sessionUser) return { isSuperAdmin: false, sessionUser: null, userMetadata: {} };

  const userMetadata = sessionUser.user_metadata || {};
  return {
    isSuperAdmin: userMetadata.role === 'super_admin',
    sessionUser,
    userMetadata,
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

    // Get unit first
    const { data: unit, error: unitError } = await supabaseAdmin
      .from('units')
      .select('id, previous_water_reading, current_water_reading, property_id')
      .eq('id', unitId)
      .single();

    if (unitError) {
      console.error('Unit lookup error:', unitError);
      return NextResponse.json({ message: 'Unit not found.', error: unitError.message, unitId }, { status: 404 });
    }
    if (!unit) {
      return NextResponse.json({ message: 'Unit not found.', unitId }, { status: 404 });
    }

    // Authorization check for agents
    if (isAgent && agentPropertyId !== unit.property_id) {
      return NextResponse.json({ message: 'You can only record meter readings for units in your assigned property.' }, { status: 403 });
    }

    // Get property water rate
    const { data: propertyData, error: propError } = await supabaseAdmin
      .from('properties')
      .select('id, water_rate')
      .eq('id', unit.property_id)
      .single();

    if (propError || !propertyData) {
      return NextResponse.json({ message: 'Property not found.' }, { status: 404 });
    }

    const previousReading = Number(unit.previous_water_reading || 0);
    const current = Number(currentReading);
    const consumption = current - previousReading;

    if (consumption < 0) {
      return NextResponse.json({ message: 'Current reading cannot be less than previous reading.' }, { status: 400 });
    }

    const waterRate = Number(propertyData.water_rate || 150);
    const amount = consumption * waterRate;

    // Update unit with new readings
    const { error: updateError } = await supabaseAdmin
      .from('units')
      .update({
        previous_water_reading: unit.current_water_reading || 0,
        current_water_reading: currentReading,
        last_meter_update: new Date().toISOString(),
      })
      .eq('id', unitId);

    if (updateError) {
      return NextResponse.json({ message: `Failed to update meter: ${updateError.message}` }, { status: 500 });
    }

    // Get tenant for this unit (if any)
    const { data: tenant } = await supabaseAdmin
      .from('tenants')
      .select('id')
      .eq('unit_id', unitId)
      .single();

    // Create invoice for the tenant
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

      // Also create a bill record
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

      // Send notification
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
      waterRate,
    }, { status: 200 });
  } catch (error: any) {
    return NextResponse.json({ message: error.message ?? 'Unable to record meter reading.' }, { status: 500 });
  }
}

export async function GET(request: NextRequest) {
  try {
    const authContext = await getAuthContext(request);
    const propertyId = request.nextUrl.searchParams.get('propertyId');

    if (!propertyId) {
      return NextResponse.json({ units: [] });
    }

    // For agents, verify property access
    const userMetadata = authContext.userMetadata || {};
    const isAgent = userMetadata?.role === 'agent';
    if (isAgent && userMetadata?.property_id !== propertyId) {
      return NextResponse.json({ message: 'Access denied to this property.' }, { status: 403 });
    }

    const { data: units, error } = await supabaseAdmin
      .from('units')
      .select('id, unit_number, current_water_reading, previous_water_reading, last_meter_update, property_id')
      .eq('property_id', propertyId)
      .order('unit_number');

    if (error) throw error;

    return NextResponse.json({ units });
  } catch (error: any) {
    return NextResponse.json({ message: error.message ?? 'Unable to fetch units.' }, { status: 500 });
  }
}