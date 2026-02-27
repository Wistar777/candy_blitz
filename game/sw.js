const CACHE_NAME = 'candy-blitz-v1';
const urlsToCache = [
    '/',
    '/index.html',
    '/game-main.css',
    '/game-main.js',
    '/blockchain.js',
    '/config.js',
    '/audio.js',
    '/effects.js',
    '/storage.js',
    '/manifest.json',
    '/photos/map-bg.png',
    '/photos/music.mp3',
    '/photos/levels/chocolate.png',
    '/photos/levels/lollipop.png',
    '/photos/levels/gummy.png',
    '/photos/levels/cupcake.png',
    '/photos/levels/cookie.png',
    '/photos/levels/donut.png',
];

self.addEventListener('install', event => {
    self.skipWaiting();
    event.waitUntil(
        caches.open(CACHE_NAME)
            .then(cache => cache.addAll(urlsToCache))
            .catch(() => { })
    );
});

self.addEventListener('activate', event => {
    // Clean old caches
    event.waitUntil(
        caches.keys().then(keys =>
            Promise.all(keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k)))
        )
    );
});

self.addEventListener('fetch', event => {
    const url = event.request.url;

    // Network-first for HTML (always get latest)
    if (event.request.mode === 'navigate' || url.endsWith('.html')) {
        event.respondWith(
            fetch(event.request)
                .then(response => {
                    const clone = response.clone();
                    caches.open(CACHE_NAME).then(cache => cache.put(event.request, clone));
                    return response;
                })
                .catch(() => caches.match(event.request))
        );
        return;
    }

    // Cache-first for assets (images, audio, css, js)
    event.respondWith(
        caches.match(event.request)
            .then(response => response || fetch(event.request))
    );
});
