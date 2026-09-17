/** @type {import('next-sitemap').IConfig} */
module.exports = {
  siteUrl: 'https://www.springfield-realestate.com',
  generateRobotsTxt: true,
  sitemapSize: 7000,
  changefreqs: {
    pages: {
      '/': {
        priority: 1.0,
        changefreq: 'monthly',
      },
      '/login': {
        priority: 0.9,
        changefreq: 'monthly',
      },
      '/pricing': {
        priority: 0.9,
        changefreq: 'monthly',
      },
      '/terms': {
        priority: 0.7,
        changefreq: 'monthly',
      },
      '/help': {
        priority: 0.7,
        changefreq: 'monthly',
      },
    },
  },
  exclude: ['/dashboard/*', '/admin/*', '/agent/*', '/tenant/*', '/super-admin/*', '/properties/*', '/profile/*', '/reset-password/*'],
  robotsTxtOptions: {
    additionalSitemaps: [
      'https://www.springfield-realestate.com/sitemap.xml',
    ],
    policies: [
      {
        userAgent: '*',
        allow: '/',
        disallow: ['/dashboard/*', '/admin/*', '/agent/*', '/tenant/*', '/super-admin/*', '/reset-password/*'],
      },
      {
        userAgent: 'Googlebot',
        allow: '/',
        disallow: ['/dashboard/*', '/admin/*', '/agent/*', '/tenant/*', '/super-admin/*', '/reset-password/*'],
      },
    ],
  },
};
