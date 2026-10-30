// Naikkan versi ini setiap kali file aplikasi diubah supaya cache diperbarui
const CACHE = 'elio-planner-v9';
const ASSETS = [
  './',
  'index.html',
  'style.css',
  'app.js',
  'courses.js',
  'comps.js',
  'timer.js',
  'plans.js',
  'clock.js',
  'files.js',
  'cloud.js',
  'main.js',
  'manifest.webmanifest',
  'icons/icon.svg',
  'icons/icon-192.png',
  'icons/icon-512.png',
];

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(ASSETS)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

// Network first: selalu coba versi terbaru, pakai cache kalau offline
self.addEventListener('fetch', (e) => {
  if (e.request.method !== 'GET') return;
  // Hanya file aplikasi dan library dari CDN yang disimpan untuk offline.
  // Data dan file dari Supabase selalu diambil langsung supaya tidak basi dan tidak memenuhi cache.
  const url = new URL(e.request.url);
  if (url.origin !== self.location.origin && !/(^|\.)(jsdelivr\.net|unpkg\.com)$/.test(url.hostname)) return;
  e.respondWith(
    fetch(e.request)
      .then((res) => {
        const copy = res.clone();
        caches.open(CACHE).then((c) => c.put(e.request, copy));
        return res;
      })
      .catch(() => caches.match(e.request, { ignoreSearch: true }))
  );
});

// Klik notifikasi pengingat: buka atau fokuskan jendela aplikasi
self.addEventListener('notificationclick', (e) => {
  e.notification.close();
  e.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((list) => {
      const win = list.find((c) => c.url.includes('/planner/'));
      return win ? win.focus() : self.clients.openWindow('./');
    })
  );
});
