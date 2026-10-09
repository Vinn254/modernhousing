-- Remove the unused SBM IPN configuration after disabling the SBM callback.
alter table payment_settings
  drop column if exists sbm_account_number,
  drop column if exists sbm_ipn_username,
  drop column if exists sbm_ipn_password,
  drop column if exists sbm_secret_key,
  drop column if exists sbm_enabled;
