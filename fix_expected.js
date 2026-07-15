const fs = require('fs');
let content = fs.readFileSync('app/api/dashboard/route.ts', 'utf8');

// Fix missing expectedRent and simplify the owed calculation
const oldRentOwed = `    const rentOwedByTenant = tenantsForOwedFiltered.map((tenant: any) => {
      // Get all payments for this tenant where balance_remaining indicates unpaid amount
      const tenantPayments = (rentPaymentsData ?? []).filter((p: any) => p.tenant_id === tenant.id && !nonPaymentTypes.includes(p.transaction_type));
      // Sum all balance_remaining values - these represent the unpaid amounts
      const balance = tenantPayments.reduce((sum: number, p: any) => sum + toNumber(p.balance_remaining ?? 0), 0);
      // Total paid = due_amount - balance_remaining for each payment
      const totalPaid = tenantPayments.reduce((sum: number, p: any) => sum + toNumber(p.amount ?? 0), 0);

      return {
        id: tenant.id,
        full_name: tenant.full_name,
        email: tenant.email,
        unit: tenant.units?.unit_number ?? null,
        property: tenant.units?.properties?.name ?? null,
        total_paid: totalPaid,
        rent_amount: expectedRent,
        balance_remaining: Math.max(0, balance),
        last_payment: tenantPayments.length > 0 
          ? tenantPayments.sort((a: any, b: any) => new Date(b.created_at ?? 0).getTime() - new Date(a.created_at ?? 0).getTime())[0]?.created_at
          : null,
      };
    });`;

const newRentOwed = `    const rentOwedByTenant = tenantsForOwedFiltered.map((tenant: any) => {
      // Get all payments for this tenant where balance_remaining indicates unpaid amount
      const tenantPayments = (rentPaymentsData ?? []).filter((p: any) => p.tenant_id === tenant.id && !nonPaymentTypes.includes(p.transaction_type));
      // Sum all balance_remaining values - these represent the unpaid amounts
      const balance = tenantPayments.reduce((sum: number, p: any) => sum + toNumber(p.balance_remaining ?? 0), 0);
      const totalPaid = tenantPayments.reduce((sum: number, p: any) => sum + toNumber(p.amount ?? 0), 0);
      const expectedRent = toNumber(tenant.units?.rent_amount ?? 0);

      return {
        id: tenant.id,
        full_name: tenant.full_name,
        email: tenant.email,
        unit: tenant.units?.unit_number ?? null,
        property: tenant.units?.properties?.name ?? null,
        total_paid: totalPaid,
        rent_amount: expectedRent,
        balance_remaining: Math.max(0, balance),
        last_payment: tenantPayments.length > 0 
          ? tenantPayments.sort((a: any, b: any) => new Date(b.created_at ?? 0).getTime() - new Date(a.created_at ?? 0).getTime())[0]?.created_at
          : null,
      };
    });`;

content = content.replace(oldRentOwed, newRentOwed);

fs.writeFileSync('app/api/dashboard/route.ts', content);
console.log('done');