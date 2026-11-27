/* 사주냥이 서비스 워커
   - 버전이 붙은 파일(?v=)은 내용이 바뀌지 않으므로 캐시에서 바로 연다(두 번째 방문부터 즉시).
   - 화면(HTML)은 네트워크 우선, 3초 안에 답이 없거나 오프라인이면 캐시로.
   - /api 는 항상 네트워크로(캐시하지 않음). */
const V = "27";
const CACHE = "nyang-v" + V;
const JS = ["core", "shell", "home", "luck", "saju", "compat", "inyeon", "talk", "reading", "records", "play", "path", "flow", "look", "init"];
const SHELL = ["/", "/boot.js?v=1", `/style.css?v=${V}`, "/nyang.js?v=3", "/nyang.svg", "/manifest.webmanifest",
  ...JS.map((n) => `/js/${n}.js?v=${V}`)];
self.addEventListener("install", (e) => { e.waitUntil(caches.open(CACHE).then((c) => c.addAll(SHELL)).catch(() => {})); self.skipWaiting(); });
self.addEventListener("activate", (e) => {
  e.waitUntil(caches.keys().then((ks) => Promise.all(ks.filter((k) => k !== CACHE).map((k) => caches.delete(k)))));
  self.clients.claim();
});

const put = (req, res) => { if (res.ok && res.type === "basic") { const copy = res.clone(); caches.open(CACHE).then((c) => c.put(req, copy)).catch(() => {}); } return res; };
const timeout = (ms) => new Promise((_, rej) => setTimeout(() => rej(new Error("timeout")), ms));

self.addEventListener("fetch", (e) => {
  const u = new URL(e.request.url);
  if (e.request.method !== "GET" || u.origin !== location.origin || u.pathname.startsWith("/api/") || u.pathname.startsWith("/_vercel/")) return;
  if (u.searchParams.has("v")) {  // 버전 고정 파일: 캐시 우선
    e.respondWith(caches.match(e.request).then((m) => m || fetch(e.request).then((res) => put(e.request, res))));
    return;
  }
  const net = fetch(e.request).then((res) => put(e.request, res));
  net.catch(() => {});  // 캐시로 답한 뒤 늦게 실패해도 조용히
  e.respondWith(Promise.race([net, timeout(3000)]).catch(() => caches.match(e.request, { ignoreSearch: e.request.mode === "navigate" })
    .then((m) => m || net).catch(() => caches.match("/"))));
});

// 아침 운세 알림
self.addEventListener("push", (e) => {
  let d = {};
  try { d = e.data ? e.data.json() : {}; } catch { d = { body: e.data && e.data.text() }; }
  e.waitUntil(self.registration.showNotification(d.title || "🐾 사주냥이", {
    body: d.body || "오늘의 운세가 도착했다냥!", icon: "/icon-192.png", badge: "/icon-192.png", tag: d.tag || "nyang-morning", data: { url: d.url || "/" },
  }));
});
self.addEventListener("notificationclick", (e) => {
  e.notification.close();
  // 알림에 실린 주소는 우리 사이트 안쪽만 연다
  let url = "/";
  try { const t = new URL((e.notification.data && e.notification.data.url) || "/", location.origin); if (t.origin === location.origin) url = t.pathname + t.search; } catch { /* 기본값 */ }
  e.waitUntil(self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((cs) => {
    const c = cs.find((x) => new URL(x.url).origin === location.origin);
    return c ? c.focus().then(() => c.navigate(url)).catch(() => self.clients.openWindow(url)) : self.clients.openWindow(url);
  }));
});
