-- Springfield Systems — restate Due / Balance on Co-operative Bank payments
--
-- Payment Advice only tells the app what the bank sent. Earlier postings either
-- left due_amount empty (so the statement echoed the amount paid, e.g. "Due
-- 100") or charged the month's rent a second time on a month that was already
-- paid (so the tenant appeared to owe 5,900 they had in fact overpaid).
--
-- The rule now applied at write time, and restated here:
--   * a month is billed once — if the tenant's other lines for that month
--     already carry the unit's rent, the paybill line adds no charge, holds a
--     positive balance and is typed "Rent in advance";
--   * otherwise the line carries the unit's rent as Due, and Balance is what
--     was paid minus that rent.
-- The running balance on the Payments page then applies the credit to the next
-- month automatically.
--
-- Rent lives on units.rent_amount only; the tenants table has no rent column.

-- 0) Pre-flight: both rows must be present before running step 2, because it
--    writes rent_type. If this returns nothing, run db/add_rent_payment_types.sql
--    in this SQL Editor first.
select table_name, column_name
from information_schema.columns
where column_name = 'rent_type'
  and table_name in ('payments', 'bills')
order by table_name;

-- 1) What the paybill account is mapped to, and its rent
select u.short_code as unit_code, u.unit_number, u.rent_amount as unit_rent, t.full_name as tenant
from public.units u
left join public.tenants t on t.unit_id = u.id
where upper(trim(u.short_code)) = 'UNIT-1';

-- 2) Restate the recorded Co-op payments
with unit_rent as (
  select t.id as tenant_id, coalesce(u.rent_amount, 0) as rent
  from public.tenants t
  left join public.units u on u.id = t.unit_id
),
other_charges as (
  select p.id as payment_id,
         p.tenant_id,
         coalesce((
           select sum(x.due_amount)
           from (
             select coalesce(b.due_amount, 0) as due_amount
             from public.bills b
             where b.tenant_id = p.tenant_id and b.month_due = p.month_due
               and coalesce(b.transaction_type, 'rent') = 'rent'
             union all
             select coalesce(q.due_amount, 0) as due_amount
             from public.payments q
             where q.tenant_id = p.tenant_id and q.month_due = p.month_due and q.id <> p.id
               and coalesce(q.transaction_type, 'rent') = 'rent'
           ) x
         ), 0) as charged
  from public.payments p
  where p.coop_payment_reference is not null
)
update public.payments p
set due_amount = case
                   when ur.rent > 0 and c.charged >= ur.rent then 0
                   else ur.rent
                 end,
    balance_remaining = case
                   when ur.rent > 0 and c.charged >= ur.rent then p.amount
                   else p.amount - ur.rent
                 end,
    rent_type = case
                   when ur.rent > 0 and c.charged >= ur.rent then 'rent_in_advance'
                   else p.rent_type
                 end
from other_charges c
join unit_rent ur on ur.tenant_id = c.tenant_id
where p.id = c.payment_id;

-- 3) Check the result: a settled month must read Due 0 with a positive balance
-- select p.month_due, p.coop_payment_reference, p.amount as paid,
--        p.due_amount as due, p.balance_remaining as balance, p.rent_type,
--        t.full_name as tenant, u.rent_amount as unit_rent
-- from public.payments p
-- join public.tenants t on t.id = p.tenant_id
-- left join public.units u on u.id = t.unit_id
-- where p.coop_payment_reference is not null
-- order by p.paid_at desc;
