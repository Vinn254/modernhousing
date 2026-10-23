-- Springfield Systems — backfill Due Amount on Co-operative Bank payments
--
-- Payment Advice rows written before this fix stored no due_amount, so the
-- Payments page (and the landlord PDF statement) fell back to the amount the
-- bank sent — a KSH 100 test posting therefore showed "Due 100" instead of the
-- unit's rent. New postings are stamped with the unit rent automatically.
--
-- The rent lives on units.rent_amount only; tenants have no rent column.
--
-- Run in Supabase → SQL Editor. Step 1 must show a rent above zero for the unit,
-- otherwise set it on the Property page first and re-run. Step 2 touches only
-- paybill rows whose due amount is empty, so nothing a landlord entered changes.

-- 1) What rent does the paybill account hold?
select u.short_code as unit_code, u.unit_number, u.rent_amount as unit_rent, t.full_name as tenant
from public.units u
left join public.tenants t on t.unit_id = u.id
where upper(trim(u.short_code)) = 'UNIT-1';

-- 2) Restate Due on the recorded Co-op payments from that rent
update public.payments p
set due_amount = u.rent_amount
from public.tenants t
join public.units u on u.id = t.unit_id
where p.tenant_id = t.id
  and coalesce(p.due_amount, 0) = 0
  and p.coop_payment_reference is not null
  and coalesce(u.rent_amount, 0) > 0;

-- 3) Check what is now recorded for the Co-op paybill rows:
-- select p.coop_payment_reference, p.amount as paid, p.due_amount as due,
--        t.full_name as tenant, u.short_code as unit_code, u.rent_amount as unit_rent
-- from public.payments p
-- join public.tenants t on t.id = p.tenant_id
-- left join public.units u on u.id = t.unit_id
-- where p.coop_payment_reference is not null
-- order by p.paid_at desc;
