-- Types of Rent Payment
-- Adds a rent_type column so the agreed rent arrangement can be recorded on the
-- tenancy agreement, on each bill and on each payment.
--
-- Allowed values (validated in app/lib/rentTypes.ts, not enforced here so the
-- list can grow without another migration):
--   rent_in_advance, rent_in_arrears, monthly_rent, weekly_rent, quarterly_rent,
--   annual_rent, lump_sum_rent, part_payment, prepaid_rent, overdue_rent

alter table tenancy_agreements add column if not exists rent_type text;
alter table bills              add column if not exists rent_type text;
alter table payments           add column if not exists rent_type text;
