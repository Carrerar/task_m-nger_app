const CACHE = "focus-board-v18";

const APP_SHELL = [
  "./",
  "./index.html",
  "./styles.css",
  "./manifest.webmanifest",
  "./assets/icon.svg",
  "./assets/bg-train-dusk.png",
  "./js/main.js",
  "./js/core/constants.js",
  "./js/core/utils.js",
  "./js/core/store.js",
  "./js/core/bus.js",
  "./js/core/selectors.js",
  "./js/core/time.js",
  "./js/core/ui-state.js",
  "./js/core/dom.js",
  "./js/features/tasks.js",
  "./js/features/recurring.js",
  "./js/features/sync.js",
  "./js/features/categories.js",
  "./js/features/composer.js",
  "./js/features/io.js",
  "./js/features/dashboard.js",
  "./js/features/calendar.js",
  "./js/ui/render.js",
  "./js/ui/train.js",
  "./js/ui/audio.js",
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE).then((cache) => cache.addAll(APP_SHELL)).then(() => self.skipWaiting()),
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((key) => key !== CACHE).map((key) => caches.delete(key))))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener("fetch", (event) => {
  const { request } = event;
  if (request.method !== "GET") return;

  // Never intercept cross-origin calls (the sync Worker lives elsewhere) —
  // let them hit the network directly, untouched and uncached.
  if (new URL(request.url).origin !== self.location.origin) return;

  // Navigations: serve cached index.html when offline.
  if (request.mode === "navigate") {
    event.respondWith(
      fetch(request).catch(() => caches.match("./index.html")),
    );
    return;
  }

  // Static assets: cache-first, then fill the cache on a network hit.
  event.respondWith(
    caches.match(request).then((cached) => {
      if (cached) return cached;
      return fetch(request).then((response) => {
        if (response.ok && response.type === "basic") {
          const copy = response.clone();
          caches.open(CACHE).then((cache) => cache.put(request, copy));
        }
        return response;
      });
    }),
  );
});
