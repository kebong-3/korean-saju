/* 사주냥이 서비스 워커 — 화면 파일은 캐시해 빠르게 열고, /api 는 항상 네트워크로. */
const CACHE = "nyang-v14";
const SHELL = ["/", "/index.html", "/style.css?v=14", "/app.js?v=14", "/nyang.js?v=2", "/nyang.svg", "/manifest.webmanifest"];
self.addEventListener("install", (e) => { e.waitUntil(caches.open(CACHE).then((c) => c.addAll(SHELL)).catch(() => {})); self.skipWaiting(); });
self.addEventListener("activate", (e) => {
  e.waitUntil(caches.keys().then((ks) => Promise.all(ks.filter((k) => k !== CACHE).map((k) => caches.delete(k)))));
  self.clients.claim();
});
self.addEventListener("fetch", (e) => {
  const u = new URL(e.request.url);
  if (e.request.method !== "GET" || u.origin !== location.origin || u.pathname.startsWith("/api/")) return;
  // 네트워크 우선, 실패하면 캐시(오프라인에서도 화면은 열리게)
  e.respondWith(fetch(e.request).then((res) => {
    const copy = res.clone();
    caches.open(CACHE).then((c) => c.put(e.request, copy)).catch(() => {});
    return res;
  }).catch(() => caches.match(e.request).then((m) => m || caches.match("/"))));
});
