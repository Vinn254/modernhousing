const fs = require('fs');

const manifest = JSON.parse(fs.readFileSync('.next/routes-manifest.json', 'utf8'));
const routes = ['/'];
for (const route of manifest.staticRoutes || []) {
  const page = route.page || '';
  if (page.startsWith('/_') || page.includes('/api/') || page.includes('not-found')) continue;
  if (['/login', '/pricing', '/terms', '/help', '/forgot-password', '/signup', '/reset-password'].includes(page)) {
    routes.push(page);
  }
}
const unique = [...new Set(routes)].sort();
const now = new Date().toISOString().split('T')[0];
const urls = unique.map(r => {
  const prio = r === '/' ? '1.0' : (['/login', '/pricing'].includes(r) ? '0.9' : '0.8');
  return [
    '  <url>',
    '    <loc>https://www.springfield-realestate.com' + r + '</loc>',
    '    <lastmod>' + now + '</lastmod>',
    '    <changefreq>monthly</changefreq>',
    '    <priority>' + prio + '</priority>',
    '  </url>'
  ].join('\n');
});
const sitemap = [
  '<?xml version="1.0" encoding="UTF-8"?>',
  '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">',
  ...urls,
  '</urlset>',
  ''
].join('\n');

fs.writeFileSync('public/sitemap.xml', sitemap);
console.log('Generated sitemap.xml with ' + urls.length + ' URLs');
