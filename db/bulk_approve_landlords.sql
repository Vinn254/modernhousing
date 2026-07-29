-- Bulk approve all pending project managers (landlords) for direct login
-- Run this in Supabase SQL Editor to bypass approval and OTP for existing test accounts

-- Step 1: Approve all pending project_manager profiles and clear OTP for direct login
update profiles
set
  approval_status = 'approved',
  status = 'active',
  approved_at = now(),
  otp_code = null,
  otp_expires_at = null
where role = 'project_manager'
  and (approval_status = 'pending' or approval_status is null);

-- Step 2: Show results
select
  full_name,
  email,
  organization_id,
  approval_status,
  status,
  approved_at
from profiles
where role = 'project_manager'
  and approval_status = 'approved'
order by created_at desc;
