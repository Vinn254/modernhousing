export default function robots() {
  return {
    rules: [
      {
        userAgent: '*',
        allow: '/',
        disallow: ['/api/*', '/_next/*', '/admin/*', '/dashboard/*', '/profile/*', '/properties/*', '/payments/*', '/tenant/*', '/agent/*', '/super-admin/*'],
      },
    ],
    sitemap: 'https://modernhousing.vercel.app/sitemap.xml',
  };
}
