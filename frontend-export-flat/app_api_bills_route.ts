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
    return { isSuperAdmin: false, userId: undefined, organizationId: null, sessionUser: null, tenantId: null };
  }

  const userMetadata = sessionUser.user_metadata || {};

  let orgId = userMetadata.organization_id ?? null;
  const tenantId = userMetadata.tenant_id ?? null;

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
    tenantId,
  };
}

function mapBillsWithTenant(data: any[]): any[] {
  return data.map((bill: any) => ({
    id: bill.id,
    tenant_id: bill.tenant_id,
    tenant_name: bill.tenants?.full_name ?? '',
    tenant_email: bill.tenants?.email ?? '',
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
}

export async function GET(request: NextRequest) {
  try {
    const authContext = await getAuthContext(request);
    const tenantId = request.nextUrl.searchParams.get('tenantId');
    const tenantEmail = request.nextUrl.searchParams.get('tenantEmail');
    const propertyId = request.nextUrl.searchParams.get('propertyId');

    let effectiveTenantId = tenantId || authContext.tenantId;

    // If tenantEmail provided, look up tenant ID
    if (tenantEmail && !effectiveTenantId) {
      const { data: tenantData } = await supabaseAdmin
        .from('tenants')
        .select('id')
        .eq('email', tenantEmail)
        .single();
      effectiveTenantId = tenantData?.id ?? null;
    }

    if (effectiveTenantId) {
      const { data, error } = await supabaseAdmin
        .from('bills')
        .select(`*`)
        .eq('tenant_id', effectiveTenantId)
        .order('created_at', { ascending: false });

      if (error) throw error;

      return NextResponse.json({ bills: data ?? [] });
    }

    // For admin/landlord - fetch all bills for their organization or all bills for super_admin
    const userMetadata = authContext.sessionUser?.user_metadata || {};
    const isAgent = userMetadata?.role === 'agent';
    const agentPropertyId = isAgent ? userMetadata?.property_id : null;

    if (authContext.isSuperAdmin) {
      const { data, error } = await supabaseAdmin
        .from('bills')
        .select(`*, tenants(full_name, email, units(unit_number, properties(name)))`)
        .order('created_at', { ascending: false });

      if (error) throw error;

      return NextResponse.json({ bills: mapBillsWithTenant(data ?? []) });
    }

    // For agents - filter by their property
    if (isAgent && agentPropertyId) {
      const { data: units } = await supabaseAdmin.from('units').select('id').eq('property_id', agentPropertyId);
      const unitIds = (units ?? []).map((u: any) => u.id);

      if (unitIds.length > 0) {
        const { data: tenants } = await supabaseAdmin.from('tenants').select('id').in('unit_id', unitIds);
        const tenantIds = (tenants ?? []).map((t: any) => t.id);

        if (tenantIds.length > 0) {
          const { data, error } = await supabaseAdmin
            .from('bills')
            .select(`*, tenants(full_name, email, units(unit_number, properties(name)))`)
            .in('tenant_id', tenantIds)
            .order('created_at', { ascending: false });

          if (error) throw error;

          return NextResponse.json({ bills: mapBillsWithTenant(data ?? []) });
        }
        return NextResponse.json({ bills: [] });
      }
      return NextResponse.json({ bills: [] });
    }

    // For landlords with property_id parameter
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
          tenant_email: bill.tenants?.email ?? '',
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

    // For landlords - filter by properties created_by
    if (authContext.userId) {
      const { data: createdProps } = await supabaseAdmin
        .from('properties')
        .select('id')
        .eq('created_by', authContext.userId);
      let propIds = (createdProps ?? []).map((p: any) => p.id);

      // Fallback to organization_id if no properties found via created_by
      if (propIds.length === 0 && authContext.organizationId) {
        const { data: orgProps } = await supabaseAdmin
          .from('properties')
          .select('id')
          .eq('organization_id', authContext.organizationId);
        propIds = (orgProps ?? []).map((p: any) => p.id);
      }

      if (propIds.length > 0) {
        const { data: propUnits } = await supabaseAdmin.from('units').select('id').in('property_id', propIds);
        const unitIds = (propUnits ?? []).map((u: any) => u.id);
        const { data: orgTenants } = await supabaseAdmin
          .from('tenants')
          .select('id')
          .in('unit_id', unitIds);
        const tenantIds = (orgTenants ?? []).map((t: any) => t.id);

        const { data, error } = await supabaseAdmin
          .from('bills')
          .select(`*, tenants(full_name, email, units(unit_number, properties(name)))`)
          .in('tenant_id', tenantIds)
          .order('created_at', { ascending: false });

        if (error) throw error;

        return NextResponse.json({ bills: mapBillsWithTenant(data ?? []) });
      }
      return NextResponse.json({ bills: [] });
    }

    return NextResponse.json({ bills: [] });
  } catch (error: any) {
    return NextResponse.json({ bills: [], message: error.message ?? 'Unable to load bills.' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  const authContext = await getAuthContext(request);
  
  if (!authContext.userId) {
    return NextResponse.json({ message: 'Authentication required.' }, { status: 401 });
  }

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
    referenceNumber,
    balanceRemaining
  } = body;

  if (!tenantId || !description) {
    return NextResponse.json({ message: 'Missing required bill fields.' }, { status: 400 });
  }

  // For rent transactions, fetch unit rent amount if not provided
  let finalDueAmount = dueAmount;
  if ((transactionType === 'rent' || !transactionType) && !dueAmount && unitId) {
    const { data: unit } = await supabaseAdmin
      .from('units')
      .select('rent_amount')
      .eq('id', unitId)
      .single();
    finalDueAmount = unit?.rent_amount || 0;
  }

  // Calculate balance: due_amount - paid_amount (or use provided balance)
  const calculatedBalance = balanceRemaining !== undefined ? Number(balanceRemaining) : (Number(finalDueAmount) || 0) - (Number(paidAmount) || 0);

  const insertData: any = {
    tenant_id: tenantId,
    unit_id: unitId || null,
    property_id: propertyId || null,
    description,
    month_due: monthDue,
    due_amount: Number(finalDueAmount) || 0,
    paid_amount: Number(paidAmount) || 0,
    penalty_fee: Number(penaltyFee) || 0,
    balance: calculatedBalance,
    transaction_type: transactionType || 'rent',
    transaction_number: transactionNumber ?? `BILL-${Date.now().toString().slice(-8)}`,
    transaction_code: transactionCode || null,
    payment_date: paymentDate || null,
    payment_method: paymentMethod || null,
    reference_number: referenceNumber || null,
    created_at: paymentDate ? new Date(paymentDate).toISOString() : new Date().toISOString(),
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
    tenantId,
    description,
    monthDue,
    dueAmount,
    paidAmount,
    penaltyFee,
    transactionType,
    paymentMethod,
    referenceNumber,
    transactionCode,
    balanceRemaining,
    paymentDate
  } = body;

  if (!id) {
    return NextResponse.json({ message: 'Bill ID is required.' }, { status: 400 });
  }

  // Calculate balance: due_amount - paid_amount (or use provided balance)
  const calculatedBalance = balanceRemaining !== undefined ? Number(balanceRemaining) : 
    (Number(dueAmount) || 0) - (Number(paidAmount) || 0);

  // Update bill with all provided fields
  const updateData: any = {
    tenant_id: tenantId || undefined,
    description,
    month_due: monthDue,
    due_amount: Number(dueAmount) || 0,
    paid_amount: Number(paidAmount) || 0,
    penalty_fee: Number(penaltyFee) || 0,
    balance: calculatedBalance,
    transaction_type: transactionType || 'rent',
    transaction_code: transactionCode || null,
    payment_method: paymentMethod || null,
    reference_number: referenceNumber || null,
    created_at: paymentDate ? new Date(paymentDate).toISOString() : undefined,
  };

  // Only set payment_date if provided
  if (paymentDate) {
    updateData.payment_date = paymentDate;
  }

  const result = await supabaseAdmin.from('bills')
    .update(updateData)
    .eq('id', id)
    .select();

  if (result.error) {
    return NextResponse.json({ message: result.error.message }, { status: 500 });
  }

  return NextResponse.json({ message: 'Bill updated.', bill: result.data?.[0] });
}

export async function DELETE(request: NextRequest) {
  const authContext = await getAuthContext(request);

  if (!authContext.userId) {
    return NextResponse.json({ message: 'Authentication required.' }, { status: 401 });
  }

  const body = await request.json();
  const { id } = body;

  if (!id) {
    return NextResponse.json({ message: 'Bill ID is required.' }, { status: 400 });
  }

  const result = await supabaseAdmin.from('bills')
    .delete()
    .eq('id', id)
    .select();

  if (result.error) {
    return NextResponse.json({ message: result.error.message }, { status: 500 });
  }

  if (!result.data || result.data.length === 0) {
    return NextResponse.json({ message: 'Bill not found or could not be deleted.' }, { status: 404 });
  }

  return NextResponse.json({ message: 'Bill deleted.' });
}

export async function PUT(request: NextRequest) {
  const authContext = await getAuthContext(request);
  
  if (!authContext.userId) {
    return NextResponse.json({ message: 'Authentication required.' }, { status: 401 });
  }

  const body = await request.json();
  const {
    id,
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
    referenceNumber,
    balanceRemaining
  } = body;

  if (!id) {
    return NextResponse.json({ message: 'Bill ID is required.' }, { status: 400 });
  }

  // Calculate balance: due_amount - paid_amount (or use provided balanceRemaining)
  const calculatedBalance = balanceRemaining !== undefined ? Number(balanceRemaining) : (Number(dueAmount) || 0) - (Number(paidAmount) || 0);

  const updateData: any = {
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
    transaction_number: transactionNumber || null,
    transaction_code: transactionCode || null,
    payment_date: paymentDate || null,
    payment_method: paymentMethod || null,
    reference_number: referenceNumber || null,
  };

  const result = await supabaseAdmin.from('bills')
    .update(updateData)
    .eq('id', id)
    .select();

  if (result.error) {
    return NextResponse.json({ message: result.error.message }, { status: 500 });
  }

  return NextResponse.json({ message: 'Bill updated.', bill: result.data?.[0] });
}