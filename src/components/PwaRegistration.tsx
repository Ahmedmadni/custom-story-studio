import { useEffect } from "react";

/** Registers the public app shell and warms already loaded, versioned assets. */
export function PwaRegistration() {
  useEffect(() => {
    if (!("serviceWorker" in navigator) || !window.isSecureContext) return;
    let cancelled = false;
    const register = () => {
      void navigator.serviceWorker
        .register("/sw.js", { scope: "/", updateViaCache: "none" })
        .then(() => navigator.serviceWorker.ready)
        .then((registration) => {
          if (cancelled) return;
          const resources = performance.getEntriesByType("resource").map((entry) => entry.name);
          const publicPaths = (prefix: string) =>
            resources.filter((name) => {
              const url = new URL(name);
              return url.origin === location.origin && url.pathname.startsWith(prefix);
            });
          registration.active?.postMessage({
            type: "CACHE_PUBLIC_RESOURCES",
            assets: publicPaths("/assets/"),
            drawings: publicPaths("/drawing/").filter((url) => url.endsWith(".webp")),
          });
        })
        .catch(() => {
          // The site stays usable if this browser blocks service workers.
        });
    };

    if (document.readyState === "complete") register();
    else window.addEventListener("load", register, { once: true });
    return () => {
      cancelled = true;
      window.removeEventListener("load", register);
    };
  }, []);

  return null;
}
