import { useEffect } from "react";

const SERVICE_WORKER_URL = "/sw.js";
const PROJECT_ID = "e17aa424-1014-461b-89c2-c3373e699dd9";

export interface ServiceWorkerContext {
  /** True only in real production builds. */
  prod: boolean;
  /** Lowercased current hostname. */
  hostname: string;
  /** Current full URL. */
  href: string;
  /** True when the page is embedded in an iframe. */
  inIframe: boolean;
}

function isPreviewHostname(hostname: string) {
  const firstLabel = hostname.split(".")[0] ?? "";
  const previewHost =
    hostname.endsWith(".lovable.app") ||
    hostname.endsWith(".gpt-eng.com") ||
    hostname.endsWith(".gptengineer.run");
  if (previewHost && /^(?:id-preview|preview)(?:-[a-z0-9]+)?--.+$/.test(firstLabel)) return true;
  if (hostname === `project--${PROJECT_ID}-dev.lovable.app`) return true;
  if (hostname === `project--${PROJECT_ID}-dev.gpt-eng.com`) return true;
  if (hostname === `project--${PROJECT_ID}-dev.gptengineer.run`) return true;
  return false;
}

/** True when this browser context must not run the app service worker. */
export function shouldRefuseServiceWorker({
  prod,
  hostname,
  href,
  inIframe,
}: ServiceWorkerContext): boolean {
  if (!prod) return true;
  if (inIframe) return true;
  if (hostname === "lovableproject.com" || hostname.endsWith(".lovableproject.com")) return true;
  if (hostname === "lovableproject-dev.com" || hostname.endsWith(".lovableproject-dev.com"))
    return true;
  if (hostname === "beta.lovable.dev" || hostname.endsWith(".beta.lovable.dev")) return true;
  if (isPreviewHostname(hostname)) return true;
  try {
    if (new URL(href).searchParams.get("sw") === "off") return true;
  } catch {
    // An unparseable URL is not a kill switch.
  }
  return false;
}

async function unregisterAppServiceWorker() {
  if (!("serviceWorker" in navigator)) return;
  const registrations = await navigator.serviceWorker.getRegistrations();
  await Promise.allSettled(
    registrations
      .filter((registration) => {
        const script =
          registration.active?.scriptURL ??
          registration.installing?.scriptURL ??
          registration.waiting?.scriptURL;
        if (!script) return false;
        try {
          return new URL(script, location.origin).pathname === SERVICE_WORKER_URL;
        } catch {
          return false;
        }
      })
      .map((registration) => registration.unregister()),
  );
}

/** Registers the app service worker only in real deployments, and warms already loaded assets. */
export function PwaRegistration() {
  useEffect(() => {
    if (!("serviceWorker" in navigator) || !window.isSecureContext) return;
    const hostname = window.location.hostname.toLowerCase();
    let cancelled = false;

    if (
      shouldRefuseServiceWorker({
        prod: import.meta.env.PROD,
        hostname,
        href: window.location.href,
        inIframe: window.self !== window.top,
      })
    ) {
      void unregisterAppServiceWorker();
      return;
    }

    const register = () => {
      void navigator.serviceWorker
        .register(SERVICE_WORKER_URL, { scope: "/", updateViaCache: "none" })
        .then(() => navigator.serviceWorker.ready)
        .then((registration) => {
          if (cancelled) return;
          const resources = performance.getEntriesByType("resource").map((entry) => entry.name);
          const publicPaths = (prefix: string) =>
            resources.filter((name) => {
              try {
                const url = new URL(name);
                return url.origin === location.origin && url.pathname.startsWith(prefix);
              } catch {
                return false;
              }
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
