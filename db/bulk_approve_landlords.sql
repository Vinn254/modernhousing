-- Bulk approve all pending project managers (landlords)
-- Run this in Supabase SQL Editor to bypass manual approval

-- Step 1: Approve all pending project_manager profiles
update profiles
set
  approval_status = 'approved',
  status = 'active',
  approved_at = now(),
  otp_code = floor(100000 + random() * 900000)::text,
  otp_expires_at = (now() + interval '15 minutes')
where role = 'project_manager'
  and (approval_status = 'pending' or approval_status is null);

-- Step 2: Update user metadata for approved users
-- Note: This requires Supabase Admin API, run via SQL or through the app
-- The profiles table is updated above; user metadata will be synced on next login

-- Step 3: Show results
select
  full_name,
  email,
  organization_id,
  approval_status,
  status,
  approved_at,
  otp_code
from profiles
where role = 'project_manager'
  and approval_status = 'approved'
order by created_at desc;
