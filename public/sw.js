/* Kidzy PWA: cache only public drawing artwork and versioned app assets. */
const VERSION = "kidzy-pwa-v2";
const CORE = `${VERSION}-core`;
const ASSETS = `${VERSION}-assets`;
const DRAWINGS = `${VERSION}-drawings`;
const PUBLIC_SHELL = "/games/drawing";

// Keep only anonymous gallery HTML for offline navigation, including sheet links.
async function refreshPublicShell() {
  try {
    const response = await fetch(PUBLIC_SHELL, { credentials: "omit", cache: "no-store" });
    if (response.ok && response.headers.get("content-type")?.includes("text/html")) {
      const cache = await caches.open(CORE);
      await cache.put(PUBLIC_SHELL, response);
    }
  } catch {
    // A cached copy remains usable while offline.
  }
}

self.addEventListener("install", (event) => {
  event.waitUntil(
    (async () => {
      const cache = await caches.open(CORE);
      await cache.addAll([
        "/offline.html",
        "/manifest.webmanifest",
        "/icons/kidzy-192.png",
        "/icons/kidzy-512.png",
      ]);
      await refreshPublicShell();
    })(),
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    (async () => {
      const names = await caches.keys();
      await Promise.all(
        names
          .filter((name) => name.startsWith("kidzy-pwa-") && !name.startsWith(VERSION))
          .map((name) => caches.delete(name)),
      );
      await self.clients.claim();
    })(),
  );
});

async function trim(cache, limit) {
  const keys = await cache.keys();
  await Promise.all(
    keys.slice(0, Math.max(0, keys.length - limit)).map((key) => cache.delete(key)),
  );
}

async function cachePublic(request, name, limit) {
  const cache = await caches.open(name);
  const stored = await cache.match(request);
  if (stored) return stored;
  const response = await fetch(request);
  const contentType = response.headers.get("content-type") || "";
  const safeType =
    name === DRAWINGS
      ? contentType.startsWith("image/")
      : Boolean(contentType && !contentType.includes("text/html"));
  if (response.ok && response.type === "basic" && safeType) {
    await cache.put(request, response.clone());
    await trim(cache, limit);
  }
  return response;
}

self.addEventListener("fetch", (event) => {
  const { request } = event;
  if (request.method !== "GET") return;
  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;

  if (request.mode === "navigate") {
    event.respondWith(
      (async () => {
        try {
          return await fetch(request);
        } catch {
          // OAuth handoffs must never be answered from a cached shell.
          if (url.pathname.startsWith("/~oauth")) return Response.error();
          const safeDrawingLink =
            url.pathname === PUBLIC_SHELL &&
            [...url.searchParams.keys()].every((key) => ["group", "sheet", "mine"].includes(key));
          if (safeDrawingLink) {
            const gallery = await caches.match(PUBLIC_SHELL);
            if (gallery) return gallery;
          }
          return (await caches.match("/offline.html")) || Response.error();
        }
      })(),
    );
    return;
  }

  if (url.pathname.startsWith("/drawing/") && url.pathname.endsWith(".webp")) {
    event.respondWith(cachePublic(request, DRAWINGS, 80));
  } else if (url.pathname.startsWith("/assets/")) {
    event.respondWith(cachePublic(request, ASSETS, 120));
  }
});

self.addEventListener("message", (event) => {
  if (event.data?.type !== "CACHE_PUBLIC_RESOURCES") return;
  event.waitUntil(
    (async () => {
      const warm = async (values, prefix, name, limit) => {
        if (!Array.isArray(values)) return;
        const cache = await caches.open(name);
        const urls = values.slice(0, limit).filter((value) => {
          if (typeof value !== "string") return false;
          try {
            const url = new URL(value, self.location.origin);
            return (
              url.origin === self.location.origin &&
              url.pathname.startsWith(prefix) &&
              (prefix !== "/drawing/" || url.pathname.endsWith(".webp"))
            );
          } catch {
            return false;
          }
        });
        await Promise.allSettled(
          urls.map(async (value) => {
            if (await cache.match(value)) return;
            const response = await fetch(value, { credentials: "omit" });
            const contentType = response.headers.get("content-type") || "";
            const safeType =
              name === DRAWINGS
                ? contentType.startsWith("image/")
                : Boolean(contentType && !contentType.includes("text/html"));
            if (response.ok && response.type === "basic" && safeType) {
              await cache.put(value, response);
            }
          }),
        );
        await trim(cache, limit);
      };
      await Promise.all([
        refreshPublicShell(),
        warm(event.data.assets, "/assets/", ASSETS, 120),
        warm(event.data.drawings, "/drawing/", DRAWINGS, 80),
      ]);
    })(),
  );
});
