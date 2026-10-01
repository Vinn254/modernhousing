-- Co-operative Bank B2B callback credentials, stored per organization.
-- The unique payment reference makes Payment Advice retries idempotent.

alter table payment_settings
  add column if not exists coop_connection_id text,
  add column if not exists coop_connection_password text,
  add column if not exists coop_service_name text,
  add column if not exists coop_institution_code text,
  add column if not exists coop_institution_name text,
  add column if not exists coop_enabled boolean default false;

alter table payments
  add column if not exists coop_payment_reference text;

create unique index if not exists payments_coop_payment_reference_unique_idx
  on payments (coop_payment_reference)
  where coop_payment_reference is not null;
