import { describe, expect, it } from "bun:test";
import { readFileSync } from "node:fs";

const workerSource = readFileSync(new URL("../public/sw.js", import.meta.url), "utf8");

function worker(online: boolean) {
  const handlers = new Map<string, (event: unknown) => void>();
  const gallery = { page: "cached anonymous gallery" };
  const offline = { page: "offline fallback" };
  const puts: Array<{ key: string; response: unknown }> = [];
  const requests: Array<{ url: string; options: unknown }> = [];
  const cache = {
    addAll: async () => {},
    match: async () => undefined,
    put: async (key: string, response: unknown) => {
      puts.push({ key, response });
    },
    keys: async () => [],
  };
  const caches = {
    open: async () => cache,
    match: async (key: string) => (key === "/games/drawing" ? gallery : offline),
  };
  const fetch = async (url: string, options?: unknown) => {
    requests.push({ url, options });
    if (!online) throw new Error("offline");
    return { ok: true, type: "basic", headers: { get: () => "text/html" } };
  };
  const scope = {
    location: { origin: "https://kidzy.life" },
    addEventListener: (name: string, handler: (event: unknown) => void) => handlers.set(name, handler),
    clients: { claim: async () => {} },
  };
  new Function("self", "caches", "fetch", "Response", workerSource)(
    scope,
    caches,
    fetch,
    { error: () => ({ page: "network error" }) },
  );
  return { handlers, gallery, offline, puts, requests };
}

describe("Kidzy PWA offline drawing", () => {
  it("opens a cached gallery shell for safe drawing and collection links", async () => {
    const app = worker(false);
    const open = async (search: string) => {
      let pending: Promise<unknown> | undefined;
      app.handlers.get("fetch")!({
        request: {
          method: "GET",
          mode: "navigate",
          url: "https://kidzy.life/games/drawing" + search,
        },
        respondWith: (value: Promise<unknown>) => {
          pending = value;
        },
      });
      return pending;
    };
    expect(await open("?sheet=dinosaurs-01")).toBe(app.gallery);
    expect(await open("?group=princesses&mine=true")).toBe(app.gallery);
    expect(await open("?code=private")).toBe(app.offline);
  });

  it("refreshes only anonymous gallery HTML when online", async () => {
    const app = worker(true);
    let pending: Promise<unknown> | undefined;
    app.handlers.get("message")!({
      data: { type: "CACHE_PUBLIC_RESOURCES", assets: [], drawings: [] },
      waitUntil: (value: Promise<unknown>) => {
        pending = value;
      },
    });
    await pending;
    expect(app.requests.find((request) => request.url === "/games/drawing")?.options).toEqual({
      credentials: "omit",
      cache: "no-store",
    });
    expect(app.puts.some((item) => item.key === "/games/drawing")).toBe(true);
  });
});
