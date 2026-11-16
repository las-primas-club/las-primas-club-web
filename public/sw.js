// Service worker de Las Primas Club.
// - La API (/api) nunca se cachea: los datos siempre son los del servidor.
// - Las páginas van "red primero" (si no hay conexión, se muestra la última versión guardada).
// - Los ficheros con hash de /assets/ e iconos van "caché primero" (nunca cambian).
const CACHE = "lpc-v2";
const SHELL = ["/", "/logo.svg", "/manifest.webmanifest", "/icons/icon-192.png"];

self.addEventListener("install", (event) => {
  event.waitUntil(caches.open(CACHE).then((c) => c.addAll(SHELL)));
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)))),
  );
  self.clients.claim();
});

self.addEventListener("fetch", (event) => {
  const req = event.request;
  const url = new URL(req.url);
  if (req.method !== "GET" || url.origin !== self.location.origin || url.pathname.startsWith("/api/")) return;

  if (req.mode === "navigate") {
    event.respondWith(
      fetch(req)
        .then((res) => {
          const copy = res.clone();
          caches.open(CACHE).then((c) => c.put("/", copy));
          return res;
        })
        .catch(() => caches.match("/")),
    );
    return;
  }

  if (url.pathname.startsWith("/assets/") || url.pathname.startsWith("/icons/") || url.pathname === "/logo.svg") {
    event.respondWith(
      caches.match(req).then(
        (hit) =>
          hit ||
          fetch(req).then((res) => {
            if (res.ok) {
              const copy = res.clone();
              caches.open(CACHE).then((c) => c.put(req, copy));
            }
            return res;
          }),
      ),
    );
  }
});

// ---------- Avisos push ----------
// El push llega sin contenido: pedimos el último aviso a la API y lo mostramos.
self.addEventListener("push", (event) => {
  event.waitUntil(
    fetch("/api/push/latest", { credentials: "same-origin" })
      .then((res) => (res.ok ? res.json() : null))
      .catch(() => null)
      .then((note) =>
        self.registration.showNotification(note?.title ?? "Las Primas Club", {
          body: note?.body ?? "Hay novedades en el club.",
          icon: "/icons/icon-192.png",
          badge: "/icons/icon-192.png",
          data: { url: note?.url ?? "/" },
        }),
      ),
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  // Solo rutas de la propia web.
  const path = typeof event.notification.data?.url === "string" && event.notification.data.url.startsWith("/") ? event.notification.data.url : "/";
  event.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((windows) => {
      const open = windows.find((w) => "focus" in w);
      if (open) return open.navigate(path).then((w) => (w ?? open).focus()).catch(() => self.clients.openWindow(path));
      return self.clients.openWindow(path);
    }),
  );
});
