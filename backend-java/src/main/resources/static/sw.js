const CACHE_NAME = 'gramsetu-cache-v5';
const urlsToCache = [
  '/',
  '/index.html',
  '/css/style.css?v=1.0.3',
  '/js/app.js?v=1.0.2',
  '/manifest.json',
  '/icon-192x192.png',
  '/icon-512x512.png',
  '/uploads/farm_life_scene.png',
  '/uploads/sea_fishing_scene.jpg',
  '/uploads/mangrove_2010.png',
  '/uploads/mangrove_2026.png',
  'https://fonts.googleapis.com/css2?family=Outfit:wght@300;400;500;600;700;800&family=Plus+Jakarta+Sans:wght@400;500;600;700&display=swap'
];


self.addEventListener('install', event => {
  // Perform install steps
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => {
        console.log('Opened cache');
        return cache.addAll(urlsToCache);
      })
  );
});

self.addEventListener('fetch', event => {
  event.respondWith(
    caches.match(event.request)
      .then(response => {
        // Cache hit - return response
        if (response) {
          return response;
        }
        return fetch(event.request);
      }
    )
  );
});

self.addEventListener('activate', event => {
  const cacheWhitelist = [CACHE_NAME];
  event.waitUntil(
    caches.keys().then(cacheNames => {
      return Promise.all(
        cacheNames.map(cacheName => {
          if (cacheWhitelist.indexOf(cacheName) === -1) {
            return caches.delete(cacheName);
          }
        })
      );
    })
  );
});
