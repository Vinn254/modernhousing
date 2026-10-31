-- Read-only checks. Paste the whole file into Supabase > SQL Editor and run it.
-- Nothing here changes data.

-- 1. Every payment recorded today (Nairobi time), with who it is attributed to.
--    If a payment you made is missing from this list, it was never written.
select
  p.created_at at time zone 'Africa/Nairobi' as recorded_at,
  p.paid_at at time zone 'Africa/Nairobi'    as bank_date,
  t.full_name                                as tenant,
  u.unit_number                              as unit,
  u.short_code                               as unit_code,
  pr.name                                    as property,
  p.transaction_type                         as type,
  p.amount,
  p.month_due,
  p.transaction_number,
  p.transaction_code,
  p.admin_email                              as attributed_to_landlord,
  p.property_id is null                      as missing_property_link
from payments p
left join tenants t    on t.id = p.tenant_id
left join units u      on u.id = t.unit_id
left join properties pr on pr.id = coalesce(p.property_id, u.property_id)
where (p.created_at at time zone 'Africa/Nairobi')::date = current_date
   or (p.paid_at at time zone 'Africa/Nairobi')::date = current_date
order by p.created_at desc;

-- 2. Notifications written today for those payments. A payment in list 1 with no
--    matching row here means the landlord alert was never created.
select
  n.created_at at time zone 'Africa/Nairobi' as sent_at,
  n.recipient,
  t.full_name  as tenant,
  n.admin_email,
  n.type,
  n.message
from notifications n
left join tenants t on t.id = n.tenant_id
where (n.created_at at time zone 'Africa/Nairobi')::date = current_date
  and n.type = 'rent_payment'
order by n.created_at desc;

-- 3. Unit codes used by more than one unit. The bank sends only the code, so a
--    shared code can put one tenant's money on another landlord's unit.
--    Rename the extras on the Properties > Units screen.
select
  lower(trim(u.short_code)) as shared_code,
  count(*)                  as units_using_it,
  string_agg(pr.name || ' / ' || u.unit_number || ' (tenant: ' || coalesce(t.full_name, 'none') || ')', '  |  ') as where_used
from units u
left join properties pr on pr.id = u.property_id
left join tenants t      on t.unit_id = u.id
where u.short_code is not null
group by lower(trim(u.short_code))
having count(*) > 1
order by shared_code;

-- 4. Units with no code at all. These can never receive a bank or M-Pesa payment.
select
  pr.name       as property,
  u.unit_number as unit,
  t.full_name   as tenant
from units u
left join properties pr on pr.id = u.property_id
left join tenants t      on t.unit_id = u.id
where u.short_code is null or trim(u.short_code) = ''
order by pr.name, u.unit_number;
