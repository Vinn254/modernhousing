import './globals.css';
import type { Metadata, Viewport } from 'next';
import AuthWrapper from './auth-wrapper';
import { Inter } from 'next/font/google';

const inter = Inter({ subsets: ['latin'], weight: ['300','400','500','600','700','800'], display: 'swap' });

export const metadata: Metadata = {
  metadataBase: new URL('https://modernhousing.vercel.app'),
  title: {
    default: 'Springfield Systems - Property Management Platform',
    template: '%s | Springfield Systems',
  },
  description: 'Comprehensive property management platform for landlords, agents, and tenants. Manage properties, tenants, payments, and leases in one workspace.',
  keywords: ['property management', 'landlord', 'tenant', 'rent', 'lease', 'payments', 'agents', 'Kenya'],
  authors: [{ name: 'Springfield Systems' }],
  creator: 'Springfield Systems',
  openGraph: {
    type: 'website',
    locale: 'en_KE',
    url: 'https://modernhousing.vercel.app',
    siteName: 'Springfield Systems',
    title: 'Springfield Systems - Property Management Platform',
    description: 'Manage properties, tenants, payments, and leases efficiently.',
    images: [
      {
        url: '/og-image.png',
        width: 1200,
        height: 630,
        alt: 'Springfield Systems',
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Springfield Systems - Property Management Platform',
    description: 'Manage properties, tenants, payments, and leases efficiently.',
    images: ['/og-image.png'],
  },
  manifest: '/manifest.json',
  appleWebApp: {
    capable: true,
    statusBarStyle: 'default',
    title: 'Springfield Systems',
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      'max-video-preview': -1,
      'max-image-preview': 'large',
      'max-snippet': -1,
    },
  },
  icons: {
    icon: '/favicon.ico',
    apple: '/apple-icon.png',
  },
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 5,
  themeColor: '#10b981',
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