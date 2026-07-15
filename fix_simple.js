const fs = require('fs');
let a = fs.readFileSync('app/admin/page.tsx', 'utf8');
let d = fs.readFileSync('app/dashboard/page.tsx', 'utf8');

// Admin: remove centerLabel and add count outside chart
a = a.replace(/centerLabel=\{String\(occupiedUnits\) \+ '\/' \+ String\(occupiedUnits \+ vacantUnits\)\}/, '');
d = d.replace(/centerLabel=\{String\(stats\.occupiedUnits\) \+ '\/' \+ String\(stats\.occupiedUnits \+ stats\.vacantUnits\)\}/, '');

fs.writeFileSync('app/admin/page.tsx', a);
fs.writeFileSync('app/dashboard/page.tsx', d);
console.log('done');