# Springfield Systems - Property Management Portal

## Workflow Overview

### User Roles
- **Super Admin**: Manages landlords, agents, and properties
- **Admin/Landlord**: Manages tenants, units, payments, and utilities
- **Agent**: Handles tenant assignments for specific properties
- **Tenant**: Views rent/utility bills, makes payments via M-Pesa

### Water Meter Billing
1. Navigate to Utilities page
2. Select unit and enter current meter reading
3. System calculates consumption = current - previous reading
4. Amount = consumption × KES 150
5. Invoice auto-created and visible to tenant in Utility Bills tab

### Other Utility Billing
1. Select tenant from dropdown
2. Choose utility type (garbage, service charge, parking, security, other)
3. Enter amount
4. Invoice auto-created with status 'sent'
5. Visible to tenant in Utility Bills tab

### Rent Payments
- Tenants pay via M-Pesa STK prompt or manual entry
- Payments recorded with balance tracking
- Combined Invoice shows total of rent balance + utility invoices

### Session Timeout
- 5-minute inactivity timeout with warning
- Automatic logout after 6 minutes

## Installation

```bash
npm install
npm run dev
```

## PWA Support
- Installable as mobile/desktop app via browser menu
- Manifest configured at `/public/manifest.json`