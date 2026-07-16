import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL ?? '';
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY ?? '';

if (!supabaseUrl || !serviceRoleKey) {
  throw new Error('Missing Supabase server environment variables');
}

const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey);

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const tenantId = String(body.tenantId ?? '').trim();
    const organizationId = String(body.organizationId ?? '').trim();

    if (!tenantId || !organizationId) {
      return NextResponse.json({ message: 'tenantId and organizationId are required.' }, { status: 400 });
    }

    // Find tenant -> unit -> property
    const { data: tenant, error: tenantErr } = await supabaseAdmin.from('tenants').select('unit_id').eq('id', tenantId).maybeSingle();
    if (tenantErr) throw tenantErr;
    if (!tenant?.unit_id) return NextResponse.json({ message: 'Tenant or unit not found.' }, { status: 404 });

    const { data: unit, error: unitErr } = await supabaseAdmin.from('units').select('property_id').eq('id', tenant.unit_id).maybeSingle();
    if (unitErr) throw unitErr;
    if (!unit?.property_id) return NextResponse.json({ message: 'Unit or property not found.' }, { status: 404 });

    const propertyId = unit.property_id;

    // Update property.organization_id
    const { data: updatedProp, error: updateErr } = await supabaseAdmin
      .from('properties')
      .update({ organization_id: organizationId })
      .eq('id', propertyId)
      .select()
      .maybeSingle();

    if (updateErr) throw updateErr;

    return NextResponse.json({ message: 'Property organization assigned.', property: updatedProp });
  } catch (error: any) {
    return NextResponse.json({ message: error?.message ?? 'Unable to assign organization.' }, { status: 500 });
  }
}
