import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Property Management Plans and Pricing',
  description: 'Compare Springfield Systems subscription plans for managing rental properties, agents, tenants, and payments in Kenya.',
  alternates: {
    canonical: '/pricing',
  },
  openGraph: {
    title: 'Property Management Plans and Pricing | Springfield Systems',
    description: 'Compare plans for managing rental properties, agents, tenants, and payments in Kenya.',
    url: '/pricing',
    type: 'website',
  },
};

export default function PricingLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return children;
}
