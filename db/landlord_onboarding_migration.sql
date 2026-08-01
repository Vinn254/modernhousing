alter table profiles
  add column if not exists organization_name text,
  add column if not exists id_number text,
  add column if not exists kra_pin text,
  add column if not exists property_name text,
  add column if not exists property_location text,
  add column if not exists number_of_units integer,
  add column if not exists account_holder_name text,
  add column if not exists bank_name text,
  add column if not exists account_number text,
  add column if not exists branch text,
  add column if not exists agreement_accepted boolean default false,
  add column if not exists signed_on date,
  add column if not exists bank_details_edit_allowed boolean default true,
  add column if not exists bank_edit_request boolean default false,
  add column if not exists updated_at timestamp with time zone default now();

create index if not exists idx_profiles_bank_edit_request on profiles(bank_edit_request);
create index if not exists idx_profiles_bank_details_edit_allowed on profiles(bank_details_edit_allowed);
