import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

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

  const supabaseAuth = createClient(supabaseUrl, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? '', {
    global: { headers },
  });

  const { data: sessionData, error: sessionError } = await supabaseAuth.auth.getSession();

  if (sessionError || !sessionData.session) {
    return { isSuperAdmin: false, organization_id: null, profile: null };
  }

  const { data: profile } = await supabaseAdmin
    .from('profiles')
    .select('id, user_id, organization_id, role, full_name, email')
    .eq('user_id', sessionData.session.user.id)
    .single();

  let orgId = profile?.organization_id ?? null;

  if (!orgId && profile?.role === 'project_manager') {
    const { data: newOrg } = await supabaseAdmin
      .from('organizations')
      .insert({ name: `${sessionData.session.user.email?.split('@')[0] ?? 'Property Manager'} Organization` })
      .select('id')
      .single();
    orgId = newOrg?.id ?? null;

    if (orgId) {
      await supabaseAdmin
        .from('profiles')
        .update({ organization_id: orgId })
        .eq('id', profile.id);

      await supabaseAdmin
        .from('properties')
        .update({ organization_id: orgId })
        .eq('organization_id', null);
    }
  }

  return {
    isSuperAdmin: profile?.role === 'super_admin',
    organization_id: orgId,
    profile: orgId ? { ...profile, organization_id: orgId } : profile,
  };
}

export async function GET(request: NextRequest) {
  try {
    const authContext = await getAuthContext(request);

    if (authContext.profile && !authContext.isSuperAdmin && authContext.profile.organization_id) {
      const { data: orgProps } = await supabaseAdmin
        .from('properties')
        .select('id')
        .eq('organization_id', authContext.profile.organization_id);
      const propIds = (orgProps ?? []).map((p: any) => p.id);

      if (propIds.length > 0) {
        const { data, error } = await supabaseAdmin
          .from('tenants')
          .select('id, full_name, email, phone, lease_start, lease_end, units!inner(unit_number, properties(id, name, address))')
          .in('units.property_id', propIds)
          .order('created_at', { ascending: false });

        if (error) throw error;

        const tenants = (data ?? []).map((tenant: any) => ({
          id: tenant.id,
          full_name: tenant.full_name,
          email: tenant.email,
          phone: tenant.phone,
          unit: tenant.units?.unit_number ?? '',
          property: tenant.units?.properties?.name ?? '',
          property_id: tenant.units?.property_id ?? '',
          address: tenant.units?.properties?.address ?? '',
          lease_start: tenant.lease_start,
          lease_end: tenant.lease_end,
        }));

        return NextResponse.json({ tenants });
      }
      return NextResponse.json({ tenants: [] });
    }

    const { data, error } = await supabaseAdmin
      .from('tenants')
      .select('id, full_name, email, phone, lease_start, lease_end, units!inner(unit_number, properties(name, address))')
      .order('created_at', { ascending: false });

    if (error) throw error;

    const tenants = (data ?? []).map((tenant: any) => ({
      id: tenant.id,
      full_name: tenant.full_name,
      email: tenant.email,
      phone: tenant.phone,
      unit: tenant.units?.unit_number ?? '',
      property: tenant.units?.properties?.name ?? '',
      property_id: tenant.units?.properties?.id ?? '',
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
