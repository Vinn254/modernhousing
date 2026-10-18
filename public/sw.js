// Phones and laptops that visited between 26 July and 2 September 2026 had this
// file registered as a cache-first service worker, and it stays installed even
// though the app no longer registers it. Its old fetch handler served cached
// HTML for every request and answered failed requests with the cached
// homepage, so a rebuilt deployment leaves those devices running stale page
// HTML plus HTML-as-JavaScript, which crashes the app. This replacement does
// one job: delete everything the old worker stored and unregister itself.
self.addEventListener('install', () => self.skipWaiting());

self.addEventListener('activate', (event) => {
  event.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(keys.map((key) => caches.delete(key)));
    await self.registration.unregister();
    const windows = await self.clients.matchAll({ type: 'window' });
    windows.forEach((windowClient) => windowClient.navigate(windowClient.url));
  })());
});
