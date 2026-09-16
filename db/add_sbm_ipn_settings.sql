-- SBM Bank Kenya IPN (Instant Payment Notification) integration
-- Adds SBM credentials to payment_settings so the /api/sbm/ipn endpoint can
-- authenticate and decrypt incoming bank notifications per organization.
-- This does NOT change the existing payment workflow (mpesa/pesaflow/manual bills) -
-- it only adds SBM as an additional inbound payment notification source that records
-- payments/bills using the same logic already used by the M-Pesa callback.

alter table payment_settings
  add column if not exists sbm_account_number text,
  add column if not exists sbm_ipn_username text,
  add column if not exists sbm_ipn_password text,
  add column if not exists sbm_secret_key text,
  add column if not exists sbm_enabled boolean default false;
