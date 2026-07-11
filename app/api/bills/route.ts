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

async function getAuthContext(request: NextRequest) {
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
    return { isSuperAdmin: false, userId: undefined, organizationId: null };
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
  };
}

export async function GET(request: NextRequest) {
  try {
    const authContext = await getAuthContext(request);
    const tenantId = request.nextUrl.searchParams.get('tenantId');
    const propertyId = request.nextUrl.searchParams.get('propertyId');

    if (tenantId) {
      const { data, error } = await supabaseAdmin
        .from('bills')
        .select(`*, tenants(full_name, email, units(unit_number))`)
        .eq('tenant_id', tenantId)
        .order('created_at', { ascending: false });

      if (error) throw error;

      const bills = (data ?? []).map((bill: any) => ({
        id: bill.id,
        tenant_id: bill.tenant_id,
        unit_number: bill.tenants?.units?.unit_number ?? '',
        tenant_name: bill.tenants?.full_name ?? '',
        description: bill.description,
        month_due: bill.month_due,
        due_amount: bill.due_amount,
        paid_amount: bill.paid_amount,
        penalty_fee: bill.penalty_fee ?? 0,
        balance: bill.balance,
        transaction_type: bill.transaction_type,
        transaction_number: bill.transaction_number,
        transaction_code: bill.transaction_code,
        payment_date: bill.payment_date,
        payment_method: bill.payment_method,
        reference_number: bill.reference_number,
        created_at: bill.created_at,
      }));

      return NextResponse.json({ bills });
    }

    if (propertyId) {
      const { data: units } = await supabaseAdmin.from('units').select('id').eq('property_id', propertyId);
      const unitIds = (units ?? []).map((u: any) => u.id);

      if (unitIds.length > 0) {
        const { data: tenants } = await supabaseAdmin.from('tenants').select('id').in('unit_id', unitIds);
        const tenantIds = (tenants ?? []).map((t: any) => t.id);

        const { data, error } = await supabaseAdmin
          .from('bills')
          .select(`*, tenants(full_name, email, units(unit_number, property_id))`)
          .in('tenant_id', tenantIds)
          .order('created_at', { ascending: false });

        if (error) throw error;

        const bills = (data ?? []).map((bill: any) => ({
          id: bill.id,
          tenant_id: bill.tenant_id,
          tenant_name: bill.tenants?.full_name ?? '',
          unit_number: bill.tenants?.units?.unit_number ?? '',
          description: bill.description,
          month_due: bill.month_due,
          due_amount: bill.due_amount,
          paid_amount: bill.paid_amount,
          penalty_fee: bill.penalty_fee ?? 0,
          balance: bill.balance,
          transaction_type: bill.transaction_type,
          transaction_number: bill.transaction_number,
          transaction_code: bill.transaction_code,
          payment_date: bill.payment_date,
          payment_method: bill.payment_method,
          reference_number: bill.reference_number,
          created_at: bill.created_at,
        }));

        return NextResponse.json({ bills });
      }
      return NextResponse.json({ bills: [] });
    }

    if (!authContext.isSuperAdmin && !authContext.organizationId) {
      return NextResponse.json({ bills: [] });
    }

    const { data: orgProps } = await supabaseAdmin
      .from('properties')
      .select('id')
      .eq('organization_id', authContext.organizationId ?? '');
    const propIds = (orgProps ?? []).map((p: any) => p.id);

    if (propIds.length > 0) {
      const { data: orgTenants } = await supabaseAdmin
        .from('tenants')
        .select('id')
        .in('unit_id', (await supabaseAdmin.from('units').select('id').in('property_id', propIds)).data?.map(u => u.id) ?? []);
      const tenantIds = (orgTenants ?? []).map((t: any) => t.id);

      const { data, error } = await supabaseAdmin
        .from('bills')
        .select(`*, tenants(full_name, email, units(unit_number, properties(name)))`)
        .in('tenant_id', tenantIds)
        .order('created_at', { ascending: false });

      if (error) throw error;

      const bills = (data ?? []).map((bill: any) => ({
        id: bill.id,
        tenant_id: bill.tenant_id,
        tenant_name: bill.tenants?.full_name ?? '',
        unit_number: bill.tenants?.units?.unit_number ?? '',
        property_name: bill.tenants?.units?.properties?.name ?? '',
        description: bill.description,
        month_due: bill.month_due,
        due_amount: bill.due_amount,
        paid_amount: bill.paid_amount,
        penalty_fee: bill.penalty_fee ?? 0,
        balance: bill.balance,
        transaction_type: bill.transaction_type,
        transaction_number: bill.transaction_number,
        transaction_code: bill.transaction_code,
        payment_date: bill.payment_date,
        payment_method: bill.payment_method,
        reference_number: bill.reference_number,
        created_at: bill.created_at,
      }));

      return NextResponse.json({ bills });
    }

    return NextResponse.json({ bills: [] });
  } catch (error: any) {
    return NextResponse.json({ bills: [], message: error.message ?? 'Unable to load bills.' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  const body = await request.json();
  const {
    tenantId,
    unitId,
    propertyId,
    description,
    monthDue,
    dueAmount,
    paidAmount,
    penaltyFee,
    transactionType,
    transactionNumber,
    transactionCode,
    paymentDate,
    paymentMethod,
    referenceNumber
  } = body;

  if (!tenantId || !description) {
    return NextResponse.json({ message: 'Missing required bill fields.' }, { status: 400 });
  }

  // Calculate balance: due_amount - paid_amount
  const calculatedBalance = (Number(dueAmount) || 0) - (Number(paidAmount) || 0);

  const insertData: any = {
    tenant_id: tenantId,
    unit_id: unitId || null,
    property_id: propertyId || null,
    description,
    month_due: monthDue,
    due_amount: Number(dueAmount) || 0,
    paid_amount: Number(paidAmount) || 0,
    penalty_fee: Number(penaltyFee) || 0,
    balance: calculatedBalance,
    transaction_type: transactionType || 'rent',
    transaction_number: transactionNumber ?? `BILL-${Date.now().toString().slice(-8)}`,
    transaction_code: transactionCode ?? null,
    payment_date: paymentDate || new Date().toISOString().split('T')[0],
    payment_method: paymentMethod || null,
    reference_number: referenceNumber || null,
  };

  const result = await supabaseAdmin.from('bills').insert(insertData);

  if (result.error) {
    return NextResponse.json({ message: result.error.message }, { status: 500 });
  }

  return NextResponse.json({ message: 'Bill recorded.', bill: result.data?.[0] }, { status: 201 });
}

export async function PATCH(request: NextRequest) {
  const body = await request.json();
  const {
    id,
    paidAmount,
    paymentMethod,
    referenceNumber
  } = body;

  if (!id) {
    return NextResponse.json({ message: 'Bill ID is required.' }, { status: 400 });
  }

  // Get existing bill
  const { data: existingBill } = await supabaseAdmin
    .from('bills')
    .select('paid_amount, due_amount')
    .eq('id', id)
    .single();

  if (!existingBill) {
    return NextResponse.json({ message: 'Bill not found.' }, { status: 404 });
  }

  // Calculate new balance
  const newPaidAmount = (Number(existingBill.paid_amount) || 0) + (Number(paidAmount) || 0);
  const newBalance = (Number(existingBill.due_amount) || 0) - newPaidAmount;

  const result = await supabaseAdmin.from('bills')
    .update({
      paid_amount: newPaidAmount,
      balance: newBalance,
      payment_method: paymentMethod || null,
      reference_number: referenceNumber || null,
      payment_date: new Date().toISOString().split('T')[0]
    })
    .eq('id', id)
    .select();

  if (result.error) {
    return NextResponse.json({ message: result.error.message }, { status: 500 });
  }

  return NextResponse.json({ message: 'Bill updated.', bill: result.data?.[0] });
}