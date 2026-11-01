"use strict";

const CACHE = "ig-analyzer-v3";

const ASSETS = [
  "./",
  "index.html",
  "guida.html",
  "app.js",
  "manifest.json",
  "jszip.min.js",
  "icon-192.png",
  "icon-512.png",
  "Instagram_icon.png",
  "Foto1.png",
  "Foto2.png",
  "Foto3.png",
  "Foto4.png",
  "Foto5.png",
  "Foto6.png"
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE).then((cache) =>
      /* un file mancante non deve far fallire l'installazione */
      Promise.all(ASSETS.map((a) => cache.add(a).catch(() => {})))
    ).then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

/* Rete prima, cache come ripiego: gli aggiornamenti arrivano subito, ma funziona anche offline */
self.addEventListener("fetch", (event) => {
  const req = event.request;
  if (req.method !== "GET" || new URL(req.url).origin !== location.origin) return;

  event.respondWith(
    fetch(req)
      .then((res) => {
        if (res && res.ok) {
          const copy = res.clone();
          caches.open(CACHE).then((c) => c.put(req, copy));
        }
        return res;
      })
      .catch(() => caches.match(req).then((hit) => hit || caches.match("index.html")))
  );
});
