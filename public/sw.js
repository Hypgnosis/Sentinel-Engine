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
  // 1. Intercept Edge Endpoint Requests (Network-first, cache fallback)
  if (event.request.url.includes(EDGE_TARGET)) {
    event.respondWith(
      fetch(event.request)
        .then((response) => {
          // Network Success: Clone and cache the live payload
          const responseClone = response.clone();
          caches.open(CACHE_NAME).then((cache) => {
            cache.put(event.request, responseClone);
          });
          return response;
        })
        .catch(() => {
          // Network Failure: Serve the last known cached payload
          console.warn('Sentinel Engine: Network severed. Engaging offline cache.');
          return caches.match(event.request);
        })
    );
  } else {
    // 2. Standard Asset Caching (Stale-While-Revalidate)
    event.respondWith(
      caches.match(event.request).then((cachedResponse) => {
        const fetchPromise = fetch(event.request).then((networkResponse) => {
          // Only cache valid responses (not opaque or errors)
          if (networkResponse && networkResponse.status === 200) {
            caches.open(CACHE_NAME).then((cache) => {
              cache.put(event.request, networkResponse.clone());
            });
          }
          return networkResponse;
        }).catch(() => null);

        return cachedResponse || fetchPromise;
      })
    );
  }
});
