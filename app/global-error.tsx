'use client';

// Only used when the failure happens in the root layout, where app/error.tsx
// cannot render because the layout itself is broken.
export default function GlobalError({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <html>
      <body style={{ fontFamily: 'system-ui, sans-serif', padding: 40, color: '#1c1e24' }}>
        <h2>Something went wrong</h2>
        <p style={{ fontSize: 14 }}>
          This page could not be displayed. Reload the page, or sign in again if it keeps happening.
        </p>
        <button onClick={reset} style={{ fontSize: 14, padding: '10px 14px', borderRadius: 999 }}>
          Try again
        </button>
      </body>
    </html>
  );
}
