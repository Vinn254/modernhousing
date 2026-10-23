-- Springfield Systems — backfill Due Amount on Co-operative Bank payments
--
-- Payment Advice rows written before this fix stored no due_amount, so the
-- Payments page (and the landlord PDF statement) fell back to the amount the
-- bank sent — a KSH 100 test posting therefore showed "Due 100" instead of the
-- unit's rent. New postings are stamped with the unit rent automatically.
--
-- Run this once in Supabase → SQL Editor. It only touches payments that came
-- through the Co-op B2B paybill whose due_amount is empty or zero, and only
-- where the unit actually has a rent set, so nothing else changes.

update public.payments p
set due_amount = coalesce(nullif(u.rent_amount, 0), nullif(t.rent_amount, 0))
from public.tenants t
join public.units u on u.id = t.unit_id
where p.tenant_id = t.id
  and coalesce(p.due_amount, 0) = 0
  and p.coop_payment_reference is not null
  and coalesce(nullif(u.rent_amount, 0), nullif(t.rent_amount, 0)) is not null;

-- Check what is now recorded for the Co-op paybill rows:
-- select p.coop_payment_reference, p.amount as paid, p.due_amount as due,
--        t.full_name as tenant, u.short_code as unit_code, u.rent_amount as unit_rent
-- from public.payments p
-- join public.tenants t on t.id = p.tenant_id
-- left join public.units u on u.id = t.unit_id
-- where p.coop_payment_reference is not null
-- order by p.paid_at desc;
