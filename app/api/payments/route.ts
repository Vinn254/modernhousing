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

    const selectQuery = '*, tenants(full_name, email, units!inner(property_id))';
    let query: any = supabaseAdmin.from('payments').select(selectQuery);

    if (propertyId) {
      query = query.eq('tenants.units.property_id', propertyId);
    }

    const { data, error } = await query.order('created_at', { ascending: false });

    if (error) throw error;

    const payments = (data ?? []).map((payment: any) => ({
      ...payment,
      tenant_name: payment.tenants?.full_name ?? payment.tenant ?? '',
      tenant_email: payment.tenants?.email ?? '',
    }));

    return NextResponse.json({ payments });
  } catch (error: any) {
    return NextResponse.json({ payments: [], message: error.message ?? 'Unable to load payments.' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  const body = await request.json();
  const { tenantId, description, transactionType, amount, balanceRemaining } = body;

  if (!tenantId || !description || !transactionType || amount == null || balanceRemaining == null) {
    return NextResponse.json({ message: 'Missing required payment fields.' }, { status: 400 });
  }

  const result = await supabaseAdmin.from('payments').insert({
    tenant_id: tenantId,
    description,
    transaction_type: transactionType,
    amount,
    balance_remaining: balanceRemaining,
    paid_at: new Date().toISOString(),
  });

  if (result.error) {
    return NextResponse.json({ message: result.error.message }, { status: 500 });
  }

  return NextResponse.json({ message: 'Payment recorded.' }, { status: 201 });
}
