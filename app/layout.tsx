import './globals.css';
import type { Metadata } from 'next';
import AuthWrapper from './auth-wrapper';
import { Inter } from 'next/font/google';

const inter = Inter({ subsets: ['latin'], weight: ['300','400','500','600','700','800'], display: 'swap' });

export const metadata: Metadata = {
  title: 'Springfield Systems',
  description: 'Apartment management portal for project managers, agents, admins, and tenants',
  manifest: '/manifest.json',
  appleWebApp: {
    capable: true,
    statusBarStyle: 'default',
    title: 'Springfield Systems',
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className={inter.className}>
        <AuthWrapper>{children}</AuthWrapper>
        <script
          dangerouslySetInnerHTML={{
            __html: `
              if ('serviceWorker' in navigator) {
                window.addEventListener('load', () => {
                  navigator.serviceWorker.register('/sw.js').catch(() => {});
                });
              }
            `,
          }}
        />
      </body>
    </html>
  );
}