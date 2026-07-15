const fs = require('fs');
let content = fs.readFileSync('app/agent/tenants/page.tsx', 'utf8');

content = content.replace(
  /<label>Lease Start Date <span style="color: var\(--ink-3\); font-weight: normal;">\(Tenant moves in \/ makes first payment\)<\/span><\/label>/g,
  '<label>Lease Start Date <span style={{ color: "var(--ink-3)", fontWeight: "normal" }}>(Tenant moves in / makes first payment)</span></label>'
).replace(
  /<label>Lease End Date <span style="color: var\(--ink-3\); font-weight: normal;">\(Expected payment due date - typically 30 days after start\)<\/span><\/label>/g,
  '<label>Lease End Date <span style={{ color: "var(--ink-3)", fontWeight: "normal" }}>(Expected payment due date - typically 30 days after start)</span></label>'
);

fs.writeFileSync('app/agent/tenants/page.tsx', content);
console.log('done');