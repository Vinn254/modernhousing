-- Add admin_email and property_id to payments table for cross-side visibility
-- Landlords can query payments by admin_email directly instead of
-- joining through tenants -> units -> properties

alter table payments
  add column if not exists admin_email text,
  add column if not exists property_id uuid references properties(id) on delete set null;

create index if not exists payments_admin_email_idx on payments(admin_email);
create index if not exists payments_property_id_idx on payments(property_id);
create index if not exists payments_tenant_id_created_at_idx on payments(tenant_id, created_at desc);
