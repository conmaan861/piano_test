const CACHE_NAME = 'tempo-studio-v14';
const APP_SHELL = [
  './',
  './index.html',
  './app.css',
  './app.js?v=14',
  './store.js?v=14',
  './audio.js?v=14',
  './manifest.webmanifest',
  './icon-192.png',
  './icon-512.png',
  './greyhound-mascot-sprite.png'
];

self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(async cache => {
      await cache.addAll(APP_SHELL);
      try {
        const response = await fetch('https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2', { mode: 'no-cors' });
        await cache.put('https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2', response);
      } catch (error) {
        console.info('Cloud library will be cached on the next connected visit.');
      }
    })
  );
  self.skipWaiting();
});

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(key => key !== CACHE_NAME).map(key => caches.delete(key))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', event => {
  if (event.request.method !== 'GET') return;
  const url = new URL(event.request.url);

  if (event.request.mode === 'navigate') {
    event.respondWith(
      fetch(event.request)
        .then(response => {
          const copy = response.clone();
          caches.open(CACHE_NAME).then(cache => cache.put('./index.html', copy));
          return response;
        })
        .catch(() => caches.match('./index.html'))
    );
    return;
  }

  if (url.origin === self.location.origin || url.hostname === 'cdn.jsdelivr.net') {
    event.respondWith(
      caches.match(event.request).then(cached => {
        const network = fetch(event.request).then(response => {
          if (response.ok || response.type === 'opaque') {
            const copy = response.clone();
            caches.open(CACHE_NAME).then(cache => cache.put(event.request, copy));
          }
          return response;
        });
        return cached || network;
      })
    );
  }
});
