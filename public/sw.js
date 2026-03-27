const CACHE_NAME = 'sentinel-core-v1';
// Target the specific Google Apps Script Edge Endpoint domain
const EDGE_TARGET = 'script.google.com/macros';

self.addEventListener('install', (event) => {
  self.skipWaiting();
  console.log('Sentinel Engine: Service Worker Installed (Post-Quantum Secure)');
});

self.addEventListener('activate', (event) => {
  // Purge old caches on version bump
  event.waitUntil(
    caches.keys().then((cacheNames) =>
      Promise.all(
        cacheNames
          .filter((name) => name !== CACHE_NAME)
          .map((name) => caches.delete(name))
      )
    ).then(() => clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  const { request } = event;

  // SKIP non-GET requests entirely (POST to Gemini API, etc.)
  // The Cache API does not support caching POST requests.
  if (request.method !== 'GET') return;

  // SKIP non-http(s) schemes (chrome-extension://, moz-extension://, etc.)
  // The Cache API only supports http/https — attempting to cache other schemes throws TypeError.
  const url = new URL(request.url);
  if (url.protocol !== 'http:' && url.protocol !== 'https:') return;

  // 1. Intercept Edge Endpoint Requests (Network-first, cache fallback)
  if (request.url.includes(EDGE_TARGET)) {
    event.respondWith(
      fetch(request)
        .then((response) => {
          // Network Success: Clone and cache the live payload
          const responseClone = response.clone();
          caches.open(CACHE_NAME).then((cache) => {
            cache.put(request, responseClone);
          });
          return response;
        })
        .catch(() => {
          // Network Failure: Serve the last known cached payload
          console.warn('Sentinel Engine: Network severed. Engaging offline cache.');
          return caches.match(request);
        })
    );
  } else {
    // 2. Standard Asset Caching (Stale-While-Revalidate)
    event.respondWith(
      caches.match(request).then((cachedResponse) => {
        const fetchPromise = fetch(request).then((networkResponse) => {
          // Only cache valid, non-opaque responses
          if (networkResponse && networkResponse.status === 200 && networkResponse.type !== 'opaque') {
            const clone = networkResponse.clone();
            caches.open(CACHE_NAME).then((cache) => {
              cache.put(request, clone);
            });
          }
          return networkResponse;
        }).catch(() => null);

        return cachedResponse || fetchPromise;
      })
    );
  }
});
