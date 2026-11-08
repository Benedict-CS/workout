const CACHE_NAME = "workout-pwa-v2";
const PRECACHE_URLS = [
  "/",
  "/manifest.json",
  "/icons/icon-192.png",
  "/icons/icon-512.png",
  "/icons/apple-touch-icon.png",
  "/icons/favicon-32.png",
  "/exercises",
  "/history",
  "/analytics",
  "/settings",
];

// 1. 安裝事件：預先快取核心 App Shell
self.addEventListener("install", (event) => {
  self.skipWaiting();
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(PRECACHE_URLS).catch((err) => {
        console.warn("Precache failed for some assets:", err);
      });
    })
  );
});

// 2. 啟用事件：清理過期快取並立即接管控制權
self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((cacheNames) => {
        return Promise.all(
          cacheNames.map((name) => {
            if (name !== CACHE_NAME) {
              return caches.delete(name);
            }
          })
        );
      })
      .then(() => self.clients.claim())
  );
});

// 3. 攔截請求：網路優先 (離線時自動回退至本機快取)
self.addEventListener("fetch", (event) => {
  const request = event.request;
  const url = new URL(request.url);

  // 只攔截同源的 GET 請求
  if (request.method !== "GET" || url.origin !== location.origin) {
    return;
  }

  // 靜態 JS/CSS 資源採用 Cache-First (快取優先)
  if (url.pathname.startsWith("/_next/static/") || url.pathname.startsWith("/icons/")) {
    event.respondWith(
      caches.match(request).then((cachedResponse) => {
        if (cachedResponse) return cachedResponse;
        return fetch(request).then((networkResponse) => {
          if (networkResponse.status === 200) {
            const responseToCache = networkResponse.clone();
            caches.open(CACHE_NAME).then((cache) => {
              cache.put(request, responseToCache);
            });
          }
          return networkResponse;
        });
      })
    );
    return;
  }

  // 頁面導航採用 Network-First (網路優先，離線回退至快取)
  event.respondWith(
    fetch(request)
      .then((networkResponse) => {
        if (networkResponse.status === 200) {
          const responseToCache = networkResponse.clone();
          caches.open(CACHE_NAME).then((cache) => {
            cache.put(request, responseToCache);
          });
        }
        return networkResponse;
      })
      .catch(async () => {
        const cachedResponse = await caches.match(request);
        if (cachedResponse) return cachedResponse;
        // 若完全斷網且未快取該路徑，回退至首頁 App Shell
        const fallback = await caches.match("/");
        if (fallback) return fallback;
        return new Response("離線狀態", { status: 503, statusText: "Offline" });
      })
  );
});
