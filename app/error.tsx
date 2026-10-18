'use client';

import { useEffect } from 'react';

// A stale build is what usually produces this on a phone: the browser kept an
// old copy of the page and asks for script files the new deployment no longer
// has, so nothing renders. Reloading lets the service worker hand over to the
// current build.
const isStaleBuild = (message?: string) =>
  /loading chunk|dynamically imported module|failed to fetch|missing cached instance/i.test(message ?? '');

export default function AppError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error('Client-side exception:', error);
  }, [error]);

  const stale = isStaleBuild(error?.message);

  return (
    <main style={{ padding: '40px 16px' }}>
      <article className="card" style={{ maxWidth: 560, margin: '0 auto' }}>
        <div className="card-label">Something went wrong</div>
        <h2 style={{ marginTop: 6 }}>This page could not be displayed</h2>
        <p style={{ fontSize: 13, color: 'var(--ink-2)', lineHeight: 1.6 }}>
          {stale
            ? 'Your browser was holding an older copy of the app. Reloading normally fixes this straight away.'
            : 'Please try again. If the problem continues, reload the page or sign in again.'}
        </p>
        {error?.digest && (
          <p style={{ fontSize: 11, color: 'var(--ink-3)' }}>Reference: {error.digest}</p>
        )}
        <div style={{ display: 'flex', gap: 10, marginTop: 16, flexWrap: 'wrap' }}>
          <button className="btn" onClick={() => window.location.reload()}>
            Reload the page
          </button>
          <button className="btn btn-secondary" onClick={reset}>
            Try again
          </button>
        </div>
      </article>
    </main>
  );
}
