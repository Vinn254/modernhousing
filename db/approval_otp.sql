-- Approval and OTP fields for landlord / agent onboarding

alter table profiles
  add column if not exists approval_status text not null default 'pending'
    check (approval_status in ('pending', 'approved', 'rejected')),

  add column if not exists otp_code text,
  add column if not exists otp_expires_at timestamp with time zone,
  add column if not exists approved_at timestamp with time zone,
  add column if not exists approved_by uuid references auth.users(id);

create index if not exists idx_profiles_approval_status on profiles(approval_status);
create index if not exists idx_profiles_otp_expires_at on profiles(otp_expires_at);
