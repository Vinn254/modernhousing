import { timingSafeEqual } from 'crypto';
import { createClient } from '@supabase/supabase-js';

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

export function authenticateHeader(
  header: CoopRequestHeader,
  institutionCode: string,
  credentials: CoopCredentials[],
): CoopCredentials | null {
  return credentials.find((candidate) =>
    safeEqual(header.connectionID, candidate.connectionId) &&
    safeEqual(header.connectionPassword, candidate.connectionPassword) &&
    safeEqual(header.serviceName, candidate.serviceName) &&
    safeEqual(institutionCode, candidate.institutionCode),
  ) ?? null;
}

export async function findTenantByUnitCode(
  unitCode: string,
  organizationId: string | null,
): Promise<TenantPaymentContext | null> {
  const { data: tenant, error } = await supabaseAdmin
    .from('tenants')
    .select('id, full_name, unit_id, units!inner(property_id, short_code)')
    .eq('units.short_code', unitCode)
    .maybeSingle();

  if (error) {
    throw error;
  }

  if (!tenant) {
    return null;
  }

  const propertyId = tenant.units?.property_id ?? null;
  if (!propertyId) {
    return null;
  }

  const { data: property, error: propertyError } = await supabaseAdmin
    .from('properties')
    .select('organization_id, created_by')
    .eq('id', propertyId)
    .maybeSingle();

  if (propertyError) {
    throw propertyError;
  }

  if (!property || (organizationId && property.organization_id !== organizationId)) {
    return null;
  }

  let landlordEmail: string | null = null;
  if (property.created_by) {
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

  return {
    tenantId: tenant.id,
    tenantName: tenant.full_name,
    propertyId,
    landlordEmail,
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
  unitCode,
}: {
  tenant: TenantPaymentContext;
  amount: number;
  paymentDate: Date;
  bankReference: string;
  unitCode: string;
}) {
  const monthDue = monthDueFor(paymentDate);
  const { error: paymentError } = await supabaseAdmin.from('payments').insert({
    tenant_id: tenant.tenantId,
    amount,
    transaction_type: 'rent',
    transaction_code: bankReference,
    coop_payment_reference: bankReference,
    description: 'Co-operative Bank M-Pesa Payment',
    balance_remaining: 0,
    month_due: monthDue,
    paid_at: paymentDate.toISOString(),
    transaction_number: `COOP-${bankReference}`,
    admin_email: tenant.landlordEmail,
    property_id: tenant.propertyId,
  });

  if (paymentError) {
    throw paymentError;
  }

  const notifications = [{
    recipient: 'tenant',
    tenant_id: tenant.tenantId,
    property_id: tenant.propertyId,
    admin_email: tenant.landlordEmail,
    type: 'rent_payment',
    message: `Your rent payment of KSH ${amount} for ${monthDue} was received successfully.`,
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
    throw notificationError;
  }

  const { data: bills, error: billsError } = await supabaseAdmin
    .from('bills')
    .select('id, due_amount, paid_amount')
    .eq('tenant_id', tenant.tenantId)
    .order('created_at', { ascending: false })
    .limit(5);

  if (billsError) {
    throw billsError;
  }

  let remainingAmount = amount;
  for (const bill of bills ?? []) {
    if (remainingAmount <= 0) {
      break;
    }

    const dueAmount = Number(bill.due_amount ?? 0);
    const currentPaidAmount = Number(bill.paid_amount ?? 0);
    const outstandingAmount = Math.max(0, dueAmount - currentPaidAmount);
    if (outstandingAmount <= 0) {
      continue;
    }

    const appliedAmount = Math.min(remainingAmount, outstandingAmount);
    const paidAmount = currentPaidAmount + appliedAmount;
    const balance = outstandingAmount - appliedAmount;
    const { error: billError } = await supabaseAdmin
      .from('bills')
      .update({ paid_amount: paidAmount, balance })
      .eq('id', bill.id);
    if (billError) {
      throw billError;
    }

    remainingAmount -= appliedAmount;
  }

  return { monthDue, unitCode };
}
