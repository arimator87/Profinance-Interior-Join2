/* ProFinance Interior — minimal service worker.
   Purpose: satisfy PWA installability (beforeinstallprompt requires a SW
   with a fetch handler). Network-only passthrough — no caching, so dev
   assets never go stale. */

self.addEventListener("install", () => {
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(self.clients.claim());
});

self.addEventListener("fetch", (event) => {
  if (event.request.method !== "GET") return;
  event.respondWith(fetch(event.request));
});
