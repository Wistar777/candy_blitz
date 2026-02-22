const CACHE_NAME = 'love-journey-v2';
const urlsToCache = [
    '/',
    '/index.html',
    '/game-main.css',
    '/game-main.js',
    '/manifest.json',
    '/photos/map.jpg',
    '/photos/music.mp3',
    // Baku
    '/photos/baku/1.jpg', '/photos/baku/2.jpg', '/photos/baku/3.jpg',
    '/photos/baku/4.jpg', '/photos/baku/5.jpg', '/photos/baku/6.jpg',
    '/photos/baku/baby.jpg',
    // Bodrum
    '/photos/bodrum/1.jpg', '/photos/bodrum/2.jpg', '/photos/bodrum/3.jpg',
    '/photos/bodrum/4.jpg', '/photos/bodrum/5.jpg', '/photos/bodrum/6.jpg',
    '/photos/bodrum/baby.jpg',
    // Istanbul
    '/photos/istanbul/1.jpg', '/photos/istanbul/2.jpg', '/photos/istanbul/3.jpg',
    '/photos/istanbul/4.jpg', '/photos/istanbul/5.jpg', '/photos/istanbul/6.jpg',
    '/photos/istanbul/baby.jpg',
    // Kalkan
    '/photos/kalkan/1.jpg', '/photos/kalkan/2.jpg', '/photos/kalkan/3.jpg',
    '/photos/kalkan/4.jpg', '/photos/kalkan/5.jpg', '/photos/kalkan/6.jpg',
    '/photos/kalkan/baby.jpg',
    // Dubai
    '/photos/dubai/1.jpg', '/photos/dubai/2.jpg', '/photos/dubai/3.jpg',
    '/photos/dubai/4.jpg', '/photos/dubai/5.jpg', '/photos/dubai/6.jpg',
    '/photos/dubai/baby.jpg',
    // Sharm
    '/photos/sharm/1.jpg', '/photos/sharm/2.jpg', '/photos/sharm/3.jpg',
    '/photos/sharm/4.jpg', '/photos/sharm/5.jpg', '/photos/sharm/6.jpg',
    '/photos/sharm/baby.jpg'
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
