import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import '../../../../lib/consoleGuard';
import { decryptIpnPayload, encryptIpnResponse } from '../../../../lib/sbmCrypto';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL ?? '';
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY ?? '';
const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey);

const monthNames = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
const knownPaymentTypes = new Set(['rent', 'tenancy_agreement', 'water', 'garbage', 'service_charge', 'parking', 'security', 'internet', 'laundry', 'pet_fees', 'other', 'utility']);

const descriptionForType: Record<string, string> = {
  tenancy_agreement: 'Tenancy Agreement Fee',
  water: 'Water Payment',
  garbage: 'Garbage Payment',
  service_charge: 'Service Charge Payment',
  parking: 'Parking Fee Payment',
  security: 'Security Fee Payment',
  internet: 'Internet Payment',
  laundry: 'Laundry Payment',
  pet_fees: 'Pet Fees Payment',
};

type SbmCredentials = {
  ipnUsername: string;
  ipnPassword: string;
  secretKey: string;
  accountNumber: string | null;
};

async function candidateCredentials(): Promise<SbmCredentials[]> {
  const candidates: SbmCredentials[] = [];

  const envUsername = process.env.SBM_IPN_USERNAME ?? '';
  const envPassword = process.env.SBM_IPN_PASSWORD ?? '';
  const envSecret = process.env.SBM_SECRET_KEY ?? '';
  if (envSecret) {
    candidates.push({
      ipnUsername: envUsername,
      ipnPassword: envPassword,
      secretKey: envSecret,
      accountNumber: process.env.SBM_ACCOUNT_NUMBER ?? null,
    });
  }

  const { data: settingsRows } = await supabaseAdmin
    .from('payment_settings')
    .select('sbm_ipn_username, sbm_ipn_password, sbm_secret_key, sbm_account_number')
    .not('sbm_secret_key', 'is', null)
    .eq('sbm_enabled', true);

  for (const row of settingsRows ?? []) {
    if (row.sbm_secret_key) {
      candidates.push({
        ipnUsername: row.sbm_ipn_username ?? '',
        ipnPassword: row.sbm_ipn_password ?? '',
        secretKey: row.sbm_secret_key,
        accountNumber: row.sbm_account_number ?? null,
      });
    }
  }

  return candidates;
}

function parseAccountReference(description: string) {
  const accountRef = description || '';
  const parts = accountRef.includes('|') ? accountRef.split('|') : [];
  let tenantId: string | null = null;
  let unitShortCode: string | null = null;
  let paymentType = 'rent';

  if (parts.length === 0 && accountRef) {
    unitShortCode = accountRef;
  } else if (parts.length === 1) {
    unitShortCode = parts[0] || null;
  } else if (parts.length === 2) {
    if (knownPaymentTypes.has(parts[1] || '')) {
      tenantId = parts[0] || null;
      paymentType = parts[1] || 'rent';
    } else {
      tenantId = parts[0] || null;
      unitShortCode = parts[1] || null;
    }
  } else if (parts.length >= 3) {
    tenantId = parts[0] || null;
    unitShortCode = parts[1] || null;
    paymentType = parts[2] || 'rent';
  }

  return { tenantId, unitShortCode, paymentType };
}

function parseSbmDate(raw: string): Date {
  // Format: yyyyMMddHHmmss
  if (/^\d{14}$/.test(raw)) {
    const year = Number(raw.slice(0, 4));
    const month = Number(raw.slice(4, 6)) - 1;
    const day = Number(raw.slice(6, 8));
    const hour = Number(raw.slice(8, 10));
    const minute = Number(raw.slice(10, 12));
    const second = Number(raw.slice(12, 14));
    return new Date(year, month, day, hour, minute, second);
  }
  return new Date();
}

async function resolveTenantContext(tenantId: string) {
  const { data: tenant } = await supabaseAdmin
    .from('tenants')
    .select('units(property_id, properties(created_by))')
    .eq('id', tenantId)
    .maybeSingle();

  const propertyId = tenant?.units?.property_id ?? null;
  let landlordEmail: string | null = null;

  if (propertyId) {
    const { data: prop } = await supabaseAdmin
      .from('properties')
      .select('created_by')
      .eq('id', propertyId)
      .maybeSingle();

    if (prop?.created_by) {
      const { data: adminProfile } = await supabaseAdmin
        .from('profiles')
        .select('email')
        .eq('user_id', prop.created_by)
        .maybeSingle();
      landlordEmail = adminProfile?.email ?? null;
    }
  }

  return { tenant, propertyId, landlordEmail };
}

async function createPaymentNotification(
  tenantId: string,
  adminEmail: string,
  propertyId: string | null,
  amount: number,
  paymentType: string,
  monthDue: string,
  method: 'sbm' | 'mpesa'
) {
  const desc = descriptionForType[paymentType] ?? 'Rent Payment';
  const notificationInserts: any[] = [
    {
      recipient: 'tenant',
      tenant_id: tenantId,
      property_id: propertyId,
      admin_email: adminEmail || null,
      type: 'rent_payment',
      message: `Your ${desc.toLowerCase()} payment of KSH ${amount} for ${monthDue} was received successfully.`,
      status: 'sent',
      created_at: new Date().toISOString(),
    },
  ];

  if (adminEmail) {
    notificationInserts.push({
      recipient: 'project_manager',
      tenant_id: tenantId,
      property_id: propertyId,
      admin_email: adminEmail,
      type: 'rent_payment',
      message: `Tenant payment of KSH ${amount} received for ${desc} (${monthDue}) via ${method.toUpperCase()}.`,
      status: 'sent',
      created_at: new Date().toISOString(),
    });
  }

  await supabaseAdmin.from('notifications').insert(notificationInserts);
}

async function updateTenantBills(tenantId: string, amount: number) {
  const { data: bills } = await supabaseAdmin
    .from('bills')
    .select('id, due_amount, paid_amount, balance')
    .eq('tenant_id', tenantId)
    .order('created_at', { ascending: false })
    .limit(5);

  if (bills && bills.length > 0) {
    for (const bill of bills) {
      const newPaid = (bill.paid_amount || 0) + amount;
      const newBalance = (bill.due_amount || 0) - newPaid;
      await supabaseAdmin.from('bills')
        .update({ paid_amount: newPaid, balance: Math.max(0, newBalance) })
        .eq('id', bill.id);
    }
  }
}

export async function POST(request: NextRequest) {
  const rawBody = await request.text();

  const candidates = await candidateCredentials();
  if (candidates.length === 0) {
    return NextResponse.json({ message: 'SBM IPN not configured' }, { status: 500 });
  }

  let decrypted: any = null;
  let matchedCredentials: SbmCredentials | null = null;

  for (const credentials of candidates) {
    try {
      decrypted = decryptIpnPayload(rawBody.trim(), credentials.secretKey);
      matchedCredentials = credentials;
      break;
    } catch {
      // try next candidate secret key
    }
  }

  if (!decrypted || !matchedCredentials) {
    return NextResponse.json({ message: 'Unable to decrypt IPN payload' }, { status: 400 });
  }

  if (
    decrypted.IPNUsername !== matchedCredentials.ipnUsername ||
    decrypted.IPNPassword !== matchedCredentials.ipnPassword
  ) {
    return NextResponse.json({ message: 'Invalid IPN credentials' }, { status: 401 });
  }

  const items: any[] = Array.isArray(decrypted.Data) ? decrypted.Data : [];
  let lastReference = '';
  let lastDebitAc = '';
  let allSucceeded = true;

  for (const item of items) {
    lastReference = item.reference ?? lastReference;
    lastDebitAc = item.DebitAc ?? lastDebitAc;

    if (String(item.type).toLowerCase() !== 'credit') {
      // Only incoming deposits represent tenant payments; ignore debits.
      continue;
    }

    const { tenantId: parsedTenantId, unitShortCode, paymentType } = parseAccountReference(item.description ?? '');
    let tenantId = parsedTenantId;

    if (!tenantId && unitShortCode) {
      const { data: unitRow } = await supabaseAdmin
        .from('units')
        .select('tenant_id')
        .eq('short_code', unitShortCode)
        .maybeSingle();
      tenantId = unitRow?.tenant_id ?? null;
    }

    if (!tenantId) {
      allSucceeded = false;
      continue;
    }

    const amount = Number(item.amount) || 0;
    const transactionDate = item.date ? parseSbmDate(String(item.date)) : new Date();

    const { tenant, propertyId, landlordEmail } = await resolveTenantContext(tenantId);
    const monthDue = `${monthNames[transactionDate.getMonth()]} ${transactionDate.getFullYear()}`;

    const { error } = await supabaseAdmin.from('payments').insert({
      tenant_id: tenantId,
      amount,
      transaction_type: paymentType,
      transaction_code: item.reference ?? null,
      description: descriptionForType[paymentType] ?? 'Rent Payment',
      balance_remaining: 0,
      month_due: monthDue,
      paid_at: transactionDate.toISOString(),
      transaction_number: `SBM-${Date.now().toString().slice(-6)}`,
      admin_email: landlordEmail || null,
      property_id: propertyId || null,
    });

    if (error) {
      allSucceeded = false;
      continue;
    }

    await Promise.all([
      createPaymentNotification(tenantId, landlordEmail || '', propertyId, amount, paymentType, monthDue, 'sbm'),
      updateTenantBills(tenantId, amount),
    ]);
  }

  const responsePayload = {
    status: allSucceeded ? '00' : '99',
    reference: lastReference,
    DebitAc: lastDebitAc,
  };

  const encryptedResponse = encryptIpnResponse(responsePayload, matchedCredentials.secretKey);
  return new NextResponse(encryptedResponse, {
    status: 200,
    headers: { 'Content-Type': 'text/plain' },
  });
}
