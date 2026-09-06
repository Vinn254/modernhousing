import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { getAllAdminUsers } from '../../../../lib/supabaseAdmin';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL ?? '';
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY ?? '';

if (!supabaseUrl || !serviceRoleKey) {
  throw new Error('Missing Supabase server environment variables');
}

const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey);

export async function GET(request: NextRequest) {
  try {
    const userId = request.nextUrl.searchParams.get('userId');
    const email = request.nextUrl.searchParams.get('email');

    if (!userId && !email) {
      return NextResponse.json({ message: 'Tenant account is required.' }, { status: 400 });
    }

    let tenantId: string | null = null;
    let authEmail = email?.trim().toLowerCase() ?? '';

    if (userId) {
      const users = await getAllAdminUsers();
      const user = users.find((item: any) => item.id === userId);
      tenantId = user?.user_metadata?.tenant_id ?? null;
      if (!authEmail) authEmail = user?.email?.trim().toLowerCase() ?? '';
    }

    const { data: allTenants, error } = await supabaseAdmin
      .from('tenants')
      .select('id, full_name, email, units(property_id, unit_number, properties(id, name, created_by))');

    if (error) throw error;

    const tenants = allTenants ?? [];
    let tenant = tenantId ? tenants.find((item: any) => item.id === tenantId) : null;
    if (!tenant && authEmail) {
      tenant = tenants.find((item: any) => item.email?.trim().toLowerCase() === authEmail) ?? null;
    }

    if (!tenant) {
      return NextResponse.json({ landlord: null, message: 'Tenant not found.' }, { status: 404 });
    }

    const property = (tenant as any).units?.properties ?? null;
    const landlordId = property?.created_by ?? null;

    // Only ever resolve the landlord that owns this tenant's property.
    let landlord: { id: string; name: string; email: string } | null = null;
    if (landlordId) {
      const users = await getAllAdminUsers();
      const landlordUser = users.find((item: any) => item.id === landlordId);
      if (landlordUser) {
        landlord = {
          id: landlordUser.id,
          name: landlordUser.user_metadata?.full_name || landlordUser.email || 'Landlord',
          email: landlordUser.email || '',
        };
      }
    }

    return NextResponse.json({
      landlord,
      tenantId: (tenant as any).id,
      tenantName: (tenant as any).full_name ?? '',
      propertyId: (tenant as any).units?.property_id ?? property?.id ?? '',
      propertyName: property?.name ?? '',
      unitNumber: (tenant as any).units?.unit_number ?? '',
    });
  } catch (error: any) {
    return NextResponse.json({ landlord: null, message: error.message ?? 'Unable to load landlord.' }, { status: 500 });
  }
}
