import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { logAuditEvent } from '../../../lib/auditLogger';
import { rentTypeForStorage } from '../../../lib/rentTypes';
import { propertyLandlordEmail } from '../../../lib/coopB2b';

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
    return { isSuperAdmin: false, userId: undefined, organizationId: null, userEmail: undefined, role: 'user', agentPropertyId: null, tenantId: null };
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
    userEmail: sessionUser.email,
    role: String(userMetadata.role ?? 'user'),
    agentPropertyId: userMetadata.property_id ?? null,
    tenantId: userMetadata.tenant_id ?? null,
  };
}

type AuthContext = Awaited<ReturnType<typeof getAuthContext>>;

// The set of properties this caller may see payments for, or null for super admin
// (everything). Landlords get the properties they created plus any held through
// their organization; agents get only the single property they are assigned to.
async function accessiblePropertyIds(auth: AuthContext): Promise<Set<string> | null> {
  if (auth.isSuperAdmin) return null;
  if (auth.role === 'agent') {
    return new Set(auth.agentPropertyId ? [String(auth.agentPropertyId)] : []);
  }
  const { data } = await supabaseAdmin
    .from('properties')
    .select('id')
    .eq('created_by', auth.userId ?? '');
  const ids = new Set<string>((data ?? []).map((p: any) => String(p.id)));
  // Union, not fallback: a landlord can own some properties outright and hold
  // others only through their organization (older rows have no created_by), and
  // both sets must stay visible or those tenants' payments silently vanish.
  if (auth.organizationId) {
    const { data: orgProps } = await supabaseAdmin
      .from('properties')
      .select('id')
      .eq('organization_id', auth.organizationId);
    (orgProps ?? []).forEach((p: any) => ids.add(String(p.id)));
  }
  return ids;
}

async function propertyIdOfTenant(tenantId: string): Promise<string | null> {
  const { data } = await supabaseAdmin
    .from('tenants')
    .select('units(property_id)')
    .eq('id', tenantId)
    .maybeSingle();
  return (data as any)?.units?.property_id ?? null;
}

// A tenant record belongs to whoever owns the property its unit sits in. Tenants
// may always see their own row; everyone else must own the property.
async function canAccessTenant(auth: AuthContext, tenantId: string): Promise<boolean> {
  if (auth.role === 'tenant' && auth.tenantId && auth.tenantId === tenantId) return true;

  const allowed = await accessiblePropertyIds(auth);
  if (allowed === null) return true;

  const propertyId = await propertyIdOfTenant(tenantId);
  if (propertyId && allowed.has(propertyId)) return true;

  // A legacy account whose properties resolve to an empty scope (no created_by
  // and no organization) must keep its previous access rather than be locked out
  // of its own payments; scoped accounts stay strictly isolated. Tenants never
  // fail open — they only ever see their own row.
  if (allowed.size === 0 && auth.role !== 'tenant') return true;

  if (auth.role === 'tenant' && auth.userEmail) {
    const { data } = await supabaseAdmin.from('tenants').select('email').eq('id', tenantId).maybeSingle();
    if (data?.email && String(data.email).toLowerCase() === String(auth.userEmail).toLowerCase()) return true;
  }
  return false;
}

async function canAccessPayment(auth: AuthContext, paymentId: string): Promise<boolean> {
  const { data } = await supabaseAdmin
    .from('payments')
    .select('tenant_id, property_id')
    .eq('id', paymentId)
    .maybeSingle();
  if (!data) return false;
  if (data.tenant_id) return canAccessTenant(auth, data.tenant_id);
  const allowed = await accessiblePropertyIds(auth);
  if (allowed === null) return true;
  return Boolean(data.property_id && allowed.has(String(data.property_id)));
}

export async function GET(request: NextRequest) {
  try {
    const authContext = await getAuthContext(request);
    const propertyId = request.nextUrl.searchParams.get('propertyId');
    const tenantEmail = request.nextUrl.searchParams.get('email');

    // If tenantEmail provided, look up tenant ID
    let effectiveTenantId = null;
    if (tenantEmail && !propertyId) {
      const { data: tenantData } = await supabaseAdmin
        .from('tenants')
        .select('id')
        .eq('email', tenantEmail)
        .single();
      effectiveTenantId = tenantData?.id ?? null;
    }

    if (effectiveTenantId) {
      if (!(await canAccessTenant(authContext, effectiveTenantId))) {
        return NextResponse.json({ payments: [], message: 'Not authorized to view this tenant.' }, { status: 403 });
      }
      const { data, error } = await supabaseAdmin
        .from('payments')
        .select('*, tenants(full_name, email, units(property_id))')
        .eq('tenant_id', effectiveTenantId)
        .order('created_at', { ascending: false });

      if (error) throw error;
      const payments = (data ?? []).map((payment: any) => ({
        ...payment,
        tenant: payment.tenants?.full_name ?? '',
        tenant_email: payment.tenants?.email ?? '',
      }));
      return NextResponse.json({ payments });
    }

    // If propertyId is passed, filter by it (for agent dashboard)
    if (propertyId) {
      const allowed = await accessiblePropertyIds(authContext);
      if (allowed !== null && allowed.size > 0 && !allowed.has(propertyId)) {
        return NextResponse.json({ payments: [], message: 'Not authorized to view this property.' }, { status: 403 });
      }
      const { data: units } = await supabaseAdmin.from('units').select('id').eq('property_id', propertyId);
      const unitIds = (units ?? []).map((u: any) => u.id);
      
      if (unitIds.length > 0) {
        const { data: tenants } = await supabaseAdmin.from('tenants').select('id').in('unit_id', unitIds);
        const tenantIds = (tenants ?? []).map((t: any) => t.id);
        
        const { data, error } = await supabaseAdmin
          .from('payments')
          .select('*, tenants(full_name, email, units(property_id))')
          .in('tenant_id', tenantIds)
          .order('created_at', { ascending: false });

        if (error) throw error;
        const payments = (data ?? []).map((payment: any) => ({
          ...payment,
          tenant: payment.tenants?.full_name ?? '',
          tenant_email: payment.tenants?.email ?? '',
        }));
        return NextResponse.json({ payments });
      }
      return NextResponse.json({ payments: [] });
    }

    // Landlords: properties they created plus any held through their organization
    const allowed = await accessiblePropertyIds(authContext);
    let propIds: string[] = [];
    if (allowed === null) {
      const { data: allProps } = await supabaseAdmin.from('properties').select('id');
      propIds = (allProps ?? []).map((p: any) => String(p.id));
    } else {
      propIds = [...allowed];
    }

    if (propIds.length > 0) {
      const { data: propUnits } = await supabaseAdmin.from('units').select('id').in('property_id', propIds);
      const unitIds = (propUnits ?? []).map((u: any) => u.id);
      let tenantIds: string[] = [];
      if (unitIds.length > 0) {
        const { data: propTenants } = await supabaseAdmin.from('tenants').select('id').in('unit_id', unitIds);
        tenantIds = (propTenants ?? []).map((t: any) => String(t.id));
      }

      // A payment is scoped by its tenant, but rows recorded against a property
      // whose tenant link has since moved still belong to that property's owner.
      const quoted = (values: string[]) => values.map((value) => `"${value}"`).join(',');
      const scopeFilters = [`property_id.in.(${quoted(propIds)})`];
      if (tenantIds.length > 0) scopeFilters.push(`tenant_id.in.(${quoted(tenantIds)})`);

      const { data, error } = await supabaseAdmin
        .from('payments')
        .select('*, tenants(full_name, email, units(property_id))')
        .or(scopeFilters.join(','))
        .order('created_at', { ascending: false });

      if (error) throw error;
      const payments = (data ?? []).map((payment: any) => ({
        ...payment,
        tenant: payment.tenants?.full_name ?? '',
        tenant_email: payment.tenants?.email ?? '',
      }));
      return NextResponse.json({ payments });
    }
    return NextResponse.json({ payments: [] });
  } catch (error: any) {
    return NextResponse.json({ payments: [], message: error.message ?? 'Unable to load payments.' }, { status: 500 });
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
    description,
    transactionType,
    amount,
    balanceRemaining,
    monthDue,
    dueAmount,
    paidAmount,
    transNumber,
    transCode,
    paymentDate
  } = body;

  // Validate transaction type - only allow rent, overdue, deposit
  const validTypes = ['rent', 'overdue', 'deposit'];
  if (transactionType && !validTypes.includes(transactionType)) {
    return NextResponse.json({ message: 'Invalid transaction type. Only rent, overdue, and deposit are allowed.' }, { status: 400 });
  }

  if (!tenantId || !paidAmount) {
    return NextResponse.json({ message: 'Missing required payment fields.' }, { status: 400 });
  }

  if (!(await canAccessTenant(authContext, tenantId))) {
    return NextResponse.json({ message: 'Not authorized to record payments for this tenant.' }, { status: 403 });
  }

  const insertData: any = {
    tenant_id: tenantId,
    description: description ?? `${transactionType || 'rent'} payment`,
    transaction_type: transactionType || 'rent',
    amount: Number(amount || paidAmount) || 0,
    balance_remaining: Number(balanceRemaining) || 0,
    transaction_number: transNumber ?? `PAY-${Date.now().toString().slice(-6)}`,
    paid_at: paymentDate || new Date().toISOString(),
    month_due: monthDue ?? null,
    due_amount: Number(dueAmount) || null,
    transaction_code: transCode ?? null,
  };

  const rentType = rentTypeForStorage(body.rentType);
  if (rentType) insertData.rent_type = rentType;

  // Resolve tenant context for admin_email and property_id
  const { data: tenant } = await supabaseAdmin
    .from('tenants')
    .select('units(property_id, properties(created_by)), email, full_name')
    .eq('id', tenantId)
    .maybeSingle();

  const propertyId = tenant?.units?.property_id ?? null;
  const landlordEmail = await propertyLandlordEmail(propertyId);
  // Whoever owns the property is who the landlord notification belongs to; when
  // that cannot be resolved the person recording the payment is the next best
  // attribution, and without one of the two the payment is recorded silently.
  const notifyEmail = landlordEmail || authContext.userEmail || null;

  insertData.admin_email = notifyEmail;
  insertData.property_id = propertyId || null;

const result = await supabaseAdmin.from('payments').insert(insertData);

    if (result.error) {
      return NextResponse.json({ message: result.error.message }, { status: 500 });
    }

    const insertedPayment = result.data as any;

    // Log audit
    await logAuditEvent(
      authContext.userId,
      authContext.userEmail,
      'create',
      'payment',
      insertedPayment?.[0]?.id,
      { tenant_id: tenantId, amount: paidAmount, type: transactionType }
    );

  const notificationInserts: any[] = [];

  if (tenant?.email) {
    notificationInserts.push({
      recipient: 'tenant',
      tenant_id: tenantId,
      property_id: propertyId,
      admin_email: notifyEmail,
      type: 'rent_payment',
      message: `Rent payment of KSH ${paidAmount} recorded.`,
      status: 'sent',
      created_at: new Date().toISOString(),
    });
  }

  if (notifyEmail && notifyEmail !== tenant?.email) {
    notificationInserts.push({
      recipient: 'project_manager',
      tenant_id: tenantId,
      property_id: propertyId,
      admin_email: notifyEmail,
      type: 'rent_payment',
      message: `Rent payment of KSH ${paidAmount} recorded for tenant ${tenant?.full_name || 'Tenant'}.`,
      status: 'sent',
      created_at: new Date().toISOString(),
    });
  }

  if (notificationInserts.length > 0) {
    const { error: notificationError } = await supabaseAdmin.from('notifications').insert(notificationInserts);
    if (notificationError) {
      // The payment itself is recorded; a missing notification must not fail the request.
      console.error('[payments] notification insert failed', notificationError);
    }
  }

  return NextResponse.json({ message: 'Payment recorded.', payment: result.data?.[0] }, { status: 201 });
}

export async function DELETE(request: NextRequest) {
  const authContext = await getAuthContext(request);

  if (!authContext.userId) {
    return NextResponse.json({ message: 'Authentication required.' }, { status: 401 });
  }

const body = await request.json();
  const { id } = body;

  if (!id) {
    return NextResponse.json({ message: 'Payment ID is required.' }, { status: 400 });
  }

  if (!(await canAccessPayment(authContext, id))) {
    return NextResponse.json({ message: 'Payment not found or not authorized.' }, { status: 403 });
  }

  const deleteResult = await supabaseAdmin.from('payments')
    .delete()
    .eq('id', id)
    .select();

  if (deleteResult.error) {
    return NextResponse.json({ message: deleteResult.error.message }, { status: 500 });
  }

  if (!deleteResult.data || deleteResult.data.length === 0) {
    return NextResponse.json({ message: 'Payment not found or could not be deleted.' }, { status: 404 });
  }

  // Log audit
  await logAuditEvent(
    authContext.userId,
    authContext.userEmail,
    'delete',
    'payment',
    id,
    { paymentId: id }
  );

  return NextResponse.json({ message: 'Payment deleted.' });
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
    description,
    transactionType,
    amount,
    balanceRemaining,
    monthDue,
    dueAmount,
    paidAmount,
    transNumber,
    transCode,
    paymentDate,
    balance
  } = body;

  if (!id) {
    return NextResponse.json({ message: 'Payment ID is required.' }, { status: 400 });
  }

  if (!(await canAccessPayment(authContext, id))) {
    return NextResponse.json({ message: 'Payment not found or not authorized.' }, { status: 403 });
  }

  // Re-pointing a payment at another tenant must stay inside the caller's own
  // properties, otherwise an edit could move money across landlords.
  if (tenantId && !(await canAccessTenant(authContext, tenantId))) {
    return NextResponse.json({ message: 'Not authorized to move this payment to that tenant.' }, { status: 403 });
  }

  // Validate transaction type - only allow rent, overdue, deposit
  const validTypes = ['rent', 'overdue', 'deposit'];
  if (transactionType && !validTypes.includes(transactionType)) {
    return NextResponse.json({ message: 'Invalid transaction type. Only rent, overdue, and deposit are allowed.' }, { status: 400 });
  }

  // Use provided balance if available, otherwise calculate
const finalBalanceRemaining = balance !== undefined ? Number(balance) : (Number(balanceRemaining) || 0);

  // Convert paymentDate (YYYY-MM-DD) to ISO format for paid_at
  const paidAtValue = paymentDate ? new Date(paymentDate).toISOString() : new Date().toISOString();

  const updateData: any = {
    tenant_id: tenantId || undefined,
    description: description ?? undefined,
    transaction_type: transactionType || 'rent',
    amount: Number(amount || paidAmount) || 0,
    balance_remaining: finalBalanceRemaining,
    transaction_number: transNumber ?? undefined,
    paid_at: paidAtValue,
    month_due: monthDue ?? null,
    due_amount: Number(dueAmount) || null,
    transaction_code: transCode ?? null,
    ...(Object.prototype.hasOwnProperty.call(body, 'rentType') ? { rent_type: rentTypeForStorage(body.rentType) } : {}),
  };

  const updateResult = await supabaseAdmin.from('payments')
    .update(updateData)
    .eq('id', id)
    .select();

  if (updateResult.error) {
    return NextResponse.json({ message: updateResult.error.message }, { status: 500 });
  }

  // Log audit
  await logAuditEvent(
    authContext.userId,
    authContext.userEmail,
    'update',
    'payment',
    id,
    { balance_remaining: finalBalanceRemaining }
  );

  return NextResponse.json({ message: 'Payment updated.', payment: updateResult.data?.[0] });
}
