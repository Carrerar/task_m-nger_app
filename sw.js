const CACHE = "focus-board-v8";

const APP_SHELL = [
  "./",
  "./index.html",
  "./styles.css",
  "./manifest.webmanifest",
  "./icon.svg",
  "./bg-train-dusk.png",
  "./js/main.js",
  "./js/constants.js",
  "./js/time.js",
  "./js/utils.js",
  "./js/dom.js",
  "./js/ui-state.js",
  "./js/store.js",
  "./js/bus.js",
  "./js/audio.js",
  "./js/selectors.js",
  "./js/tasks.js",
  "./js/recurring.js",
  "./js/categories.js",
  "./js/composer.js",
  "./js/io.js",
  "./js/render.js",
  "./js/dashboard.js",
  "./js/calendar.js",
  "./js/train.js",
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
