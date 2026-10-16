export interface RentPaymentType {
  value: string;
  label: string;
  definition: string;
}

// Definitions are the wording supplied for the product and must stay verbatim.
export const RENT_PAYMENT_TYPES: RentPaymentType[] = [
  { value: 'rent_in_advance', label: 'Rent in advance', definition: 'Rent paid before the period of occupancy or before it is due.' },
  { value: 'rent_in_arrears', label: 'Rent in arrears', definition: 'Rent paid after the rental period has ended.' },
  { value: 'monthly_rent', label: 'Monthly rent', definition: 'Rent paid every month.' },
  { value: 'weekly_rent', label: 'Weekly rent', definition: 'Rent paid every week.' },
  { value: 'quarterly_rent', label: 'Quarterly rent', definition: 'Rent paid every three months.' },
  { value: 'annual_rent', label: 'Annual rent', definition: 'Rent paid once a year.' },
  { value: 'lump_sum_rent', label: 'Lump-sum rent', definition: 'A large amount of rent paid at once for a specified period.' },
  { value: 'part_payment', label: 'Part-payment of rent', definition: 'Rent paid in installments or in portions rather than in one full amount.' },
  { value: 'prepaid_rent', label: 'Prepaid rent', definition: 'Rent paid ahead of time for future occupancy.' },
  { value: 'overdue_rent', label: 'Overdue rent', definition: 'Rent that has not been paid by the agreed due date.' },
];

export const RENT_PAYMENT_TYPES_NOTE =
  'Note: Rent in advance and prepaid rent are very similar terms. The exact payment arrangement depends on the tenancy agreement.';

const LABELS = new Map(RENT_PAYMENT_TYPES.map((type) => [type.value, type.label]));

export function rentTypeForStorage(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim().toLowerCase();
  return RENT_PAYMENT_TYPES.some((type) => type.value === trimmed) ? trimmed : null;
}

export function rentTypeLabel(value?: string | null): string | null {
  if (!value) return null;
  return LABELS.get(value) ?? value;
}

export function rentTypeDefinition(value?: string | null): string | null {
  if (!value) return null;
  return RENT_PAYMENT_TYPES.find((type) => type.value === value)?.definition ?? null;
}
