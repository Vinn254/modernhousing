const fs = require('fs');
let content = fs.readFileSync('app/api/dashboard/route.ts', 'utf8');

// Fix filter to include all tenants for rent owed calculation
const oldFilter = `tenantsForOwedFiltered = (tenantsForOwed ?? []).filter((t: any) => t.units?.property_id && propIds.includes(t.units.property_id));`;

const newFilter = `tenantsForOwedFiltered = (tenantsForOwed ?? []).filter((t: any) => !t.units?.property_id || propIds.includes(t.units.property_id));`;

content = content.replace(oldFilter, newFilter);

fs.writeFileSync('app/api/dashboard/route.ts', content);
console.log('done');