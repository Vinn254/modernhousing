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
    };
  }

  return {
    isSuperAdmin: profile?.role === 'super_admin',
    profile,
  };
}

export async function GET(request: NextRequest) {
   try {
      const authContext = await getAuthContext(request);

      if (!authContext.isSuperAdmin) {
        if (!authContext.profile?.user_id) {
          return NextResponse.json({ tenants: [] });
        }

        // Get properties owned by this user
        const { data: userProps } = await supabaseAdmin
          .from('properties')
          .select('id')
          .eq('user_id', authContext.profile.user_id);
        const propIds = (userProps ?? []).map((p: any) => p.id);

        if (propIds.length === 0) {
          return NextResponse.json({ tenants: [] });
        }

        const { data: orgUnits } = await supabaseAdmin.from('units').select('id').in('property_id', propIds);
        const unitIds = (orgUnits ?? []).map((u: any) => u.id);

        if (unitIds.length === 0) {
          return NextResponse.json({ tenants: [] });
        }

        const { data, error } = await supabaseAdmin
          .from('tenants')
          .select('id, full_name, email, phone, lease_start, lease_end, units!inner(unit_number, properties(id, name, address))')
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
        }));

        return NextResponse.json({ tenants });
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

   const authContext = await getAuthContext(request);
   let finalUnitId = unitId;

   if (!authContext.isSuperAdmin && propertyId) {
     if (!authContext.profile?.user_id) {
       return NextResponse.json({ message: 'Unable to verify property access.' }, { status: 403 });
     }
     const { data: prop } = await supabaseAdmin
       .from('properties')
       .select('id')
       .eq('id', propertyId)
       .eq('user_id', authContext.profile.user_id)
       .maybeSingle();
     if (!prop) {
       return NextResponse.json({ message: 'You can only add tenants to properties in your own landlord workspace.' }, { status: 403 });
     }
   }

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
   try {
     const body = await request.json();
     const { id, fullName, email, phone, leaseStart, leaseEnd, status } = body;

     if (!id) {
       return NextResponse.json({ message: 'Tenant ID is required.' }, { status: 400 });
     }

     const authContext = await getAuthContext(request);
     if (!authContext.isSuperAdmin) {
       if (!authContext.profile?.user_id) {
         return NextResponse.json({ message: 'You can only manage tenants in your own landlord workspace.' }, { status: 403 });
       }

       const { data: orgProps } = await supabaseAdmin
         .from('properties')
         .select('id')
         .eq('user_id', authContext.profile.user_id);
       const propIds = (orgProps ?? []).map((p: any) => p.id);

       if (propIds.length > 0) {
         const { data: orgUnits } = await supabaseAdmin.from('units').select('id').in('property_id', propIds);
         const unitIds = (orgUnits ?? []).map((u: any) => u.id);
         const { data: tenantUnit } = await supabaseAdmin
           .from('tenants')
           .select('unit_id, units!inner(property_id)')
           .eq('id', id)
           .in('unit_id', unitIds)
           .maybeSingle();

         if (!tenantUnit) {
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
     if (!authContext.isSuperAdmin) {
       if (!authContext.profile?.user_id) {
         return NextResponse.json({ message: 'You can only manage tenants in your own landlord workspace.' }, { status: 403 });
       }

       const { data: orgProps } = await supabaseAdmin
         .from('properties')
         .select('id')
         .eq('user_id', authContext.profile.user_id);
       const propIds = (orgProps ?? []).map((p: any) => p.id);

       if (propIds.length > 0) {
         const { data: orgUnits } = await supabaseAdmin.from('units').select('id').in('property_id', propIds);
         const unitIds = (orgUnits ?? []).map((u: any) => u.id);
         const { data: tenantUnit } = await supabaseAdmin
           .from('tenants')
           .select('unit_id, units!inner(property_id)')
           .eq('id', id)
           .in('unit_id', unitIds)
           .maybeSingle();

         if (!tenantUnit) {
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