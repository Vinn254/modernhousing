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

// One unit code can exist on several landlords' properties, so the lookup keeps
// every unit that carries the code plus the property that owns it. The paying
// landlord's organization then picks the right one out of that list.
export type UnitResolution = {
  unitId: string;
  propertyId: string;
  propertyOrganizationId: string | null;
  propertyCreatedBy: string | null;
  rentAmount: number;
  tenantId: string;
  tenantName: string;
  tenantCreatedAt: string | null;
};

// The units, tenants and properties are looked up once, without regard to
// organization, because the bank's credentials can be pasted onto several
// landlords' payment_settings rows and each retry used to re-run every query.
// Co-op's reply gateway times out well before that finishes.
export type UnitTenantLookup =
  | { status: 'found'; candidate: UnitCodeCandidate; resolutions: UnitResolution[] }
  | { status: 'unit_not_found'; candidates: UnitCodeCandidate[] }
  | { status: 'unit_has_no_tenant'; candidate: UnitCodeCandidate }
  | { status: 'unit_has_no_property'; candidate: UnitCodeCandidate };

type UnitRow = { id: string; short_code: string | null; property_id: string | null; rent_amount: number | null };

async function landlordEmailForResolution(resolution: UnitResolution): Promise<string | null> {
  return landlordEmailFromProperty(resolution.propertyCreatedBy, resolution.propertyOrganizationId);
}

// Applies an authenticated credential's organization to the shared lookup result
// so the routes keep their per-organization behaviour with no extra queries.
export async function withOrganization(
  lookup: UnitTenantLookup,
  organizationId: string | null,
  options: { includeLandlordEmail?: boolean } = {},
): Promise<UnitCodeLookup> {
  if (lookup.status !== 'found') {
    return lookup;
  }

  const inScope = organizationId
    ? lookup.resolutions.filter((resolution) => resolution.propertyOrganizationId === organizationId)
    : lookup.resolutions;

  if (inScope.length === 0) {
    return {
      status: 'organization_mismatch',
      candidate: lookup.candidate,
      propertyOrganizationId: lookup.resolutions[0]?.propertyOrganizationId ?? null,
    };
  }

  // Duplicates inside one landlord are a data problem, not a reason to refuse a
  // payment that has already left the tenant's phone: fall back to the newest
  // tenant on that code, which is what the lookup did before it was scoped.
  const resolution = [...inScope].sort((a, b) =>
    String(b.tenantCreatedAt ?? '').localeCompare(String(a.tenantCreatedAt ?? '')),
  )[0];

  if (inScope.length > 1) {
    console.warn('[coop] more than one unit shares this short code for this organization', {
      code: lookup.candidate.value,
      organizationId: organizationId ?? 'env',
      unitIds: inScope.map((row) => row.unitId),
      chosenUnitId: resolution.unitId,
    });
  }

  const tenant: TenantPaymentContext = {
    tenantId: resolution.tenantId,
    tenantName: resolution.tenantName,
    propertyId: resolution.propertyId,
    rentAmount: resolution.rentAmount,
    landlordEmail: options.includeLandlordEmail ? await landlordEmailForResolution(resolution) : null,
  };

  return { status: 'found', tenant, candidate: lookup.candidate };
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

// The organization's manager is who landlord notifications and payment
// attribution belong to. Older rows stored that person under 'admin' rather than
// 'project_manager', so an exact single-role match silently returned nobody.
const ORG_LANDLORD_ROLE_ORDER = ['project_manager', 'admin', 'super_admin'];

export async function organizationLandlordEmail(organizationId: string): Promise<string | null> {
  const { data: orgProfiles, error } = await supabaseAdmin
    .from('profiles')
    .select('email, role')
    .eq('organization_id', organizationId);

  if (error) {
    throw error;
  }

  const ranked = (orgProfiles ?? [])
    .filter((profile: any) => profile.email)
    .sort((a: any, b: any) => {
      const rankA = ORG_LANDLORD_ROLE_ORDER.indexOf(String(a.role));
      const rankB = ORG_LANDLORD_ROLE_ORDER.indexOf(String(b.role));
      return (rankA < 0 ? ORG_LANDLORD_ROLE_ORDER.length : rankA) - (rankB < 0 ? ORG_LANDLORD_ROLE_ORDER.length : rankB);
    });

  return ranked[0]?.email ?? null;
}

async function landlordEmailFromProperty(createdBy: string | null, organizationId: string | null): Promise<string | null> {
  if (createdBy) {
    const { data: profile, error: profileError } = await supabaseAdmin
      .from('profiles')
      .select('email')
      .eq('user_id', createdBy)
      .maybeSingle();

    if (profileError) {
      throw profileError;
    }
    if (profile?.email) return profile.email;
  }

  if (!organizationId) return null;
  return organizationLandlordEmail(organizationId);
}

// Landlord email for a property: its creator when there is one, otherwise the
// manager of the organization that holds it.
export async function propertyLandlordEmail(propertyId: string | null): Promise<string | null> {
  if (!propertyId) return null;

  const { data: property, error } = await supabaseAdmin
    .from('properties')
    .select('created_by, organization_id')
    .eq('id', propertyId)
    .maybeSingle();

  if (error) {
    throw error;
  }
  if (!property) return null;

  return landlordEmailFromProperty(property.created_by ?? null, property.organization_id ?? null);
}

export async function lookupUnitTenant(
  candidates: UnitCodeCandidate[],
): Promise<UnitTenantLookup> {
  const variants = [...new Set(candidates.flatMap((candidate) => [
    candidate.value,
    candidate.value.toUpperCase(),
    candidate.value.toLowerCase(),
    candidate.value.replace(/[\s\-_]/g, ''),
    candidate.value.replace(/[\s\-_]/g, '').toUpperCase(),
  ]))];
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
  // The bank echoes back whatever the tenant typed, so spacing and case both
  // vary; compare on a stripped, lower-cased form of the stored code.
  const codeKey = (value: string) => normalizeCode(value).replace(/[\s\-_]/g, '');
  const matched = candidates.find((candidate) =>
    units.some((unit) => codeKey(unit.short_code ?? '') === codeKey(candidate.value)),
  );

  if (!matched) {
    return { status: 'unit_not_found', candidates };
  }

  const matchedUnits = units.filter((unit) => codeKey(unit.short_code ?? '') === codeKey(matched.value));

  // Every unit carrying the code is resolved, not just the first: the same code
  // can exist on two landlords' properties and only the paying landlord's copy
  // may take the money.
  const { data: tenantData, error: tenantError } = await supabaseAdmin
    .from('tenants')
    .select('id, full_name, unit_id, created_at')
    .in('unit_id', matchedUnits.map((unit) => unit.id))
    .order('created_at', { ascending: false });
  if (tenantError) {
    throw tenantError;
  }

  const tenants = (tenantData ?? []) as { id: string; full_name: string; unit_id: string | null; created_at: string | null }[];
  if (tenants.length === 0) {
    return { status: 'unit_has_no_tenant', candidate: matched };
  }

  const propertyIds = [...new Set(matchedUnits.map((unit) => unit.property_id).filter(Boolean))] as string[];
  if (propertyIds.length === 0) {
    return { status: 'unit_has_no_property', candidate: matched };
  }

  const { data: propertyData, error: propertyError } = await supabaseAdmin
    .from('properties')
    .select('id, organization_id, created_by')
    .in('id', propertyIds);
  if (propertyError) {
    throw propertyError;
  }

  const propertiesById = new Map<string, { organization_id: string | null; created_by: string | null }>();
  (propertyData ?? []).forEach((property: any) => {
    propertiesById.set(String(property.id), {
      organization_id: property.organization_id ?? null,
      created_by: property.created_by ?? null,
    });
  });

  const resolutions: UnitResolution[] = [];
  for (const unit of matchedUnits) {
    if (!unit.property_id) continue;
    const property = propertiesById.get(String(unit.property_id));
    if (!property) continue;

    // A unit's newest tenant row is the one currently holding it.
    const tenant = tenants.find((row) => row.unit_id === unit.id);
    if (!tenant) continue;

    resolutions.push({
      unitId: unit.id,
      propertyId: String(unit.property_id),
      propertyOrganizationId: property.organization_id,
      propertyCreatedBy: property.created_by,
      rentAmount: Number(unit.rent_amount) || 0,
      tenantId: tenant.id,
      tenantName: tenant.full_name,
      tenantCreatedAt: tenant.created_at ?? null,
    });
  }

  if (resolutions.length === 0) {
    return { status: 'unit_has_no_property', candidate: matched };
  }

  return { status: 'found', candidate: matched, resolutions };
}

// Resolves the tenant currently holding a unit by its paybill code. The SBM and
// M-Pesa callbacks carry no organization, so the newest tenant on that code wins.
export async function findTenantIdByUnitCode(unitCode: string): Promise<string | null> {
  const lookup = await lookupUnitTenant([{ field: 'AccountNumber', value: unitCode }]);
  if (lookup.status !== 'found') {
    return null;
  }
  const resolved = await withOrganization(lookup, null);
  return resolved.status === 'found' ? resolved.tenant.tenantId : null;
}

// Units created while registering a tenant arrive with no paybill code, and a unit
// without one can never receive a bank payment. Derive a code from the unit number
// and keep it unique platform-wide, which is what the bank matching relies on.
export async function generateUniqueShortCode(unitNumber: string): Promise<string> {
  const base = normalizeCode(unitNumber)
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .toUpperCase() || 'UNIT';

  const { data: existing } = await supabaseAdmin
    .from('units')
    .select('short_code')
    .ilike('short_code', `${base}%`)
    .limit(200);

  const taken = new Set((existing ?? []).map((unit: any) => normalizeCode(unit.short_code ?? '')));
  if (!taken.has(base.toLowerCase())) return base;

  for (let suffix = 2; suffix < 500; suffix += 1) {
    const candidate = `${base}-${suffix}`;
    if (!taken.has(candidate.toLowerCase())) return candidate;
  }

  return `${base}-${Date.now().toString().slice(-6)}`;
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
