const fs = require('fs');
let content = fs.readFileSync('app/payments/page.tsx', 'utf8');

content = content.replace(
  /className="action-button" style={{ background: "var\(--accent\)", color: "#fff", padding: "6px 12px", fontSize: "12px" }} style={{ padding: '6px 12px', fontSize: '12px' }}/,
  "className=\"action-button primary\" style={{ padding: '6px 12px', fontSize: '12px' }}"
);

fs.writeFileSync('app/payments/page.tsx', content);
console.log('done');