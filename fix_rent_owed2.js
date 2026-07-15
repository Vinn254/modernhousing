const fs = require('fs');
let content = fs.readFileSync('app/api/dashboard/route.ts', 'utf8');

const oldCode = `const rentOwedByTenant = tenantsForOwedFiltered.map((tenant: any) => {
      const tenantPayments = (paymentsData ?? []).filter((p: any) => p.tenant_id === tenant.id);
      const totalPaid = tenantPayments.reduce((sum: number, p: any) => sum + toNumber(p.amount), 0);
      const expectedRent = toNumber(tenant.units?.rent_amount ?? 0);
      const balance = tenantPayments.reduce((sum: number, p: any) => sum + toNumber(p.balance_remaining), 0);
      return {
        id: tenant.id,
        full_name: tenant.full_name,
        email: tenant.email,
        unit: tenant.units?.unit_number ?? '—',
        property: tenant.units?.properties?.name ?? '—',
        total_paid: totalPaid,
        rent_amount: expectedRent,
        balance_remaining: balance,
        last_payment: tenantPayments.sort((a: any, b: any) => new Date(b.created_at ?? 0).getTime() - new Date(a.created_at ?? 0).getTime())[0]?.created_at ?? null,
      };
    });`;

const newCode = `const rentOwedByTenant = tenantsForOwedFiltered.map((tenant: any) => {
      // Only rent transaction_type payments for balance calculation
      const rentPayments = (paymentsData ?? []).filter((p: any) => p.tenant_id === tenant.id && (p.transaction_type === 'rent' || p.transaction_type === 'overdue'));
      const totalPaid = rentPayments.reduce((sum: number, p: any) => sum + toNumber(p.paid_amount ?? p.amount), 0);
      const totalDue = rentPayments.reduce((sum: number, p: any) => sum + toNumber(p.due_amount ?? p.amount), 0);
      
      return {
        id: tenant.id,
        full_name: tenant.full_name,
        email: tenant.email,
        unit: tenant.units?.unit_number ?? '—',
        property: tenant.units?.properties?.name ?? '—',
        total_paid: totalPaid,
        rent_amount: toNumber(tenant.units?.rent_amount ?? 0),
        balance_remaining: totalDue - totalPaid,
        last_payment: rentPayments.sort((a: any, b: any) => new Date(b.created_at ?? 0).getTime() - new Date(a.created_at ?? 0).getTime())[0]?.created_at ?? null,
      };
    });`;

if (content.includes(oldCode)) {
  content = content.replace(oldCode, newCode);
  fs.writeFileSync('app/api/dashboard/route.ts', content);
  console.log('Replaced successfully');
} else {
  console.log('Old code not found, checking current content...');
  // Find the position
  const pos = content.indexOf('const rentOwedByTenant = tenantsForOwedFiltered.map');
  if (pos > -1) {
    console.log('Found at position', pos);
    console.log('Context:', content.substring(pos, pos + 500));
  }
}