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
  const { fullName, email, phone, unitId, leaseStart, leaseEnd, depositAmount } = body;

  if (!fullName || !email || !unitId || !leaseStart || !leaseEnd) {
    return NextResponse.json({ message: 'Missing required tenant fields.' }, { status: 400 });
  }

  const result = await supabaseAdmin.from('tenants').insert({
    full_name: fullName,
    email,
    phone,
    unit_id: unitId,
    lease_start: leaseStart,
    lease_end: leaseEnd,
    deposit_amount: depositAmount,
  });

  if (result.error) {
    return NextResponse.json({ message: result.error.message }, { status: 500 });
  }

  return NextResponse.json({ message: 'Tenant created.' }, { status: 201 });
}
