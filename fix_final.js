const fs = require('fs');
let a = fs.readFileSync('app/admin/page.tsx', 'utf8');
let d = fs.readFileSync('app/dashboard/page.tsx', 'utf8');

// Admin: Replace the whole kpi-tile-chart
a = a.replace(
  /<div className="kpi-tile kpi-tile-chart">[\s\S]*?<\/div>\s*<\/section>/,
  `<div className="kpi-tile kpi-tile-chart">
            <div className="card-label" style={{ justifyContent: 'center' }}><span className="badge badge-pm"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg></span>Unit Occupancy</div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
              <DonutChart data={[
                { label: 'Occupied', value: occupiedUnits, color: '#10b981' },
                { label: 'Vacant', value: vacantUnits, color: '#9ca3af' },
              ]} size={70} />
              <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                <span style={{ fontSize: '22px', fontWeight: 700 }}>{occupiedUnits}/{occupiedUnits + vacantUnits}</span>
                <span style={{ color: 'var(--ink-3)', fontSize: '13px' }}>Occupied / Vacant</span>
              </div>
            </div>
          </div>
        </section>`
);

// Dashboard: Replace the chart container in kpi-tile-chart
d = d.replace(
  /<div style=\{\{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' \}\}>[\s\S]*?<\/div>\s*<\/section>/,
  `<div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
              <DonutChart data={[
                { label: 'Occupied', value: stats.occupiedUnits, color: '#10b981' },
                { label: 'Vacant', value: stats.vacantUnits, color: '#9ca3af' },
              ]} size={70} />
              <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                <span style={{ fontSize: '22px', fontWeight: 700 }}>{stats.occupiedUnits}/{stats.occupiedUnits + stats.vacantUnits}</span>
                <span style={{ color: 'var(--ink-3)', fontSize: '12px', whiteSpace: 'nowrap' }}>Occupied / Vacant</span>
              </div>
            </div>
          </div>
        </section>`
);

fs.writeFileSync('app/admin/page.tsx', a);
fs.writeFileSync('app/dashboard/page.tsx', d);
console.log('done');