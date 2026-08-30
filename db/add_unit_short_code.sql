-- Add short_code column to units table
-- This is used as the paybill account number when tenants make payments

alter table units
  add column if not exists short_code text;

-- Add an index for faster lookups
create index if not exists idx_units_short_code on units (short_code) where short_code is not null;

-- Add a comment to document the column
comment on column units.short_code is 'Unique short code for the unit, used as paybill account number for tenant payments';
