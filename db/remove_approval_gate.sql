-- Remove approval gate for existing accounts and clear pending states
-- Run this in Supabase SQL Editor

update profiles
set
  approval_status = 'approved',
  status = 'active',
  approved_at = now(),
  otp_code = null,
  otp_expires_at = null
where (approval_status = 'pending' or approval_status is null)
  and role in ('project_manager', 'agent');

-- Confirm emails in auth for any unconfirmed users
update auth.users
set email_confirmed_at = coalesce(email_confirmed_at, now())
where id in (select user_id from profiles where role in ('project_manager', 'agent'))
  and email_confirmed_at is null;

-- Optional verification
select p.full_name, p.email, p.role, p.approval_status, p.status, a.email_confirmed_at
from profiles p
left join auth.users a on a.id = p.user_id
where p.role in ('project_manager', 'agent')
order by p.created_at desc;
