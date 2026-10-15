-- Replace the summarised agreement-item wording with the verbatim text of the
-- signed Springfield "RENTAL LEASE" document, and turn Appendix 1 (Property
-- Condition Check List) into table rows: the room is the category, the item is
-- the label, and the condition/comment columns are left blank for handwriting.
--
-- Safe to re-run. The original seed in agreement_builder_migration.sql only
-- inserts when the library is empty, so this UPDATE is what fixes an
-- already-seeded database. Run this file AFTER agreement_builder_migration.sql
-- so a fresh database also ends up on the lease wording.

-- ---------------------------------------------------------------------------
-- 1. Lease clauses 1-33, word for word from the document
-- ---------------------------------------------------------------------------
update agreement_items set body_text = 'Landlord hereby leases the premises located at Nyalenda, Oboch area in the city of Kisumu and the county of Kisumu.'
  where category = 'Lease Clauses' and label = '1. Premises';

update agreement_items set body_text = 'The term of this Agreement shall commence from ................................. to ..................................... Possession will be granted as from .............................., subject to the signing of the Tenancy Agreement. This date will also be the commencement of the Agreement and full rent mentioned in this agreement. Possession of the premises will not be given before the full Agreement has been signed and copy of Tenant''s Kenya National Identity Card is submitted to the Landlord.'
  where category = 'Lease Clauses' and label = '2. Terms';

update agreement_items set body_text = 'Tenant shall pay to Landlord Rent and/or other charges by the methods Landlord indicates as follows;' || E'\n\n' ||
  'Name: David Nyamundhe (Bank Account) / David Nyamundhe (M-Pesa)' || E'\n' ||
  'Account Number: (Bank Account) / 0721634528 (M-Pesa)' || E'\n' ||
  'Institution: Safaricom Limited (M-Pesa)' || E'\n\n' ||
  'All payments are to be made in advance on the 1st day of each month. The monthly rent is Kenya Shillings Six Thousand Only (Kshs 6,000). Below is a schedule for rent payment;' || E'\n\n' ||
  '- Due Date - 1st to 6th of every month.' || E'\n' ||
  '- Reminder period - 7th to 10th of every month' || E'\n' ||
  '- Penalty Period - 11th to 15th of every month.' || E'\n\n' ||
  'Due Date is always on 1st of every month; it supersedes / does not consider the date of moving into the apartment.' || E'\n\n' ||
  'Self-Initiated vacating date is on 30th/31st of every month. 30 day notice period must be issued or you forfeit your deposit.'
  where category = 'Lease Clauses' and label = '3. Payments';

update agreement_items set body_text = 'The Landlord acknowledges receipts of the following initial deposits:' || E'\n\n' ||
  'First Month Rent Kshs 6,000' || E'\n' ||
  'Security Deposit Kshs 6,000' || E'\n\n' ||
  'The Security deposit refund - The landlord and tenant shall undertake a joint inspection of the premises 2 days to the vacation date. Once agreed regarding damages the deposit will be refunded on the vacating day. The Security deposit will be returned less any charges incurred by Tenant. If the amount of costs and damages exceeds the Security deposit, Tenant shall pay the additional costs within immediately of receipt of the bill on the day of joint inspection.' || E'\n\n' ||
  'PLEASE NOTE THE SECURITY DEPOSIT CANNOT BE USED AS A SUBSTITUTE OF RENT PAYMENT UNDER ANY CIRCUMSTANCES.' || E'\n\n' ||
  'Water deposits shall be paid by the Tenant to Kisumu Water and Sewerage Company''s (KIWASCO''s) water distributor Ring road Water Company (Nyalenda). (Terms and Conditions apply)'
  where category = 'Lease Clauses' and label = '4. Deposits';

update agreement_items set body_text = 'A late fee of Kenya Shillings Five Hundred Only (Kshs 500) is due for any payment of rent made after the 9th day of the month. If any lease payment is by cash, m-pesa or money transfers.'
  where category = 'Lease Clauses' and label = '5. Late Charge';

update agreement_items set body_text = 'Tenant shall use premises for a private residential residence. Tenant shall obey all applicable laws and association restrictions that apply to the premises.'
  where category = 'Lease Clauses' and label = '6. Use of Premises';

update agreement_items set body_text = 'Premises shall be occupied by the following adults and/or children:' || E'\n\n' ||
  'NAMES ______________________________________  ID NO: ______________________' || E'\n\n' ||
  'NAMES ______________________________________  ID NO: ______________________' || E'\n\n' ||
  'There shall be no other occupants on the premises, without prior written consent from Landlord. Occasional overnight visitors are exempt from this requirement.'
  where category = 'Lease Clauses' and label = '7. Occupancy';

update agreement_items set body_text = 'Tenant agrees to pay all utilities and/or services provided on the premises. Utilities for this address are Electric and Water/Wastewater. Landlord does not supply any utilities and is not responsible for the failure to receive utilities.'
  where category = 'Lease Clauses' and label = '8. Utilities';

update agreement_items set body_text = 'No animal, Chicken, fowl, fish, reptile and/or pet of any kind shall be kept on or about the premises without obtaining the prior written consent of the Landlord. Failure to comply with this provision may be grounds for immediate termination of this Agreement.'
  where category = 'Lease Clauses' and label = '9. Pets';

update agreement_items set body_text = 'No liquid filled furniture containing more than ten gallons of liquid is permitted without prior written consent of Landlord. Upon Landlord''s consent, Tenant is required to carry insurance to cover any damage, water or otherwise that may be caused by the liquid filled furnishings.'
  where category = 'Lease Clauses' and label = '10. Liquid Filled Furnishings';

update agreement_items set body_text = 'Tenant agrees not to cause or allow any noise or activity on the premises which may disturb the peace, quiet, and enjoyment of neighboring units. Tenant shall also not cause or allow any noise in violation of any apartment or condo association rules and regulations. Failure to comply with this provision may be grounds for immediate termination of this Agreement.'
  where category = 'Lease Clauses' and label = '11. Noise';

update agreement_items set body_text = 'In the event an act of god or natural disaster partially or totally destroys the premises and Tenant''s use is seriously impaired, the Landlord or Tenant may terminate this LEASE AGREEMENT with 30 day''s written notice provided to the Landlord or Tenant at their place of residence.'
  where category = 'Lease Clauses' and label = '12. Destruction of Premises';

update agreement_items set body_text = 'Tenant acknowledges that s/he has/had the opportunity to examine the premises and that the premises, including all furnishings, fixtures, furniture, plumbing, heating, electrical facilities, all items listed on the attached property condition checklist, if any, and/or all other items provided by Landlord are clean and in good working condition. If upon examination, the premise contains any furnishings or fixtures which are in non-working or poor condition, Landlord should be immediately made aware of the situation, except as may be indicated elsewhere in this Agreement. Tenant agrees to keep the premises and all items in good condition and working order. Any items damaged by Tenants, or Tenant''s guests or invitees, should be immediately repaired or replaced. At the termination of this Agreement, all of above items in this section should be returned to Landlord in good, clean, and working condition, except for reasonable wear and tear. Landlord finds the following to not be "wear and tear":' || E'\n\n' ||
  'a. Left behind personal property' || E'\n' ||
  'b. Burns, holes, tears, and stains on the premises (walls, carpeting, fixtures, etc.)' || E'\n' ||
  'c. Dirt'
  where category = 'Lease Clauses' and label = '13. Condition of Premises';

update agreement_items set body_text = 'Tenant shall not alter premises, without prior written approval from Landlord when applicable. This includes painting walls, placing signs or displays on the premises, and any redecorating. Paint, wallpaper, alter or redecorate, change or install locks, install antenna or other equipment, screws, fastening devices, large nails, or adhesive materials, place signs, displays, or other exhibits, on or in any portion of the premises is not permitted without the written consent of the Landlord.'
  where category = 'Lease Clauses' and label = '14. Property Alterations';

update agreement_items set body_text = 'Tenant is responsible for the following maintenance:' || E'\n\n' ||
  'a. Proper Garbage removal' || E'\n' ||
  'b. Proper Use and Compliance with all Association rules regarding Common Garbage receptacle area' || E'\n' ||
  'c. Maintaining Kitchen and Bathroom sinks and drains. (Tenant is responsible for any costs associated with clearing debris from plumbing and any damage caused by the stopping or overflow of water from pipes or sinks.' || E'\n\n' ||
  'Landlord is responsible for the following maintenance:' || E'\n\n' ||
  'a. General cleanliness of the property.'
  where category = 'Lease Clauses' and label = '15. Property Maintenance';

update agreement_items set body_text = 'Landlord reserves the right to change the terms and conditions of this Agreement after the termination of the initial lease and upon 30 days written notice of the change of terms.'
  where category = 'Lease Clauses' and label = '16. Change of Terms';

update agreement_items set body_text = 'This Agreement automatically terminates on the above date. If Tenant and Landlord wish to continue this Agreement, a new lease will be required. This Agreement may also be terminated by a breach of this Agreement or if required by law. Upon termination, Tenant shall vacate premises. Tenant is responsible for removing his/her belongings and returning keys and any items provided by Landlord for Tenant''s use in the premises. If Tenant fails to vacate, and holds over, Tenant is liable for additional rent and damages, including loss of potential new renters.'
  where category = 'Lease Clauses' and label = '17. Termination of Agreement';

update agreement_items set body_text = 'If Landlord is unable to deliver possession of the residence to Tenant on the agreed date, for any reason including whether by loss/destruction of the premises, or failure of prior or because of the failure of the prior Tenant, Tenant and/or Landlord may immediately cancel and terminate this Agreement with written notice to the address listed below in this Agreement. At the time of termination, neither party shall have liability to the other and any security deposit funds shall be returned in full to tenant. If neither party cancels the Agreement due to inability to deliver possession, this rental payment shall be prorated for the initial month and this Agreement shall begin on the date of actual possession.'
  where category = 'Lease Clauses' and label = '18. Possession';

update agreement_items set body_text = 'Landlord''s insurance does not cover Tenant''s personal property damage caused by fire, theft, rain, war, acts of God and it is advisable that Tenant have insurance to cover his/her personal property. Further, Landlord shall not be liable for any loss, damage, or theft to the contents, belongings, or personal effects of the Tenant''s, Tenant''s family, Tenant''s guests, or visitors. This provision does not protect Landlord or Tenant for responsibility for loss or damages caused by Landlord or Tenants'' negligence, recklessness, or willful conduct.'
  where category = 'Lease Clauses' and label = '19. Insurance & Risk of Loss';

update agreement_items set body_text = 'Landlord or Landlord''s agent may enter the premises in the following circumstances:' || E'\n\n' ||
  'a. At any time for an emergency in order to protect or preserve the premises' || E'\n' ||
  'b. After 24 hour advance to show the premises to prospective renters, buyers, lenders' || E'\n' ||
  'c. After 24 hour advance notice to make inspections, repairs, or improvements (Landlord is in sole discretion of the necessary repairs, improvements, or inspections that may be performed.)' || E'\n' ||
  'd. If Tenant is absent from premises for more than one rental period and abandonment of the premises is suspected.' || E'\n' ||
  'e. After every three month the Landlord will inspect the house to ensure it is property maintained and if any damages are found the tenant to be instructed to repair immediately.'
  where category = 'Lease Clauses' and label = '20. Right of Entry and Inspection';

update agreement_items set body_text = 'The Premises, or any part thereof, may not be sub-let, transferred, or assigned without prior consent of Landlord.'
  where category = 'Lease Clauses' and label = '21. Assignment';

update agreement_items set body_text = 'Nothing contained in this Agreement shall be construed as waiving any of the Landlord''s or Tenant''s rights under the law. If any part of this Agreement shall be in conflict with the law, that part shall be void to the extent that it is in conflict, but shall not invalidate this Agreement nor shall it affect the validity or enforceability of any other provision of this Agreement.'
  where category = 'Lease Clauses' and label = '22. Partial Invalidity';

update agreement_items set body_text = 'Landlord''s acceptance of rent after a default by Tenant or waiver by Landlord of any breach of this Agreement does not constitute a waiver or subsequent breaches. Failure to require compliance or exercise rights associated with this Agreement does not constitute a waiver by Landlord of said term, condition, and/or right, and shall not affect the validity or enforceability of any provision of this Agreement.'
  where category = 'Lease Clauses' and label = '23. No Waiver';

update agreement_items set body_text = 'This Agreement is governed by the laws of the Kenya. In the event of any legal action, the filings or proceedings shall be conducted in the county where the Premises is located.'
  where category = 'Lease Clauses' and label = '24. Choice of Law and Forum';

update agreement_items set body_text = 'The reasonable attorney fees and costs of any litigation or legal action brought under this Agreement shall be awarded to the prevailing party, in addition to any damages awarded.'
  where category = 'Lease Clauses' and label = '25. Attorney Fees';

update agreement_items set body_text = 'If there is more than one Tenant, all tenants are jointly and severally responsible and liable for all obligations under this Agreement.'
  where category = 'Lease Clauses' and label = '26. Jointly and Severally';

update agreement_items set body_text = 'Landlord has the right to notify a tenant or credit-reporting agency for a nonpayment, late payment, or breach of any terms of this Agreement. This report may negatively affect your credit history.'
  where category = 'Lease Clauses' and label = '27. Report to Credit/Tenant Agencies';

update agreement_items set body_text = 'All notices to Tenant shall be served at Tenant''s premises and all notices to Landlord shall be served to him personally.'
  where category = 'Lease Clauses' and label = '28. Notices';

update agreement_items set body_text = 'In the event of an emergency, Tenant may contact the Landlord or agent(s) listed below. David Nyamundhe - +254 721 634528. All issues pertaining your stay at the residence shall solely be handled by the above listed person.'
  where category = 'Lease Clauses' and label = '29. Emergency Number';

update agreement_items set body_text = 'This Agreement is subordinate to the lien of any mortgage encumbering the fee title to the Premises.'
  where category = 'Lease Clauses' and label = '30. Subordination';

update agreement_items set body_text = 'Tenant agrees that any other costs that the landlord may be required to incur in respect of reserving the rights under this agreement or recovering rent arrears/penalties and damages i.e. cost of lawyers, auctioneers etc. will be at the tenants cost.'
  where category = 'Lease Clauses' and label = '31. Recovery Costs';

update agreement_items set body_text = 'This Agreement constitutes the entire Agreement between Landlord and Tenant. This Agreement supersedes any oral or written Agreements entered into before this Agreement. Any modifications of this Agreement shall be in writing and signed by both parties.'
  where category = 'Lease Clauses' and label = '32. Entire Agreement';

update agreement_items set body_text = 'Tenant/(s) acknowledge receipt of a copy of this Agreement.'
  where category = 'Lease Clauses' and label = '33. Receipt of Agreement';

-- ---------------------------------------------------------------------------
-- 2. Appendix 1 - Property Condition Check List
--    The item is the row label; the room is the category. The document gives
--    these rows no prose, so the invented descriptions are removed.
-- ---------------------------------------------------------------------------
update agreement_items set label = 'Floor',                 body_text = null where category = 'Property Condition - Bedsitter Room'      and label = 'Bedsitter: Floor';
update agreement_items set label = 'Walls & Ceiling',       body_text = null where category = 'Property Condition - Bedsitter Room'      and label = 'Bedsitter: Walls & Ceiling';
update agreement_items set label = 'Bulb holder',           body_text = null where category = 'Property Condition - Bedsitter Room'      and label = 'Bedsitter: Bulb Holder';
update agreement_items set label = 'Switch (Kitchen/Room)', body_text = null where category = 'Property Condition - Bedsitter Room'      and label = 'Bedsitter: Switch (Kitchen/Room)';
update agreement_items set label = 'Window',                body_text = null where category = 'Property Condition - Bedsitter Room'      and label = 'Bedsitter: Window';
update agreement_items set label = 'Main Metre',            body_text = null where category = 'Property Condition - Bedsitter Room'      and label = 'Bedsitter: Main Metre';
update agreement_items set label = 'Metal Door',            body_text = null where category = 'Property Condition - Bedsitter Room'      and label = 'Bedsitter: Metal Door';
update agreement_items set label = 'Curtain Rail - Door',   body_text = null where category = 'Property Condition - Bedsitter Room'      and label = 'Bedsitter: Curtain Rail - Door';
update agreement_items set label = 'Sockets',               body_text = null where category = 'Property Condition - Bedsitter Room'      and label = 'Bedsitter: Sockets';

update agreement_items set label = 'Floor',                   body_text = null where category = 'Property Condition - Small Kitchen' and label = 'Kitchen: Floor';
update agreement_items set label = 'Socket',                  body_text = null where category = 'Property Condition - Small Kitchen' and label = 'Kitchen: Socket';
update agreement_items set label = 'Walls & Ceiling',         body_text = null where category = 'Property Condition - Small Kitchen' and label = 'Kitchen: Walls & Ceiling';
update agreement_items set label = 'Window',                  body_text = null where category = 'Property Condition - Small Kitchen' and label = 'Kitchen: Window';
update agreement_items set label = 'Curtain rail - Window',   body_text = null where category = 'Property Condition - Small Kitchen' and label = 'Kitchen: Curtain Rail - Window';
update agreement_items set label = 'Kitchen Wash Basin',      body_text = null where category = 'Property Condition - Small Kitchen' and label = 'Kitchen: Wash Basin';
update agreement_items set label = 'Sink(s) & Plumbing',      body_text = null where category = 'Property Condition - Small Kitchen' and label = 'Kitchen: Sink(s) & Plumbing';

update agreement_items set label = 'Floor',                  body_text = null where category = 'Property Condition - Restroom/Bathroom' and label = 'Bathroom: Floor';
update agreement_items set label = 'Walls & Ceiling',        body_text = null where category = 'Property Condition - Restroom/Bathroom' and label = 'Bathroom: Walls & Ceiling';
update agreement_items set label = 'Window',                 body_text = null where category = 'Property Condition - Restroom/Bathroom' and label = 'Bathroom: Window';
update agreement_items set label = 'Toilet & Plumbing',      body_text = null where category = 'Property Condition - Restroom/Bathroom' and label = 'Bathroom: Toilet & Plumbing';
update agreement_items set label = 'Instant Shower',         body_text = null where category = 'Property Condition - Restroom/Bathroom' and label = 'Bathroom: Instant Shower';
update agreement_items set label = 'Instant Shower Switch',  body_text = null where category = 'Property Condition - Restroom/Bathroom' and label = 'Bathroom: Instant Shower Switch';
update agreement_items set label = 'Door',                   body_text = null where category = 'Property Condition - Restroom/Bathroom' and label = 'Bathroom: Door';
update agreement_items set label = 'Door Lock',              body_text = null where category = 'Property Condition - Restroom/Bathroom' and label = 'Bathroom: Door Lock';
update agreement_items set label = 'Door Keys',              body_text = null where category = 'Property Condition - Restroom/Bathroom' and label = 'Bathroom: Door Keys';
update agreement_items set label = 'Bathroom Switch',        body_text = null where category = 'Property Condition - Restroom/Bathroom' and label = 'Bathroom: Bathroom Switch';

-- ---------------------------------------------------------------------------
-- 3. Agreements already sent carry the summarised description. Replace it with
--    the lease wording where the body is still exactly the old default.
-- ---------------------------------------------------------------------------
update tenancy_agreements
set description = E'ReNTAL LEASE\n\n'
  || 'This LEASE AGREEMENT, hereafter referred to as "Agreement" is made this day of __________________ , between DAVID NYAMUNDHE KENYAN NATIONAL IDENTITY NUMBER 24928619 K.R.A PIN A006243981X hereafter referred to as "Landlord" and __________________ , KENYAN NATIONAL IDENTITY NUMBER ________________ K.R.A PIN ________________ hereafter referred to as "Tenant."' || E'\n\n'
  || 'The tenant being a student at __________________ is a dependant of the parents details as below;' || E'\n\n'
  || 'FATHER: ______________________  TEL: ______________  ID NO.: ______________' || E'\n\n'
  || 'MOTHER: ______________________  TEL: ______________  ID NO.: ______________' || E'\n\n'
  || 'WHEREAS Landlord and Tenant in consideration for this Agreement hereby covenant and agree to the following:'
where description like 'RENTAL LEASE AGREEMENT%';
