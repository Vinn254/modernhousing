import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL ?? '';
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY ?? '';

if (!supabaseUrl || !serviceRoleKey) {
  throw new Error('Missing Supabase server environment variables');
}

export const supabaseLedger = createClient(supabaseUrl, serviceRoleKey);

export type IncomingPaymentCharge = {
  // What this payment line should charge for the month: the rent when the month
  // has no charge yet, otherwise zero so the money lands as a credit.
  dueAmount: number;
  chargedAlready: boolean;
  rentType: string | null;
};

// A month is billed once. Landlord entries and bank postings both live in the
// statement as month lines, so a second payment for a month that already
// carries its rent must not repeat the charge — it becomes rent in advance and
// the running balance applies it to the next month automatically.
export async function resolveIncomingPaymentCharge({
  tenantId,
  monthDue,
  rentAmount,
}: {
  tenantId: string;
  monthDue: string;
  rentAmount: number;
}): Promise<IncomingPaymentCharge> {
  const noChargeYet = { dueAmount: rentAmount, chargedAlready: false, rentType: null };
  if (!tenantId || !monthDue || !(rentAmount > 0)) {
    return noChargeYet;
  }

  const [billsResult, paymentsResult] = await Promise.all([
    supabaseLedger
      .from('bills')
      .select('due_amount')
      .eq('tenant_id', tenantId)
      .eq('month_due', monthDue)
      .eq('transaction_type', 'rent'),
    supabaseLedger
      .from('payments')
      .select('due_amount')
      .eq('tenant_id', tenantId)
      .eq('month_due', monthDue)
      .eq('transaction_type', 'rent'),
  ]);

  if (billsResult.error || paymentsResult.error) {
    // A ledger we cannot read must not silently swallow the month's rent.
    console.error('[rentLedger] unable to read existing charges', billsResult.error ?? paymentsResult.error);
    return noChargeYet;
  }

  const charged = [...(billsResult.data ?? []), ...(paymentsResult.data ?? [])]
    .reduce((sum, row) => sum + (Number(row.due_amount) || 0), 0);

  if (charged < rentAmount) {
    return noChargeYet;
  }

  return { dueAmount: 0, chargedAlready: true, rentType: 'rent_in_advance' };
}
