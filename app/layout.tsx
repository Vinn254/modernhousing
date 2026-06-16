import './globals.css';
import type { Metadata } from 'next';
import AppHeader from './components/AppHeader';

export const metadata: Metadata = {
  title: 'Springfield Systems',
  description: 'Apartment management portal for landlords, agents, admins, and tenants',
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