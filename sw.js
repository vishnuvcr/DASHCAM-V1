const CACHE = "dashcam-v1-shell-0.9.0";
const ASSETS = [
  "./",
  "./index.html",
  "./manifest.json",
  "./css/app.css",
  "./js/app.js",
  "./js/camera.js",
  "./js/storage.js",
  "./js/telemetry.js",
  "./js/perception/geometry.js",
  "./js/perception/tracker.js",
  "./js/perception/collision.js",
  "./js/perception/distance.js",
  "./js/perception/lanes.js",
  "./js/perception/lane-detector.js",
  "./js/perception/detector.js",
  "./js/perception/pipeline.js",
  "./js/ai/runtime.js",
  "./js/ai/preprocess.js",
  "./js/ai/yolo.js",
  "./js/ai/worker-client.js",
  "./js/ai/inference-worker.js",
  "./models/manifest.json"
];

self.addEventListener("install", (event) => {
  event.waitUntil(caches.open(CACHE).then((cache) => cache.addAll(ASSETS)));
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((key) => key !== CACHE).map((key) => caches.delete(key)))
    )
  );
  self.clients.claim();
});

self.addEventListener("fetch", (event) => {
  if (event.request.method !== "GET") return;
  event.respondWith(
    caches.match(event.request).then((cached) =>
      cached || fetch(event.request).then((response) => {
        const copy = response.clone();
        caches.open(CACHE).then((cache) => cache.put(event.request, copy));
        return response;
      }).catch(() => caches.match("./index.html"))
    )
  );
});
