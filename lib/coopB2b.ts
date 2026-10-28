import { timingSafeEqual } from 'crypto';
import { createClient } from '@supabase/supabase-js';
import { resolveIncomingPaymentCharge } from './rentLedger';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL ?? '';
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY ?? '';

if (!supabaseUrl || !serviceRoleKey) {
  throw new Error('Missing Supabase server environment variables');
}

export const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey);

export type CoopCredentials = {
  connectionId: string;
  connectionPassword: string;
  serviceName: string;
  institutionCode: string;
  institutionName: string;
  organizationId: string | null;
};

export type CoopRequestHeader = {
  connectionID: string;
  connectionPassword: string;
  messageID: string;
  serviceName: string;
};

export type TenantPaymentContext = {
  tenantId: string;
  tenantName: string;
  propertyId: string | null;
  landlordEmail: string | null;
  rentAmount: number;
};

function safeEqual(actual: string, expected: string) {
  const actualBuffer = Buffer.from(actual);
  const expectedBuffer = Buffer.from(expected);
  return actualBuffer.length === expectedBuffer.length && timingSafeEqual(actualBuffer, expectedBuffer);
}

export function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

export function requiredString(value: unknown): string | null {
  // The B2B spec sends InstitutionCode as an Integer on Payment Advice but as a
  // String on Validation, so both have to be accepted.
  if (typeof value === 'number' && Number.isFinite(value)) {
    return String(value);
  }
  return typeof value === 'string' && value.trim() ? value.trim() : null;
}

export async function candidateCredentials(): Promise<CoopCredentials[]> {
  const candidates: CoopCredentials[] = [];
  const connectionId = process.env.COOP_CONNECTION_ID?.trim() ?? '';
  const connectionPassword = process.env.COOP_CONNECTION_PASSWORD?.trim() ?? '';
  const serviceName = process.env.COOP_SERVICE_NAME?.trim() ?? '';
  const institutionCode = process.env.COOP_INSTITUTION_CODE?.trim() ?? '';

  if (connectionId && connectionPassword && serviceName && institutionCode) {
    candidates.push({
      connectionId,
      connectionPassword,
      serviceName,
      institutionCode,
      institutionName: process.env.COOP_INSTITUTION_NAME?.trim() || serviceName,
      organizationId: null,
    });
  }

  const { data, error } = await supabaseAdmin
    .from('payment_settings')
    .select('organization_id, coop_connection_id, coop_connection_password, coop_service_name, coop_institution_code, coop_institution_name')
    .eq('coop_enabled', true);

  if (error) {
    throw error;
  }

  for (const row of data ?? []) {
    if (
      row.coop_connection_id &&
      row.coop_connection_password &&
      row.coop_service_name &&
      row.coop_institution_code
    ) {
      candidates.push({
        connectionId: row.coop_connection_id,
        connectionPassword: row.coop_connection_password,
        serviceName: row.coop_service_name,
        institutionCode: row.coop_institution_code,
        institutionName: row.coop_institution_name || row.coop_service_name,
        organizationId: row.organization_id ?? null,
      });
    }
  }

  return candidates;
}

// The bank's sandbox credentials are frequently pasted onto more than one
// landlord's settings, so several rows can answer to the same connection. Each
// match has to be tried, because whichever row is picked decides which
// organization the unit code is searched in.
export function authenticateHeaderAll(
  header: CoopRequestHeader,
  institutionCode: string,
  credentials: CoopCredentials[],
): CoopCredentials[] {
  return credentials.filter((candidate) =>
    safeEqual(header.connectionID, candidate.connectionId) &&
    safeEqual(header.connectionPassword, candidate.connectionPassword) &&
    safeEqual(header.serviceName, candidate.serviceName) &&
    safeEqual(institutionCode, candidate.institutionCode),
  );
}

// Reports which of the four shared-secret fields failed for each configured
// credential, without ever printing a password, so a bank-side "Unauthorized"
// can be pinned to the exact field that differs.
export function authMismatchReport(
  header: CoopRequestHeader,
  institutionCode: string,
  credentials: CoopCredentials[],
) {
  return credentials.map((candidate) => ({
    source: candidate.organizationId ?? 'env',
    configuredConnectionId: candidate.connectionId,
    configuredServiceName: candidate.serviceName,
    configuredInstitutionCode: candidate.institutionCode,
    receivedConnectionId: header.connectionID,
    receivedServiceName: header.serviceName,
    receivedInstitutionCode: institutionCode,
    connectionIdMatch: safeEqual(header.connectionID, candidate.connectionId),
    passwordMatch: safeEqual(header.connectionPassword, candidate.connectionPassword),
    serviceNameMatch: safeEqual(header.serviceName, candidate.serviceName),
    institutionCodeMatch: safeEqual(institutionCode, candidate.institutionCode),
  }));
}

export type UnitCodeCandidate = { field: string; value: string };

export type UnitCodeLookup =
  | { status: 'found'; tenant: TenantPaymentContext; candidate: UnitCodeCandidate }
  | { status: 'unit_not_found'; candidates: UnitCodeCandidate[] }
  | { status: 'unit_has_no_tenant'; candidate: UnitCodeCandidate }
  | { status: 'unit_has_no_property'; candidate: UnitCodeCandidate }
  | { status: 'organization_mismatch'; candidate: UnitCodeCandidate; propertyOrganizationId: string | null };

// The unit, tenant, property and landlord profile are looked up once, without
// regard to organization, because the bank's credentials can be pasted onto
// several landlords' payment_settings rows and each retry used to re-run every
// query. Co-op's reply gateway times out well before that finishes.
export type UnitTenantLookup =
  | {
      status: 'found';
      tenant: TenantPaymentContext;
      candidate: UnitCodeCandidate;
      propertyOrganizationId: string | null;
    }
  | { status: 'unit_not_found'; candidates: UnitCodeCandidate[] }
  | { status: 'unit_has_no_tenant'; candidate: UnitCodeCandidate }
  | { status: 'unit_has_no_property'; candidate: UnitCodeCandidate };

type UnitRow = { id: string; short_code: string | null; property_id: string | null; rent_amount: number | null };

// Applies an authenticated credential's organization to the shared lookup result
// so the routes keep their per-organization behaviour with no extra queries.
export function withOrganization(
  lookup: UnitTenantLookup,
  organizationId: string | null,
): UnitCodeLookup {
  if (lookup.status !== 'found') {
    return lookup;
  }
  if (organizationId && lookup.propertyOrganizationId !== organizationId) {
    return {
      status: 'organization_mismatch',
      candidate: lookup.candidate,
      propertyOrganizationId: lookup.propertyOrganizationId,
    };
  }
  return { status: 'found', tenant: lookup.tenant, candidate: lookup.candidate };
}

function normalizeCode(value: string) {
  return value.trim().toLowerCase();
}

// Co-op has been seen to carry the tenant's paybill account in more than one field, and
// sandbox samples arrive in a different case to the stored code, so every plausible field
// is tried and matched case-insensitively.
export function collectUnitCodeCandidates(
  requestBody: Record<string, unknown>,
  fields: string[],
): UnitCodeCandidate[] {
  const candidates: UnitCodeCandidate[] = [];
  const seen = new Set<string>();

  for (const field of fields) {
    const value = requiredString(requestBody[field]);
    if (!value) continue;
    const key = normalizeCode(value);
    if (seen.has(key)) continue;
    seen.add(key);
    candidates.push({ field, value });
  }

  return candidates;
}

export async function lookupUnitTenant(
  candidates: UnitCodeCandidate[],
  options: { includeLandlordEmail?: boolean } = {},
): Promise<UnitTenantLookup> {
  const includeLandlordEmail = options.includeLandlordEmail ?? true;
  const variants = [...new Set(candidates.flatMap((candidate) => [candidate.value, candidate.value.toUpperCase(), candidate.value.toLowerCase()]))];
  if (variants.length === 0) {
    return { status: 'unit_not_found', candidates };
  }

  const { data: unitData, error: unitError } = await supabaseAdmin
    .from('units')
    .select('id, short_code, property_id, rent_amount')
    .in('short_code', variants);
  if (unitError) {
    throw unitError;
  }

  const units = (unitData ?? []) as UnitRow[];
  const matched = candidates.find((candidate) =>
    units.some((unit) => normalizeCode(unit.short_code ?? '') === normalizeCode(candidate.value)),
  );

  if (!matched) {
    return { status: 'unit_not_found', candidates };
  }

  const matchedUnits = units.filter((unit) => normalizeCode(unit.short_code ?? '') === normalizeCode(matched.value));
  if (matchedUnits.length > 1) {
    console.warn('[coop] more than one unit shares this short code', { code: matched.value, unitIds: matchedUnits.map((unit) => unit.id) });
  }

  const { data: tenantData, error: tenantError } = await supabaseAdmin
    .from('tenants')
    .select('id, full_name, unit_id, created_at')
    .in('unit_id', matchedUnits.map((unit) => unit.id))
    .order('created_at', { ascending: false })
    .limit(1);
  if (tenantError) {
    throw tenantError;
  }

  const tenant = (tenantData ?? [])[0] as { id: string; full_name: string; unit_id: string | null } | undefined;
  if (!tenant) {
    return { status: 'unit_has_no_tenant', candidate: matched };
  }

  const unit = matchedUnits.find((row) => row.id === tenant.unit_id) ?? matchedUnits[0];
  if (!unit.property_id) {
    return { status: 'unit_has_no_property', candidate: matched };
  }
  const propertyId = unit.property_id;

  const { data: property, error: propertyError } = await supabaseAdmin
    .from('properties')
    .select('organization_id, created_by')
    .eq('id', propertyId)
    .maybeSingle();
  if (propertyError) {
    throw propertyError;
  }

  if (!property) {
    return { status: 'unit_has_no_property', candidate: matched };
  }

  let landlordEmail: string | null = null;
  if (includeLandlordEmail && property.created_by) {
    const { data: profile, error: profileError } = await supabaseAdmin
      .from('profiles')
      .select('email')
      .eq('user_id', property.created_by)
      .maybeSingle();

    if (profileError) {
      throw profileError;
    }
    landlordEmail = profile?.email ?? null;
  }

  // Legacy properties may have no created_by. Fall back to the organization's
  // project manager so landlord notifications and payment attribution still work.
  if (includeLandlordEmail && !landlordEmail && property.organization_id) {
    const { data: orgProfiles, error: orgProfileError } = await supabaseAdmin
      .from('profiles')
      .select('email')
      .eq('organization_id', property.organization_id)
      .eq('role', 'project_manager')
      .limit(1);

    if (orgProfileError) {
      throw orgProfileError;
    }
    landlordEmail = orgProfiles?.[0]?.email ?? null;
  }

  return {
    status: 'found',
    candidate: matched,
    propertyOrganizationId: property.organization_id ?? null,
    tenant: {
      tenantId: tenant.id,
      tenantName: tenant.full_name,
      propertyId,
      landlordEmail,
      rentAmount: Number(unit.rent_amount) || 0,
    },
  };
}

export function monthDueFor(paymentDate: Date) {
  return paymentDate.toLocaleString('en-US', { month: 'long', year: 'numeric', timeZone: 'Africa/Nairobi' });
}

export async function recordCoopPayment({
  tenant,
  amount,
  paymentDate,
  bankReference,
  transactionReference,
  unitCode,
}: {
  tenant: TenantPaymentContext;
  amount: number;
  paymentDate: Date;
  bankReference: string;
  transactionReference: string;
  unitCode: string;
}) {
  const monthDue = monthDueFor(paymentDate);
  // The bank only tells us what was sent. The month's rent is charged once, so a
  // posting that lands on an already-billed month carries no charge and reads as
  // rent in advance, which the running balance applies to the next month.
  const charge = await resolveIncomingPaymentCharge({
    tenantId: tenant.tenantId,
    monthDue,
    rentAmount: tenant.rentAmount,
  });
  const dueAmount = tenant.rentAmount > 0 ? charge.dueAmount : amount;

  const paymentRow: Record<string, unknown> = {
    tenant_id: tenant.tenantId,
    amount,
    transaction_type: 'rent',
    transaction_code: bankReference,
    coop_payment_reference: transactionReference,
    description: 'Co-operative Bank M-Pesa Payment',
    balance_remaining: amount - dueAmount,
    due_amount: dueAmount,
    month_due: monthDue,
    paid_at: paymentDate.toISOString(),
    transaction_number: `COOP-${bankReference}`,
    admin_email: tenant.landlordEmail,
    property_id: tenant.propertyId,
  };
  if (charge.rentType) paymentRow.rent_type = charge.rentType;

  const { error: paymentError } = await supabaseAdmin.from('payments').insert(paymentRow);

  if (paymentError) {
    throw paymentError;
  }

  const notifications = [{
    recipient: 'tenant',
    tenant_id: tenant.tenantId,
    property_id: tenant.propertyId,
    admin_email: tenant.landlordEmail,
    type: 'rent_payment',
    message: charge.chargedAlready
      ? `Your payment of KSH ${amount} was received and recorded as rent in advance.`
      : `Your rent payment of KSH ${amount} for ${monthDue} was received successfully.`,
    status: 'sent',
    created_at: new Date().toISOString(),
  }];

  if (tenant.landlordEmail) {
    notifications.push({
      recipient: 'project_manager',
      tenant_id: tenant.tenantId,
      property_id: tenant.propertyId,
      admin_email: tenant.landlordEmail,
      type: 'rent_payment',
      message: `Tenant payment of KSH ${amount} received for Rent Payment (${monthDue}) via Co-operative Bank M-Pesa.`,
      status: 'sent',
      created_at: new Date().toISOString(),
    });
  }

  const { error: notificationError } = await supabaseAdmin.from('notifications').insert(notifications);
  if (notificationError) {
    // The rent payment is already recorded; do not fail the bank advice
    // because a notification could not be written. Surface it in logs instead.
    console.error('[coop] notification insert failed', notificationError);
  }

  return { monthDue, unitCode };
}
