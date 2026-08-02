-- PesaFlow split payment integration
-- Adds PesaFlow config to payment_settings and creates split_payments table
--
-- Flow:
-- 1. Landlord registers and fills bank details in their profile
-- 2. Super admin configures PesaFlow API credentials in payment_settings
-- 3. PesaFlow fetches landlord bank details automatically
-- 4. When tenant pays rent, PesaFlow automatically splits:
--    - 1% platform fee -> super admin account
--    - 99% -> landlord bank account
-- 5. PesaFlow sends webhook to /api/pesaflow/webhook
-- 6. This table records the split for landlord/super admin transparency
-- 7. Tenant payment history remains untouched (shows full amount)

-- Add PesaFlow configuration columns to payment_settings
alter table payment_settings
  add column if not exists pesaflow_api_key text,
  add column if not exists pesaflow_merchant_id text,
  add column if not exists pesaflow_webhook_secret text,
  add column if not exists platform_fee_percentage numeric default 1.0,
  add column if not exists payment_split_enabled boolean default false;

-- Create split_payments table to track 1% platform fee deductions
create table if not exists split_payments (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid references tenants(id) on delete cascade,
  landlord_id uuid references auth.users(id) on delete cascade,
  original_amount numeric not null,
  platform_fee_amount numeric not null,
  landlord_amount numeric not null,
  currency text default 'KES',
  transaction_code text,
  pesaflow_transaction_id text,
  payment_method text default 'mpesa',
  status text default 'pending',
  metadata jsonb default '{}'::jsonb,
  created_at timestamp with time zone default now(),
  updated_at timestamp with time zone default now()
);

create index if not exists idx_split_payments_tenant on split_payments(tenant_id);
create index if not exists idx_split_payments_landlord on split_payments(landlord_id);
create index if not exists idx_split_payments_payment on split_payments(payment_id);
create index if not exists idx_split_payments_status on split_payments(status);
create index if not exists idx_split_payments_created on split_payments(created_at);

-- Enable row level security
alter table split_payments enable row level security;

-- Policies
create policy "Super admin full access" on split_payments
  for all
  to authenticated
  using ((select auth.jwt()->>'role') = 'super_admin')
  with check ((select auth.jwt()->>'role') = 'super_admin');

create policy "Landlord sees own splits" on split_payments
  for select
  to authenticated
  using (landlord_id = auth.uid());

create policy "System can insert splits" on split_payments
  for insert
  to authenticated
  with check (true);
