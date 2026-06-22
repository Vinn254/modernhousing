import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL ?? '';
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY ?? '';

if (!supabaseUrl || !serviceRoleKey) {
  throw new Error('Missing Supabase server environment variables');
}

const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey);

export async function GET(request: NextRequest) {
  try {
    const propertyId = request.nextUrl.searchParams.get('propertyId');

    let selectQuery = 'id, full_name, email, lease_start, lease_end, units!inner(unit_number, properties!inner(name, address))';
    let query: any = supabaseAdmin.from('tenants').select(selectQuery);

    if (propertyId) {
      query = query.eq('units.property_id', propertyId);
    }

    const { data, error } = await query.order('created_at', { ascending: false });

    if (error) throw error;

    const tenants = (data ?? []).map((tenant: any) => ({
      id: tenant.id,
      full_name: tenant.full_name,
      email: tenant.email,
      unit: tenant.units?.unit_number ?? '',
      property: tenant.units?.properties?.name ?? '',
      property_id: tenant.units?.property_id ?? '',
      address: tenant.units?.properties?.address ?? '',
      lease_start: tenant.lease_start,
      lease_end: tenant.lease_end,
    }));

    return NextResponse.json({ tenants });
  } catch (error: any) {
    return NextResponse.json({ message: error.message ?? 'Unable to load tenants.' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  const body = await request.json();
  const { fullName, email, phone, unitId, propertyId, leaseStart, leaseEnd, depositAmount } = body;

  if (!fullName || !email || !leaseStart || !leaseEnd) {
    return NextResponse.json({ message: 'Missing required tenant fields.' }, { status: 400 });
  }

  let finalUnitId = unitId;

  if (propertyId) {
    const unitName = String(unitId || '').trim();
    if (unitName) {
      const { data: existingUnit } = await supabaseAdmin
        .from('units')
        .select('id')
        .eq('property_id', propertyId)
        .eq('unit_number', unitName)
        .single();

      if (existingUnit) {
        finalUnitId = existingUnit.id;
      } else {
        const unitResult = await supabaseAdmin.from('units').insert({
          property_id: propertyId,
          unit_number: unitName,
          rent_amount: 0,
          occupancy_status: 'occupied',
        }).select('id').single();

        if (unitResult.error) {
          return NextResponse.json({ message: `Unable to create unit: ${unitResult.error.message}` }, { status: 500 });
        }
        finalUnitId = unitResult.data.id;
      }
    }
  }

  const result = await supabaseAdmin.from('tenants').insert({
    full_name: fullName,
    email,
    phone,
    unit_id: finalUnitId,
    lease_start: leaseStart,
    lease_end: leaseEnd,
    deposit_amount: depositAmount,
  });

  if (result.error) {
    return NextResponse.json({ message: result.error.message }, { status: 500 });
  }

  return NextResponse.json({ message: 'Tenant created.', unitId: finalUnitId }, { status: 201 });
}

export async function PATCH(request: NextRequest) {
  const body = await request.json();
  const { id, fullName, email, phone, leaseStart, leaseEnd, status } = body;

  if (!id) {
    return NextResponse.json({ message: 'Tenant ID is required.' }, { status: 400 });
  }

  const updates: Record<string, any> = {};
  if (fullName) updates.full_name = fullName;
  if (email) updates.email = email;
  if (phone !== undefined) updates.phone = phone;
  if (leaseStart) updates.lease_start = leaseStart;
  if (leaseEnd) updates.lease_end = leaseEnd;
  if (status) updates.status = status;

  const result = await supabaseAdmin.from('tenants').update(updates).eq('id', id).select().single();

  if (result.error) {
    return NextResponse.json({ message: result.error.message }, { status: 500 });
  }

  return NextResponse.json({ message: 'Tenant updated.', tenant: result.data });
}

export async function DELETE(request: NextRequest) {
  const id = request.nextUrl.searchParams.get('id');

  if (!id) {
    return NextResponse.json({ message: 'Tenant ID is required.' }, { status: 400 });
  }

  const result = await supabaseAdmin.from('tenants').delete().eq('id', id);

  if (result.error) {
    return NextResponse.json({ message: result.error.message }, { status: 500 });
  }

  return NextResponse.json({ message: 'Tenant removed.' });
}
