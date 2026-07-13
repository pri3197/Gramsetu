const CACHE_NAME = 'gramsetu-cache-v12';
const urlsToCache = [
  '/',
  '/index.html',
  '/css/style.css?v=1.0.9',
  '/js/app.js?v=1.0.9',
  '/manifest.json',
  '/icon-192x192.png',
  '/icon-512x512.png',
  '/uploads/farm_life_scene.png',
  '/uploads/sea_fishing_scene.jpg',
  'https://fonts.googleapis.com/css2?family=Outfit:wght@300;400;500;600;700;800&family=Plus+Jakarta+Sans:wght@400;500;600;700&display=swap'
];

// --- Install Event ---
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => {
        console.log('Opened cache');
        // Note: If any URL in urlsToCache 404s, addAll will fail.
        return cache.addAll(urlsToCache);
      })
      .catch(err => console.error('Pre-caching failed during install:', err))
  );
});

// --- Fetch Event (CRASH FIX HERE) ---
self.addEventListener('fetch', event => {
  // Optional: Skip tracking non-GET requests (like POST API submissions)
  if (event.request.method !== 'GET') return;

  event.respondWith(
    caches.match(event.request)
      .then(response => {
        // Cache hit - return the cached file safely
        if (response) {
          return response;
        }

        // Cache miss - hit the live network
        return fetch(event.request);
      })
      .catch(error => {
        // ✨ THE FIX: This blocks the "Uncaught (in promise)" console errors
        console.warn(`[Service Worker] Network request failed for: ${event.request.url}`);

        // If the user is requesting a webpage/HTML route, serve your cached index.html as a fallback
        if (event.request.headers.get('accept')?.includes('text/html')) {
          return caches.match('/index.html');
        }

        // For broken API calls or assets, return a clean, standard HTTP error instead of crashing
        return new Response('Network error occurred', {
          status: 503,
          statusText: 'Service Unavailable',
          headers: new Headers({ 'Content-Type': 'text/plain' })
        });
      })
  );
});

// --- Activate Event ---
self.addEventListener('activate', event => {
  const cacheWhitelist = [CACHE_NAME];
  event.waitUntil(
    caches.keys().then(cacheNames => {
      return Promise.all(
        cacheNames.map(cacheName => {
          if (cacheWhitelist.indexOf(cacheName) === -1) {
            console.log('Deleting old cache:', cacheName);
            return caches.delete(cacheName);
          }
        })
      );
    })
  );
});