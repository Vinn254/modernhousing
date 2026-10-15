-- Tenancy Agreement Builder
-- Adds a reusable library of agreement items (lease clauses + property condition
-- checklist) and a per-tenant tenancy_agreements table that drives the
-- landlord builder -> tenant check/acknowledge/submit -> landlord review -> PDF flow.

create extension if not exists "pgcrypto";

-- ---------------------------------------------------------------------------
-- Library of selectable agreement items
-- ---------------------------------------------------------------------------
create table if not exists agreement_items (
  id uuid primary key default gen_random_uuid(),
  category text not null,
  label text not null,
  body_text text,
  sort_order integer not null default 0,
  created_at timestamp with time zone default now()
);

create index if not exists agreement_items_category_idx on agreement_items (category);
create index if not exists agreement_items_sort_idx on agreement_items (sort_order);

-- ---------------------------------------------------------------------------
-- Per-tenant tenancy agreements
-- ---------------------------------------------------------------------------
create table if not exists tenancy_agreements (
  id uuid primary key default gen_random_uuid(),
  property_id uuid references properties(id) on delete set null,
  tenant_id uuid references tenants(id) on delete cascade,
  organization_id uuid,
  landlord_email text,
  created_by uuid,
  title text not null default 'Tenancy Agreement',
  description text,
  selected_item_ids jsonb not null default '[]'::jsonb,
  tenant_checks jsonb not null default '[]'::jsonb,
  tenant_acknowledged boolean not null default false,
  tenant_notes text,
  status text not null default 'draft'
    check (status in ('draft', 'sent', 'submitted', 'reviewed', 'completed')),
  sent_at timestamp with time zone,
  submitted_at timestamp with time zone,
  reviewed_at timestamp with time zone,
  created_at timestamp with time zone default now(),
  updated_at timestamp with time zone default now()
);

create index if not exists tenancy_agreements_tenant_idx on tenancy_agreements (tenant_id);
create index if not exists tenancy_agreements_property_idx on tenancy_agreements (property_id);
create index if not exists tenancy_agreements_status_idx on tenancy_agreements (status);

-- ---------------------------------------------------------------------------
-- Seed the item library from the Springfield rental lease document
-- (33 lease clauses + Appendix 1 property condition checklist).
-- Idempotent: only seeds when the library is empty.
-- ---------------------------------------------------------------------------
insert into agreement_items (category, label, body_text, sort_order)
select * from (values
  ('Lease Clauses', '1. Premises', 'Landlord hereby leases the premises located at the agreed property and county to the Tenant.', 1),
  ('Lease Clauses', '2. Terms', 'The term of this Agreement shall commence and end on the dates stated. Possession is granted only after the Agreement is signed and a copy of the Tenant''s National ID is submitted to the Landlord.', 2),
  ('Lease Clauses', '3. Payments', 'Tenant shall pay rent and other charges by the methods the Landlord indicates. All payments are made in advance on the 1st day of each month. Due date is the 1st to 6th; reminder period the 7th to 10th; penalty period the 11th to 15th.', 3),
  ('Lease Clauses', '4. Deposits', 'The Landlord acknowledges receipt of the first month rent and a security deposit. The deposit is refunded after a joint inspection, less any charges incurred by the Tenant. The deposit cannot be used as a substitute for rent.', 4),
  ('Lease Clauses', '5. Late Charge', 'A late fee is due for any rent payment made after the 9th day of the month.', 5),
  ('Lease Clauses', '6. Use of Premises', 'Tenant shall use the premises for a private residential residence only and obey all applicable laws and association restrictions.', 6),
  ('Lease Clauses', '7. Occupancy', 'The premises shall be occupied only by the listed adults and children. No other occupants without prior written consent from the Landlord. Occasional overnight visitors are exempt.', 7),
  ('Lease Clauses', '8. Utilities', 'Tenant agrees to pay all utilities and services provided on the premises. The Landlord does not supply utilities and is not responsible for failure to receive them.', 8),
  ('Lease Clauses', '9. Pets', 'No animal, chicken, fowl, fish, reptile or pet of any kind shall be kept on the premises without prior written consent of the Landlord.', 9),
  ('Lease Clauses', '10. Liquid Filled Furnishings', 'No liquid filled furniture containing more than ten gallons of liquid is permitted without prior written consent, and the Tenant must carry insurance covering any damage caused.', 10),
  ('Lease Clauses', '11. Noise', 'Tenant agrees not to cause or allow any noise or activity that disturbs the peace, quiet and enjoyment of neighboring units.', 11),
  ('Lease Clauses', '12. Destruction of Premises', 'If an act of God or natural disaster partially or totally destroys the premises and the Tenant''s use is seriously impaired, either party may terminate this Agreement with 30 days written notice.', 12),
  ('Lease Clauses', '13. Condition of Premises', 'Tenant acknowledges the premises and all furnishings, fixtures and plumbing are clean and in good working condition, and agrees to keep them so, returning them in good condition except for reasonable wear and tear.', 13),
  ('Lease Clauses', '14. Property Alterations', 'Tenant shall not alter the premises (painting, signs, redecorating, changing locks, installing equipment, nails or adhesives) without prior written approval from the Landlord.', 14),
  ('Lease Clauses', '15. Property Maintenance', 'Tenant is responsible for proper garbage removal, compliance with association rules, and maintaining kitchen and bathroom sinks and drains. Landlord is responsible for general cleanliness of the property.', 15),
  ('Lease Clauses', '16. Change of Terms', 'Landlord reserves the right to change the terms of this Agreement after the initial lease ends and upon 30 days written notice.', 16),
  ('Lease Clauses', '17. Termination of Agreement', 'This Agreement terminates on the stated end date and requires a new lease to continue. Upon termination the Tenant shall vacate, remove belongings and return keys. Holding over makes the Tenant liable for additional rent and damages.', 17),
  ('Lease Clauses', '18. Possession', 'If the Landlord cannot deliver possession on the agreed date, either party may cancel this Agreement with written notice and the security deposit is returned in full. Otherwise rent is prorated from the date of actual possession.', 18),
  ('Lease Clauses', '19. Insurance & Risk of Loss', 'The Landlord''s insurance does not cover the Tenant''s personal property. The Landlord is not liable for loss, damage or theft of the Tenant''s belongings, except where caused by the Landlord''s negligence or willful conduct.', 19),
  ('Lease Clauses', '20. Right of Entry and Inspection', 'The Landlord or agent may enter for emergencies, and after 24 hours notice to show the premises, make repairs or inspections, if abandonment is suspected, and every three months to inspect the property.', 20),
  ('Lease Clauses', '21. Assignment', 'The premises, or any part of it, may not be sub-let, transferred or assigned without the prior consent of the Landlord.', 21),
  ('Lease Clauses', '22. Partial Invalidity', 'If any part of this Agreement conflicts with the law, that part is void to the extent of the conflict but the rest of the Agreement remains valid and enforceable.', 22),
  ('Lease Clauses', '23. No Waiver', 'The Landlord''s acceptance of rent after a default, or waiver of any breach, does not constitute a waiver of subsequent breaches.', 23),
  ('Lease Clauses', '24. Choice of Law and Forum', 'This Agreement is governed by the laws of Kenya. Any legal action shall be conducted in the county where the premises is located.', 24),
  ('Lease Clauses', '25. Attorney Fees', 'The reasonable attorney fees and costs of any litigation brought under this Agreement shall be awarded to the prevailing party.', 25),
  ('Lease Clauses', '26. Jointly and Severally', 'If there is more than one Tenant, all tenants are jointly and severally responsible and liable for all obligations under this Agreement.', 26),
  ('Lease Clauses', '27. Report to Credit/Tenant Agencies', 'The Landlord may notify a credit-reporting agency of nonpayment, late payment or breach of this Agreement, which may negatively affect the Tenant''s credit history.', 27),
  ('Lease Clauses', '28. Notices', 'All notices to the Tenant shall be served at the premises and all notices to the Landlord shall be served personally.', 28),
  ('Lease Clauses', '29. Emergency Number', 'In an emergency the Tenant may contact the Landlord or listed agent. All issues pertaining to the stay shall be handled by the listed person.', 29),
  ('Lease Clauses', '30. Subordination', 'This Agreement is subordinate to the lien of any mortgage encumbering the fee title to the premises.', 30),
  ('Lease Clauses', '31. Recovery Costs', 'Any costs the Landlord incurs in reserving rights under this Agreement or recovering rent arrears, penalties and damages (lawyers, auctioneers, etc.) shall be at the Tenant''s cost.', 31),
  ('Lease Clauses', '32. Entire Agreement', 'This Agreement constitutes the entire Agreement between Landlord and Tenant and supersedes any prior oral or written agreements. Modifications must be in writing and signed by both parties.', 32),
  ('Lease Clauses', '33. Receipt of Agreement', 'The Tenant acknowledges receipt of a copy of this Agreement.', 33),
  ('Property Condition - Bedsitter Room', 'Bedsitter: Floor', 'Condition of the bedsitter room floor at commencement and end of tenancy.', 101),
  ('Property Condition - Bedsitter Room', 'Bedsitter: Walls & Ceiling', 'Condition of the bedsitter room walls and ceiling.', 102),
  ('Property Condition - Bedsitter Room', 'Bedsitter: Bulb Holder', 'Condition of the bulb holder.', 103),
  ('Property Condition - Bedsitter Room', 'Bedsitter: Switch (Kitchen/Room)', 'Condition of the kitchen/room switches.', 104),
  ('Property Condition - Bedsitter Room', 'Bedsitter: Window', 'Condition of the window.', 105),
  ('Property Condition - Bedsitter Room', 'Bedsitter: Main Metre', 'Condition of the main metre.', 106),
  ('Property Condition - Bedsitter Room', 'Bedsitter: Metal Door', 'Condition of the metal door.', 107),
  ('Property Condition - Bedsitter Room', 'Bedsitter: Curtain Rail - Door', 'Condition of the door curtain rail.', 108),
  ('Property Condition - Bedsitter Room', 'Bedsitter: Sockets', 'Condition of the electrical sockets.', 109),
  ('Property Condition - Small Kitchen', 'Kitchen: Floor', 'Condition of the small kitchen floor.', 201),
  ('Property Condition - Small Kitchen', 'Kitchen: Socket', 'Condition of the kitchen socket.', 202),
  ('Property Condition - Small Kitchen', 'Kitchen: Walls & Ceiling', 'Condition of the kitchen walls and ceiling.', 203),
  ('Property Condition - Small Kitchen', 'Kitchen: Window', 'Condition of the kitchen window.', 204),
  ('Property Condition - Small Kitchen', 'Kitchen: Curtain Rail - Window', 'Condition of the window curtain rail.', 205),
  ('Property Condition - Small Kitchen', 'Kitchen: Wash Basin', 'Condition of the kitchen wash basin.', 206),
  ('Property Condition - Small Kitchen', 'Kitchen: Sink(s) & Plumbing', 'Condition of the sink(s) and plumbing.', 207),
  ('Property Condition - Restroom/Bathroom', 'Bathroom: Floor', 'Condition of the restroom/bathroom floor.', 301),
  ('Property Condition - Restroom/Bathroom', 'Bathroom: Walls & Ceiling', 'Condition of the bathroom walls and ceiling.', 302),
  ('Property Condition - Restroom/Bathroom', 'Bathroom: Window', 'Condition of the bathroom window.', 303),
  ('Property Condition - Restroom/Bathroom', 'Bathroom: Toilet & Plumbing', 'Condition of the toilet and plumbing.', 304),
  ('Property Condition - Restroom/Bathroom', 'Bathroom: Instant Shower', 'Condition of the instant shower.', 305),
  ('Property Condition - Restroom/Bathroom', 'Bathroom: Instant Shower Switch', 'Condition of the instant shower switch.', 306),
  ('Property Condition - Restroom/Bathroom', 'Bathroom: Door', 'Condition of the bathroom door.', 307),
  ('Property Condition - Restroom/Bathroom', 'Bathroom: Door Lock', 'Condition of the bathroom door lock.', 308),
  ('Property Condition - Restroom/Bathroom', 'Bathroom: Door Keys', 'Presence and condition of the bathroom door keys.', 309),
  ('Property Condition - Restroom/Bathroom', 'Bathroom: Bathroom Switch', 'Condition of the bathroom switch.', 310)
) as seed(category, label, body_text, sort_order)
where not exists (select 1 from agreement_items);
