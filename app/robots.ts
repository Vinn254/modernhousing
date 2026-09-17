export default function robots() {
  return {
    rules: [
      {
        userAgent: '*',
        allow: '/',
        disallow: ['/api/*', '/_next/*', '/admin/*', '/dashboard/*', '/profile/*', '/properties/*', '/payments/*', '/tenant/*', '/agent/*', '/super-admin/*'],
      },
    ],
    sitemap: 'https://www.springfield-realestate.com/sitemap.xml',
  };
}
