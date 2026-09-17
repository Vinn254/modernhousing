'use client';

import { useEffect } from 'react';
import { usePathname, useSearchParams } from 'next/navigation';

export default function GoogleAnalytics() {
  const pathname = usePathname();
  const searchParams = useSearchParams();

  useEffect(() => {
    const gaId = process.env.NEXT_PUBLIC_GA_ID;
    if (!gaId || gaId.startsWith('G-XXXXXXXX')) return;

      const handleRouteChange = (url: string) => {
        const w = window as any;
        if (w.gtag) {
          w.gtag('config', gaId, {
            page_path: url,
          });
        }
      };

    const query = searchParams.toString();
    const url = query ? `${pathname}?${query}` : pathname;
    handleRouteChange(url);
  }, [pathname, searchParams]);

  const gaId = process.env.NEXT_PUBLIC_GA_ID;
  if (!gaId || gaId.startsWith('G-XXXXXXXX')) return null;

  return (
    <>
      <script
        async
        src={`https://www.googletagmanager.com/gtag/js?id=${gaId}`}
      />
      <script
        dangerouslySetInnerHTML={{
          __html: `
            window.dataLayer = window.dataLayer || [];
            function gtag(){dataLayer.push(arguments);}
            gtag('js', new Date());
            gtag('config', '${gaId}', {
              page_path: window.location.pathname,
            });
          `,
        }}
      />
    </>
  );
}
