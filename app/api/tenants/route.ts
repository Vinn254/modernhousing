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

interface AuthContext {
  isSuperAdmin: boolean;
  userId: string | undefined;
  organizationId: string | null;
  sessionUser: any | null;
}

async function getAuthContext(request: NextRequest): Promise<AuthContext> {
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

  if (!sessionUser) {
    return { isSuperAdmin: false, userId: undefined, organizationId: null, sessionUser: null };
  }

  const userMetadata = sessionUser.user_metadata || {};
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
    userId: sessionUser.id,
    organizationId: orgId,
    sessionUser,
  };
}

export async function GET(request: NextRequest) {
  try {
    const authContext = await getAuthContext(request);
    const urlPropertyId = request.nextUrl.searchParams.get('propertyId');

    // For agents, use property_id from user_metadata if no propertyId was passed
    const userMetadata = authContext.sessionUser?.user_metadata || {};
    const effectivePropertyId = urlPropertyId || (userMetadata?.role === 'agent' ? userMetadata?.property_id : null);

if (effectivePropertyId) {
       const { data: units, error: unitsError } = await supabaseAdmin.from('units').select('id').eq('property_id', effectivePropertyId);
       if (unitsError) throw unitsError;
       const unitIds = (units ?? []).map((u: any) => u.id);

       if (unitIds.length > 0) {
         const { data, error } = await supabaseAdmin
           .from('tenants')
           .select('id, full_name, email, phone, lease_start, lease_end, national_id, kra_pin, next_of_kin_id, units!inner(unit_number, properties(id, name, address))')
           .in('unit_id', unitIds)
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
           national_id: tenant.national_id,
           kra_pin: tenant.kra_pin,
           next_of_kin_id: tenant.next_of_kin_id,
         }));

         return NextResponse.json({ tenants });
       }
       return NextResponse.json({ tenants: [] });
     }
     return NextResponse.json({ tenants: [] });
    }

    if (!authContext.isSuperAdmin && !authContext.organizationId && !authContext.userId) {
      return NextResponse.json({ tenants: [] });
    }

    const { data: orgProps } = await supabaseAdmin
      .from('properties')
      .select('id')
      .eq('organization_id', authContext.organizationId ?? '');
    const propIds = (orgProps ?? []).map((p: any) => p.id);

    if (propIds.length > 0) {
      const { data: orgUnits } = await supabaseAdmin.from('units').select('id').in('property_id', propIds);
      const unitIds = (orgUnits ?? []).map((u: any) => u.id);

      if (unitIds.length > 0) {
        const { data, error } = await supabaseAdmin
          .from('tenants')
          .select('id, full_name, email, phone, lease_start, lease_end, national_id, kra_pin, next_of_kin_id, units!inner(unit_number, properties(id, name, address))')
          .in('unit_id', unitIds)
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
          national_id: tenant.national_id,
          kra_pin: tenant.kra_pin,
          next_of_kin_id: tenant.next_of_kin_id,
        }));

        return NextResponse.json({ tenants });
      }
      return NextResponse.json({ tenants: [] });
    }
    return NextResponse.json({ tenants: [] });
  } catch (error: any) {
    return NextResponse.json({ message: error.message ?? 'Unable to load tenants.' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  const body = await request.json();
  const { fullName, email, phone, unitId, propertyId, leaseStart, leaseEnd, depositAmount, unitNumber, nationalId, kraPin, nextOfKinId } = body;

  if (!fullName || !email || !leaseStart || !leaseEnd) {
    return NextResponse.json({ message: 'Missing required tenant fields.' }, { status: 400 });
  }

  const authContext = await getAuthContext(request);
  const userMetadata = authContext.sessionUser?.user_metadata || {};
  let finalUnitId = unitId;

  if (propertyId) {
    const isAgent = userMetadata?.role === 'agent';
    
    if (!authContext.isSuperAdmin) {
      if (isAgent) {
        if (userMetadata?.property_id !== propertyId) {
          return NextResponse.json({ message: 'You can only add tenants to your assigned property.' }, { status: 403 });
        }
        // Verify unit belongs to agent's property if unitId is provided
        if (unitId) {
          const { data: unitCheck } = await supabaseAdmin
            .from('units')
            .select('property_id')
            .eq('id', unitId)
            .maybeSingle();
          if (!unitCheck || unitCheck.property_id !== propertyId) {
            return NextResponse.json({ message: 'You can only assign tenants to units in your assigned property.' }, { status: 403 });
          }
        }
      } else if (authContext.organizationId) {
        const { data: prop } = await supabaseAdmin
          .from('properties')
          .select('id')
          .eq('id', propertyId)
          .eq('organization_id', authContext.organizationId)
          .maybeSingle();

        if (!prop) {
          return NextResponse.json({ message: 'You can only add tenants to properties in your own landlord workspace.' }, { status: 403 });
        }
      } else {
        return NextResponse.json({ message: 'Unable to verify property access.' }, { status: 403 });
      }
    }
  }

  if (propertyId && !finalUnitId && unitNumber) {
    const unitResult = await supabaseAdmin.from('units').insert({
      property_id: propertyId,
      unit_number: unitNumber,
      rent_amount: 0,
      occupancy_status: 'occupied',
    }).select('id').single();

    if (unitResult.error) {
      return NextResponse.json({ message: `Unable to create unit: ${unitResult.error.message}` }, { status: 500 });
    }
    finalUnitId = unitResult.data.id;
  } else if (propertyId && !finalUnitId) {
    const unitResult = await supabaseAdmin.from('units').insert({
      property_id: propertyId,
      unit_number: 'Unit',
      rent_amount: 0,
      occupancy_status: 'occupied',
    }).select('id').single();

    if (unitResult.error) {
      return NextResponse.json({ message: `Unable to create unit: ${unitResult.error.message}` }, { status: 500 });
    }
    finalUnitId = unitResult.data.id;
  }

  if (finalUnitId) {
    await supabaseAdmin
      .from('units')
      .update({ occupancy_status: 'occupied' })
      .eq('id', finalUnitId);
  }

  const result = await supabaseAdmin.from('tenants').insert({
    full_name: fullName,
    email,
    phone,
    unit_id: finalUnitId,
    lease_start: leaseStart,
    lease_end: leaseEnd,
    deposit_amount: depositAmount,
    national_id: nationalId || null,
    kra_pin: kraPin || null,
    next_of_kin_id: nextOfKinId || null,
  }).select('id').single();

  if (result.error) {
    return NextResponse.json({ message: result.error.message }, { status: 500 });
  }

  const tenantId = result.data?.id;

  if (tenantId && finalUnitId) {
    const { data: unitData } = await supabaseAdmin.from('units').select('*, properties!inner(name, address)').eq('id', finalUnitId).single();
    const agreementContent = `TENANCY AGREEMENT

Tenant: ${fullName}
Email: ${email}
Unit: ${unitData?.unit_number ?? ''} - ${unitData?.properties?.name ?? ''}
Address: ${unitData?.properties?.address ?? ''}

Lease Period: ${leaseStart} to ${leaseEnd}
Deposit: KSH ${depositAmount ?? 0}

Terms and Conditions:
1. Tenant agrees to pay rent on or before the 5th of each month.
2. Tenant is responsible for care of the premises and utilities.
3. Deposit is refundable upon vacating in good condition.
4. Notice period of 30 days required before lease expiry.
5. No subletting without written consent.

Please acknowledge this agreement by clicking "Accept" in your tenant portal.`;

    await supabaseAdmin.from('tenant_agreements').insert({
      tenant_id: tenantId,
      content: agreementContent,
      status: 'pending',
      created_at: new Date().toISOString(),
    });
  }

  return NextResponse.json({ message: 'Tenant created.', tenant: { id: tenantId, full_name: fullName, email, phone, lease_start: leaseStart, lease_end: leaseEnd, unit: finalUnitId, property: '' }, unitId: finalUnitId }, { status: 201 });
}

export async function PATCH(request: NextRequest) {
  try {
    const body = await request.json();
    const { id, fullName, email, phone, leaseStart, leaseEnd, status } = body;

    if (!id) {
      return NextResponse.json({ message: 'Tenant ID is required.' }, { status: 400 });
    }

    const authContext = await getAuthContext(request);
    const userMetadata = authContext.sessionUser?.user_metadata || {};
    const isAgent = userMetadata?.role === 'agent';
    
    if (!authContext.isSuperAdmin) {
      const agentPropertyId = isAgent ? userMetadata?.property_id : null;
      
      if (isAgent && agentPropertyId) {
        const { data: tenantCheck } = await supabaseAdmin
          .from('tenants')
          .select('units!inner(property_id)')
          .eq('id', id)
          .maybeSingle();

        const tenantPropertyId = tenantCheck?.units?.[0]?.property_id;
        if (!tenantCheck || tenantPropertyId !== agentPropertyId) {
          return NextResponse.json({ message: 'You can only manage tenants in your assigned property.' }, { status: 403 });
        }
      } else if (authContext.organizationId) {
        const { data: orgProps } = await supabaseAdmin
          .from('properties')
          .select('id')
          .eq('organization_id', authContext.organizationId);
        const propIds = (orgProps ?? []).map((p: any) => p.id);

        if (propIds.length > 0) {
          const { data: orgUnits } = await supabaseAdmin.from('units').select('id').in('property_id', propIds);
          const unitIds = (orgUnits ?? []).map((u: any) => u.id);
          const { data: tenantUnit } = await supabaseAdmin
            .from('tenants')
            .select('id')
            .eq('id', id)
            .in('unit_id', unitIds)
            .maybeSingle();

          if (!tenantUnit) {
            return NextResponse.json({ message: 'You can only manage tenants in your own landlord workspace.' }, { status: 403 });
          }
        } else {
          return NextResponse.json({ message: 'You can only manage tenants in your own landlord workspace.' }, { status: 403 });
        }
      } else {
        return NextResponse.json({ message: 'You can only manage tenants in your own landlord workspace.' }, { status: 403 });
      }
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
  } catch (error: any) {
    return NextResponse.json({ message: error.message ?? 'Unable to update tenant.' }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const id = request.nextUrl.searchParams.get('id');

    if (!id) {
      return NextResponse.json({ message: 'Tenant ID is required.' }, { status: 400 });
    }

    const authContext = await getAuthContext(request);
    const userMetadata = authContext.sessionUser?.user_metadata || {};
    const isAgent = userMetadata?.role === 'agent';
    
    if (!authContext.isSuperAdmin) {
      const agentPropertyId = isAgent ? userMetadata?.property_id : null;
      
      if (isAgent && agentPropertyId) {
        const { data: tenantCheck } = await supabaseAdmin
          .from('tenants')
          .select('units!inner(property_id)')
          .eq('id', id)
          .maybeSingle();

        const tenantPropertyId = tenantCheck?.units?.[0]?.property_id;
        if (!tenantCheck || tenantPropertyId !== agentPropertyId) {
          return NextResponse.json({ message: 'You can only manage tenants in your assigned property.' }, { status: 403 });
        }
      } else if (authContext.organizationId) {
        const { data: orgProps } = await supabaseAdmin
          .from('properties')
          .select('id')
          .eq('organization_id', authContext.organizationId);
        const propIds = (orgProps ?? []).map((p: any) => p.id);

        if (propIds.length > 0) {
          const { data: orgUnits } = await supabaseAdmin.from('units').select('id').in('property_id', propIds);
          const unitIds = (orgUnits ?? []).map((u: any) => u.id);
          const { data: tenantUnit } = await supabaseAdmin
            .from('tenants')
            .select('id')
            .eq('id', id)
            .in('unit_id', unitIds)
            .maybeSingle();

          if (!tenantUnit) {
            return NextResponse.json({ message: 'You can only manage tenants in your own landlord workspace.' }, { status: 403 });
          }
        } else {
          return NextResponse.json({ message: 'You can only manage tenants in your own landlord workspace.' }, { status: 403 });
        }
      } else {
        return NextResponse.json({ message: 'You can only manage tenants in your own landlord workspace.' }, { status: 403 });
      }
    }

    const result = await supabaseAdmin.from('tenants').delete().eq('id', id);

    if (result.error) {
      return NextResponse.json({ message: result.error.message }, { status: 500 });
    }

    return NextResponse.json({ message: 'Tenant removed.' });
  } catch (error: any) {
    return NextResponse.json({ message: error.message ?? 'Unable to remove tenant.' }, { status: 500 });
  }
}