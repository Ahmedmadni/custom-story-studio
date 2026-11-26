import { describe, expect, it } from "bun:test";
import { readFileSync } from "node:fs";
import { runInNewContext } from "node:vm";

const root = new URL("../public/", import.meta.url);
interface FakeResponse {
  ok: boolean;
  type: string;
  body: string;
  headers: { get(name: string): string | null };
  clone(): FakeResponse;
}

describe("Kidzy PWA", () => {
  it("provides an installable Arabic manifest with real PNG icons", () => {
    const manifest = JSON.parse(readFileSync(new URL("manifest.webmanifest", root), "utf8"));
    expect(manifest.start_url).toBe("/");
    expect(manifest.shortcuts[0].url).toBe("/games/drawing");
    expect(manifest.display).toBe("standalone");
    expect(manifest.lang).toBe("ar");
    for (const size of [192, 512]) {
      const icon = manifest.icons.find(
        (entry: { sizes: string }) => entry.sizes === `${size}x${size}`,
      );
      expect(icon).toBeDefined();
      const bytes = readFileSync(new URL(`.${icon.src}`, root));
      expect(bytes.subarray(1, 4).toString()).toBe("PNG");
      expect(bytes.readUInt32BE(16)).toBe(size);
      expect(bytes.readUInt32BE(20)).toBe(size);
    }
  });

  it("serves a public drawing shell offline and never caches private pages", async () => {
    const origin = "https://kidzy.life";
    const listeners = new Map<string, (event: Record<string, unknown>) => void>();
    const stored = new Map<string, Map<string, FakeResponse>>();
    const key = (value: string | { url: string }) =>
      new URL(typeof value === "string" ? value : value.url, origin).href;
    let online = true;
    const requests: Array<{ url: string; credentials?: string }> = [];
    const response = (body: string, type = "basic"): FakeResponse => ({
      ok: true,
      type,
      body,
      headers: {
        get: (name: string) =>
          name === "content-type"
            ? body.endsWith(".webp")
              ? "image/webp"
              : body.includes("/assets/")
                ? "text/javascript"
                : "text/html"
            : null,
      },
      clone() {
        return this;
      },
    });
    const fetch = async (request: string | { url: string }, options?: { credentials?: string }) => {
      if (!online) throw new Error("offline");
      requests.push({ url: key(request), credentials: options?.credentials });
      return response(key(request));
    };
    const caches = {
      async open(name: string) {
        if (!stored.has(name)) stored.set(name, new Map());
        const entries = stored.get(name)!;
        return {
          addAll: async (paths: string[]) => {
            for (const path of paths) entries.set(key(path), await fetch(path));
          },
          match: async (request: string | { url: string }) => entries.get(key(request)),
          put: async (request: string | { url: string }, value: FakeResponse) => {
            entries.set(key(request), value);
          },
          keys: async () => [...entries.keys()],
          delete: async (request: string | { url: string }) => entries.delete(key(request)),
        };
      },
      async match(request: string) {
        for (const entries of stored.values()) {
          if (entries.has(key(request))) return entries.get(key(request));
        }
      },
      keys: async () => [...stored.keys()],
      delete: async (name: string) => stored.delete(name),
    };
    runInNewContext(readFileSync(new URL("sw.js", root), "utf8"), {
      self: {
        location: { origin },
        clients: { claim: async () => {} },
        addEventListener: (name: string, handler: (event: Record<string, unknown>) => void) =>
          listeners.set(name, handler),
      },
      caches,
      fetch,
      URL,
      Response,
    });
    const wait = (name: string, data?: object) => {
      let pending: Promise<unknown> = Promise.resolve();
      listeners.get(name)!({
        ...data,
        waitUntil: (promise: Promise<unknown>) => {
          pending = promise;
        },
      });
      return pending;
    };
    await wait("install");
    expect(requests.find((r) => r.url === `${origin}/games/drawing`)?.credentials).toBe("omit");
    await wait("activate");
    const drawing = async () => {
      let pending: Promise<FakeResponse> = Promise.resolve(response(""));
      listeners.get("fetch")!({
        request: { method: "GET", mode: "no-cors", url: `${origin}/drawing/cat.webp` },
        respondWith: (promise: Promise<FakeResponse>) => {
          pending = promise;
        },
      });
      return pending;
    };
    expect((await drawing()).body).toBe(`${origin}/drawing/cat.webp`);
    online = false;
    expect((await drawing()).body).toBe(`${origin}/drawing/cat.webp`);
    const navigate = async (path: string) => {
      let pending: Promise<FakeResponse> = Promise.resolve(response(""));
      listeners.get("fetch")!({
        request: { method: "GET", mode: "navigate", url: origin + path },
        respondWith: (promise: Promise<FakeResponse>) => {
          pending = promise;
        },
      });
      return pending;
    };
    expect((await navigate("/games/drawing")).body).toBe(`${origin}/games/drawing`);
    expect((await navigate("/my-orders")).body).toBe(`${origin}/offline.html`);
    expect([...stored.values()].every((cache) => !cache.has(`${origin}/my-orders`))).toBe(true);
    const oauth = (await navigate("/~oauth/callback")) as unknown as Response;
    expect(oauth.type).toBe("error");
  });
});

describe("Kidzy PWA registration guard", () => {
  const base = {
    prod: true,
    hostname: "kidzy.life",
    href: "https://kidzy.life/",
    inIframe: false,
  };

  it("registers on the published domain and refuses in every preview context", async () => {
    const { shouldRefuseServiceWorker } = await import("../src/components/PwaRegistration");
    expect(shouldRefuseServiceWorker(base)).toBe(false);
    expect(shouldRefuseServiceWorker({ ...base, prod: false })).toBe(true);
    expect(shouldRefuseServiceWorker({ ...base, inIframe: true })).toBe(true);
    expect(
      shouldRefuseServiceWorker({
        ...base,
        hostname: "id-preview--e17aa424-1014-461b-89c2-c3373e699dd9.lovable.app",
        href: "https://id-preview--e17aa424-1014-461b-89c2-c3373e699dd9.lovable.app/",
      }),
    ).toBe(true);
    expect(
      shouldRefuseServiceWorker({
        ...base,
        hostname: "project--e17aa424-1014-461b-89c2-c3373e699dd9-dev.lovable.app",
        href: "https://project--e17aa424-1014-461b-89c2-c3373e699dd9-dev.lovable.app/",
      }),
    ).toBe(true);
    expect(
      shouldRefuseServiceWorker({
        ...base,
        hostname: "lovableproject.com",
        href: "https://lovableproject.com/",
      }),
    ).toBe(true);
    expect(shouldRefuseServiceWorker({ ...base, href: "https://kidzy.life/?sw=off" })).toBe(true);
    expect(
      shouldRefuseServiceWorker({
        ...base,
        hostname: "preview-v2--shop.example.com",
        href: "https://preview-v2--shop.example.com/",
      }),
    ).toBe(false);
  });
});
