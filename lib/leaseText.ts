// Canonical tenancy wording, transcribed verbatim from the signed Springfield
// "RENTAL LEASE" document (Appendix 1 included). This module is the single
// source of truth for the landlord builder default, the item library seed and
// the generated PDF, so the three can never drift apart.

export interface LeaseClause {
  no: number;
  heading: string;
  body: string;
}

export const LEASE_PROPERTY = 'Springfield Real Estate';
export const LEASE_LANDLORD = 'SPRINGFIELD EADWINE LIMITED';
export const LEASE_ADDRESS = 'Nyalenda / Oboch Area, Kisumu County, Kenya';

// Rows of the "All payments are to be made in advance" payment table in clause 3.
export const PAYMENT_METHOD_ROWS = [
  { description: 'Name', bank: 'David Nyamundhe', mpesa: 'David Nyamundhe' },
  { description: 'Account Number', bank: '', mpesa: '0721634528' },
  { description: 'Pay Bill', bank: '', mpesa: '' },
  { description: 'Institution', bank: '', mpesa: 'Safaricom Limited' },
];

export const LEASE_PREAMBLE = `This LEASE AGREEMENT, hereafter referred to as "Agreement" is made this day of __________________ , between DAVID NYAMUNDHE KENYAN NATIONAL IDENTITY NUMBER 24928619 K.R.A PIN A006243981X hereafter referred to as "Landlord" and __________________ , KENYAN NATIONAL IDENTITY NUMBER ________________ K.R.A PIN ________________ hereafter referred to as "Tenant."

The tenant being a student at __________________ is a dependant of the parents details as below;

FATHER: ______________________  TEL: ______________  ID NO.: ______________

MOTHER: ______________________  TEL: ______________  ID NO.: ______________

WHEREAS Landlord and Tenant in consideration for this Agreement hereby covenant and agree to the following:`;

export const LEASE_CLAUSES: LeaseClause[] = [
  {
    no: 1,
    heading: 'PREMISES',
    body: 'Landlord hereby leases the premises located at Nyalenda, Oboch area in the city of Kisumu and the county of Kisumu.',
  },
  {
    no: 2,
    heading: 'TERMS',
    body: "The term of this Agreement shall commence from ................................. to ..................................... Possession will be granted as from .............................., subject to the signing of the Tenancy Agreement. This date will also be the commencement of the Agreement and full rent mentioned in this agreement. Possession of the premises will not be given before the full Agreement has been signed and copy of Tenant's Kenya National Identity Card is submitted to the Landlord.",
  },
  {
    no: 3,
    heading: 'PAYMENTS',
    body: `Tenant shall pay to Landlord Rent and/or other charges by the methods Landlord indicates as follows;

Name: David Nyamundhe (Bank Account) / David Nyamundhe (M-Pesa)
Account Number: (Bank Account) / 0721634528 (M-Pesa)
Institution: Safaricom Limited (M-Pesa)

All payments are to be made in advance on the 1st day of each month. The monthly rent is Kenya Shillings Six Thousand Only (Kshs 6,000). Below is a schedule for rent payment;

- Due Date - 1st to 6th of every month.
- Reminder period - 7th to 10th of every month
- Penalty Period - 11th to 15th of every month.

Due Date is always on 1st of every month; it supersedes / does not consider the date of moving into the apartment.

Self-Initiated vacating date is on 30th/31st of every month. 30 day notice period must be issued or you forfeit your deposit.`,
  },
  {
    no: 4,
    heading: 'DEPOSITS',
    body: `The Landlord acknowledges receipts of the following initial deposits:

First Month Rent Kshs 6,000

Security Deposit Kshs 6,000

The Security deposit refund - The landlord and tenant shall undertake a joint inspection of the premises 2 days to the vacation date. Once agreed regarding damages the deposit will be refunded on the vacating day. The Security deposit will be returned less any charges incurred by Tenant. If the amount of costs and damages exceeds the Security deposit, Tenant shall pay the additional costs within immediately of receipt of the bill on the day of joint inspection.

PLEASE NOTE THE SECURITY DEPOSIT CANNOT BE USED AS A SUBSTITUTE OF RENT PAYMENT UNDER ANY CIRCUMSTANCES.

Water deposits shall be paid by the Tenant to Kisumu Water and Sewerage Company's (KIWASCO's) water distributor Ring road Water Company (Nyalenda). (Terms and Conditions apply)`,
  },
  {
    no: 5,
    heading: 'LATE CHARGE',
    body: 'A late fee of Kenya Shillings Five Hundred Only (Kshs 500) is due for any payment of rent made after the 9th day of the month. If any lease payment is by cash, m-pesa or money transfers.',
  },
  {
    no: 6,
    heading: 'USE OF PREMISES',
    body: `Tenant shall use premises for a private residential residence. Tenant shall obey all applicable laws and association restrictions that apply to the premises.`,
  },
  {
    no: 7,
    heading: 'OCCUPANCY',
    body: `Premises shall be occupied by the following adults and/or children:

NAMES ______________________________________  ID NO: ______________________

NAMES ______________________________________  ID NO: ______________________

There shall be no other occupants on the premises, without prior written consent from Landlord. Occasional overnight visitors are exempt from this requirement.`,
  },
  {
    no: 8,
    heading: 'UTILITIES',
    body: 'Tenant agrees to pay all utilities and/or services provided on the premises. Utilities for this address are Electric and Water/Wastewater. Landlord does not supply any utilities and is not responsible for the failure to receive utilities.',
  },
  {
    no: 9,
    heading: 'PETS',
    body: 'No animal, Chicken, fowl, fish, reptile and/or pet of any kind shall be kept on or about the premises without obtaining the prior written consent of the Landlord. Failure to comply with this provision may be grounds for immediate termination of this Agreement.',
  },
  {
    no: 10,
    heading: 'LIQUID FILLED FURNISHINGS',
    body: "No liquid filled furniture containing more than ten gallons of liquid is permitted without prior written consent of Landlord. Upon Landlord's consent, Tenant is required to carry insurance to cover any damage, water or otherwise that may be caused by the liquid filled furnishings.",
  },
  {
    no: 11,
    heading: 'NOISE',
    body: 'Tenant agrees not to cause or allow any noise or activity on the premises which may disturb the peace, quiet, and enjoyment of neighboring units. Tenant shall also not cause or allow any noise in violation of any apartment or condo association rules and regulations. Failure to comply with this provision may be grounds for immediate termination of this Agreement.',
  },
  {
    no: 12,
    heading: 'DESTRUCTION OF PREMISES',
    body: "In the event an act of god or natural disaster partially or totally destroys the premises and Tenant's use is seriously impaired, the Landlord or Tenant may terminate this LEASE AGREEMENT with 30 day's written notice provided to the Landlord or Tenant at their place of residence.",
  },
  {
    no: 13,
    heading: 'CONDITION OF PREMISES',
    body: `Tenant acknowledges that s/he has/had the opportunity to examine the premises and that the premises, including all furnishings, fixtures, furniture, plumbing, heating, electrical facilities, all items listed on the attached property condition checklist, if any, and/or all other items provided by Landlord are clean and in good working condition. If upon examination, the premise contains any furnishings or fixtures which are in non-working or poor condition, Landlord should be immediately made aware of the situation, except as may be indicated elsewhere in this Agreement. Tenant agrees to keep the premises and all items in good condition and working order. Any items damaged by Tenants, or Tenant's guests or invitees, should be immediately repaired or replaced. At the termination of this Agreement, all of above items in this section should be returned to Landlord in good, clean, and working condition, except for reasonable wear and tear. Landlord finds the following to not be "wear and tear":

a. Left behind personal property

b. Burns, holes, tears, and stains on the premises (walls, carpeting, fixtures, etc.)

c. Dirt`,
  },
  {
    no: 14,
    heading: 'PROPERTY ALTERATIONS',
    body: 'Tenant shall not alter premises, without prior written approval from Landlord when applicable. This includes painting walls, placing signs or displays on the premises, and any redecorating. Paint, wallpaper, alter or redecorate, change or install locks, install antenna or other equipment, screws, fastening devices, large nails, or adhesive materials, place signs, displays, or other exhibits, on or in any portion of the premises is not permitted without the written consent of the Landlord.',
  },
  {
    no: 15,
    heading: 'PROPERTY MAINTENANCE',
    body: `Tenant is responsible for the following maintenance:

a. Proper Garbage removal

b. Proper Use and Compliance with all Association rules regarding Common Garbage receptacle area

c. Maintaining Kitchen and Bathroom sinks and drains. (Tenant is responsible for any costs associated with clearing debris from plumbing and any damage caused by the stopping or overflow of water from pipes or sinks.

Landlord is responsible for the following maintenance:

a. General cleanliness of the property.`,
  },
  {
    no: 16,
    heading: 'CHANGE OF TERMS',
    body: 'Landlord reserves the right to change the terms and conditions of this Agreement after the termination of the initial lease and upon 30 days written notice of the change of terms.',
  },
  {
    no: 17,
    heading: 'TERMINATION OF AGREEMENT',
    body: "This Agreement automatically terminates on the above date. If Tenant and Landlord wish to continue this Agreement, a new lease will be required. This Agreement may also be terminated by a breach of this Agreement or if required by law. Upon termination, Tenant shall vacate premises. Tenant is responsible for removing his/her belongings and returning keys and any items provided by Landlord for Tenant's use in the premises. If Tenant fails to vacate, and holds over, Tenant is liable for additional rent and damages, including loss of potential new renters.",
  },
  {
    no: 18,
    heading: 'POSSESSION',
    body: 'If Landlord is unable to deliver possession of the residence to Tenant on the agreed date, for any reason including whether by loss/destruction of the premises, or failure of prior or because of the failure of the prior Tenant, Tenant and/or Landlord may immediately cancel and terminate this Agreement with written notice to the address listed below in this Agreement. At the time of termination, neither party shall have liability to the other and any security deposit funds shall be returned in full to tenant. If neither party cancels the Agreement due to inability to deliver possession, this rental payment shall be prorated for the initial month and this Agreement shall begin on the date of actual possession.',
  },
  {
    no: 19,
    heading: 'INSURANCE & RISK OF LOSS',
    body: "Landlord's insurance does not cover Tenant's personal property damage caused by fire, theft, rain, war, acts of God and it is advisable that Tenant have insurance to cover his/her personal property. Further, Landlord shall not be liable for any loss, damage, or theft to the contents, belongings, or personal effects of the Tenant's, Tenant's family, Tenant's guests, or visitors. This provision does not protect Landlord or Tenant for responsibility for loss or damages caused by Landlord or Tenants' negligence, recklessness, or willful conduct.",
  },
  {
    no: 20,
    heading: 'RIGHT OF ENTRY AND INSPECTION',
    body: `Landlord or Landlord's agent may enter the premises in the following circumstances:

a. At any time for an emergency in order to protect or preserve the premises

b. After 24 hour advance to show the premises to prospective renters, buyers, lenders

c. After 24 hour advance notice to make inspections, repairs, or improvements (Landlord is in sole discretion of the necessary repairs, improvements, or inspections that may be performed.)

d. If Tenant is absent from premises for more than one rental period and abandonment of the premises is suspected.

e. After every three month the Landlord will inspect the house to ensure it is property maintained and if any damages are found the tenant to be instructed to repair immediately.`,
  },
  {
    no: 21,
    heading: 'ASSIGNMENT',
    body: 'The Premises, or any part thereof, may not be sub-let, transferred, or assigned without prior consent of Landlord.',
  },
  {
    no: 22,
    heading: 'PARTIAL INVALIDITY',
    body: "Nothing contained in this Agreement shall be construed as waiving any of the Landlord's or Tenant's rights under the law. If any part of this Agreement shall be in conflict with the law, that part shall be void to the extent that it is in conflict, but shall not invalidate this Agreement nor shall it affect the validity or enforceability of any other provision of this Agreement.",
  },
  {
    no: 23,
    heading: 'NO WAIVER',
    body: "Landlord's acceptance of rent after a default by Tenant or waiver by Landlord of any breach of this Agreement does not constitute a waiver or subsequent breaches. Failure to require compliance or exercise rights associated with this Agreement does not constitute a waiver by Landlord of said term, condition, and/or right, and shall not affect the validity or enforceability of any provision of this Agreement.",
  },
  {
    no: 24,
    heading: 'CHOICE OF LAW AND FORUM',
    body: 'This Agreement is governed by the laws of the Kenya. In the event of any legal action, the filings or proceedings shall be conducted in the county where the Premises is located.',
  },
  {
    no: 25,
    heading: 'ATTORNEY FEES',
    body: 'The reasonable attorney fees and costs of any litigation or legal action brought under this Agreement shall be awarded to the prevailing party, in addition to any damages awarded.',
  },
  {
    no: 26,
    heading: 'JOINTLY AND SEVERALLY',
    body: 'If there is more than one Tenant, all tenants are jointly and severally responsible and liable for all obligations under this Agreement.',
  },
  {
    no: 27,
    heading: 'REPORT TO CREDIT/TENANT AGENCIES',
    body: 'Landlord has the right to notify a tenant or credit-reporting agency for a nonpayment, late payment, or breach of any terms of this Agreement. This report may negatively affect your credit history.',
  },
  {
    no: 28,
    heading: 'NOTICES',
    body: "All notices to Tenant shall be served at Tenant's premises and all notices to Landlord shall be served to him personally.",
  },
  {
    no: 29,
    heading: 'EMERGENCY NUMBER',
    body: 'In the event of an emergency, Tenant may contact the Landlord or agent(s) listed below. David Nyamundhe - +254 721 634528. All issues pertaining your stay at the residence shall solely be handled by the above listed person.',
  },
  {
    no: 30,
    heading: 'SUBORDINATION',
    body: 'This Agreement is subordinate to the lien of any mortgage encumbering the fee title to the Premises.',
  },
  {
    no: 31,
    heading: 'COSTS OF ENFORCEMENT',
    body: "Tenant agrees that any other costs that the landlord may be required to incur in respect of reserving the rights under this agreement or recovering rent arrears/penalties and damages i.e. cost of lawyers, auctioneers etc. will be at the tenants cost.",
  },
  {
    no: 32,
    heading: 'ENTIRE AGREEMENT',
    body: 'This Agreement constitutes the entire Agreement between Landlord and Tenant. This Agreement supersedes any oral or written Agreements entered into before this Agreement. Any modifications of this Agreement shall be in writing and signed by both parties.',
  },
  {
    no: 33,
    heading: 'RECEIPT OF AGREEMENT',
    body: 'Tenant/(s) acknowledge receipt of a copy of this Agreement.',
  },
];

// Appendix 1: Property Condition Check List, in the exact order of the document.
export const CONDITION_SECTIONS = [
  {
    room: 'BEDSITTER ROOM',
    items: [
      'Floor',
      'Walls & Ceiling',
      'Bulb holder',
      'Switch (Kitchen/Room)',
      'Window',
      'Main Metre',
      'Metal Door',
      'Curtain Rail - Door',
      'Sockets',
    ],
  },
  {
    room: 'SMALL KITCHEN',
    items: [
      'Floor',
      'Socket',
      'Walls & Ceiling',
      'Window',
      'Curtain rail - Window',
      'Kitchen Wash Basin',
      'Sink(s) & Plumbing',
    ],
  },
  {
    room: 'RESTROOM/BATHROOM',
    items: [
      'Floor',
      'Walls & Ceiling',
      'Window',
      'Toilet & Plumbing',
      'Instant Shower',
      'Instant Shower Switch',
      'Door',
      'Door Lock',
      'Door Keys',
      'Bathroom Switch',
    ],
  },
];

export const CATEGORY_LEASE = 'Lease Clauses';

// Category strings as they already exist in the agreement_items library.
const CONDITION_CATEGORY: Record<string, string> = {
  'BEDSITTER ROOM': 'Property Condition - Bedsitter Room',
  'SMALL KITCHEN': 'Property Condition - Small Kitchen',
  'RESTROOM/BATHROOM': 'Property Condition - Restroom/Bathroom',
};

export function conditionCategory(room: string): string {
  return CONDITION_CATEGORY[room] ?? `Property Condition - ${room}`;
}

export const CATEGORY_CONDITION_ROOMS = CONDITION_SECTIONS.map((s) => conditionCategory(s.room));

// Item labels as they already exist in the agreement_items library, so the
// runtime tables line up with the seeded rows.
export const clauseLabel = (no: number) => LEASE_LABELS[no];

const LEASE_LABELS: Record<number, string> = {
  1: '1. Premises',
  2: '2. Terms',
  3: '3. Payments',
  4: '4. Deposits',
  5: '5. Late Charge',
  6: '6. Use of Premises',
  7: '7. Occupancy',
  8: '8. Utilities',
  9: '9. Pets',
  10: '10. Liquid Filled Furnishings',
  11: '11. Noise',
  12: '12. Destruction of Premises',
  13: '13. Condition of Premises',
  14: '14. Property Alterations',
  15: '15. Property Maintenance',
  16: '16. Change of Terms',
  17: '17. Termination of Agreement',
  18: '18. Possession',
  19: '19. Insurance & Risk of Loss',
  20: '20. Right of Entry and Inspection',
  21: '21. Assignment',
  22: '22. Partial Invalidity',
  23: '23. No Waiver',
  24: '24. Choice of Law and Forum',
  25: '25. Attorney Fees',
  26: '26. Jointly and Severally',
  27: '27. Report to Credit/Tenant Agencies',
  28: '28. Notices',
  29: '29. Emergency Number',
  30: '30. Subordination',
  31: '31. Recovery Costs',
  32: '32. Entire Agreement',
  33: '33. Receipt of Agreement',
};

// The columns Appendix 1 of the lease is laid out in.
export const CONDITION_COLUMNS = [
  'Condition on Commencement of Tenancy',
  'Comments',
  'Condition on End of Tenancy',
  'Comments',
];

// The agreement body a landlord starts from: the opening of the lease document
// itself — the parties, the dependant/next-of-kin block and the consideration
// clause. The 33 numbered clauses come from the item library, so they are not
// repeated here.
export const DEFAULT_AGREEMENT_DESCRIPTION = `RENTAL LEASE

${LEASE_PREAMBLE}`;
