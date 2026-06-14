import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL ?? '';
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY ?? '';

if (!supabaseUrl || !serviceRoleKey) {
  throw new Error('Missing Supabase server environment variables');
}

const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey);

export async function POST(request: NextRequest) {
  const body = await request.json();
  const { name, address, size, amenities, ownershipInfo } = body;

  if (!name || !address) {
    return NextResponse.json({ message: 'Property name and address are required.' }, { status: 400 });
  }

  const result = await supabaseAdmin.from('properties').insert({
    name,
    address,
    size,
    amenities,
    ownership_info: ownershipInfo,
  });

  if (result.error) {
    return NextResponse.json({ message: result.error.message }, { status: 500 });
  }

  return NextResponse.json({ message: 'Property created.' }, { status: 201 });
}
