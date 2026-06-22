import './globals.css';
import type { Metadata } from 'next';
import dynamic from 'next/dynamic';

const AppHeader = dynamic(() => import('./components/AppHeader'), { ssr: false });

export const metadata: Metadata = {
  title: 'Springfield Systems',
  description: 'Apartment management portal for project managers, agents, admins, and tenants',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="" />
        <link href="https://fonts.googleapis.com/css2?family=Outfit:wght@400;500;600;700;800&display=swap" rel="stylesheet" />
      </head>
      <body>
        <AppHeader />
        {children}
      </body>
    </html>
  );
}