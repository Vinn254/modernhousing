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
    const { data, error } = await supabaseAdmin
      .from('document_bundles')
      .select(`*, tenants(full_name, units(unit_number, properties(name)))`)
      .order('created_at', { ascending: false });

    if (error) throw error;

    const bundles = (data ?? []).map((b: any) => ({
      id: b.id,
      tenant_id: b.tenant_id,
      tenant_name: b.tenants?.full_name ?? '',
      property_name: b.tenants?.units?.properties?.name ?? '',
      status: b.status,
      signed_agreement_url: b.signed_agreement_url,
      id_document_url: b.id_document_url,
      passport_photo_url: b.passport_photo_url,
      created_at: b.created_at,
    }));

    return NextResponse.json({ bundles });
  } catch (error: any) {
    return NextResponse.json({ bundles: [], message: error.message ?? 'Unable to load bundles.' }, { status: 500 });
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const body = await request.json();
    const { id, status } = body;

    if (!id) {
      return NextResponse.json({ message: 'Bundle ID is required.' }, { status: 400 });
    }

    const result = await supabaseAdmin
      .from('document_bundles')
      .update({ status, updated_at: new Date().toISOString() })
      .eq('id', id)
      .select()
      .single();

    if (result.error) {
      return NextResponse.json({ message: result.error.message }, { status: 500 });
    }

    return NextResponse.json({ message: 'Bundle updated.', bundle: result.data });
  } catch (error: any) {
    return NextResponse.json({ message: error.message ?? 'Unable to update bundle.' }, { status: 500 });
  }
}