import { describe, expect, it } from "vitest";
import { readdirSync } from "node:fs";
import { DEFAULT_CONFIG } from "../../src/config.js";
import { buildRouter } from "../../src/http/handlers.js";
import { MemoryInvoiceRepository } from "../../src/storage/jsonRepository.js";

// The task fixes the module directory (src/auth/) but not the export name, so the hidden test
// discovers the guard by shape: an exported function that takes (router-like handle, key) or a
// wrapper that takes a handler and returns a handler. Both common designs are accepted.
async function loadGuard(): Promise<(handle: (req: any) => Promise<any>, key: string) => (req: any) => Promise<any>> {
  const files = readdirSync(new URL("../../src/auth/", import.meta.url)).filter((f) => f.endsWith(".ts"));
  for (const f of files) {
    const mod: any = await import(`../../src/auth/${f.replace(/\.ts$/, ".js")}`);
    for (const value of Object.values(mod)) {
      if (typeof value !== "function") continue;
      const fn: any = value;
      // try (handle, key) => handle
      try {
        const wrapped = fn(async () => ({ status: 200, headers: {}, body: "" }), "secret");
        if (typeof wrapped === "function") return (h, k) => fn(h, k);
      } catch {}
      // try ({ handle }, key) => { handle }
      try {
        const wrapped = fn({ handle: async () => ({ status: 200, headers: {}, body: "" }) }, "secret");
        if (wrapped && typeof wrapped.handle === "function") return (h, k) => (req) => fn({ handle: h }, k).handle(req);
      } catch {}
      // try (key) => (handle) => handle
      try {
        const mw = fn("secret");
        if (typeof mw === "function") {
          const wrapped = mw(async () => ({ status: 200, headers: {}, body: "" }));
          if (typeof wrapped === "function") return (h, k) => fn(k)(h);
        }
      } catch {}
    }
  }
  throw new Error("no auth guard found under src/auth/ with a recognised shape");
}

describe("hidden: API key guard", () => {
  const router = buildRouter({ repo: new MemoryInvoiceRepository([]), config: DEFAULT_CONFIG });

  it("lets /health through without a key", async () => {
    const guard = await loadGuard();
    const res = await guard((r) => router.handle(r), "secret")({ method: "GET", url: "/health", headers: {} });
    expect(res.status).toBe(200);
  });

  it("rejects a missing key with 401", async () => {
    const guard = await loadGuard();
    const res = await guard((r) => router.handle(r), "secret")({ method: "GET", url: "/invoices", headers: {} });
    expect(res.status).toBe(401);
    expect(JSON.parse(res.body).error.message).toBe("unauthorized");
  });

  it("rejects a wrong key", async () => {
    const guard = await loadGuard();
    const res = await guard((r) => router.handle(r), "secret")({ method: "GET", url: "/invoices", headers: { "x-api-key": "nope" } });
    expect(res.status).toBe(401);
  });

  it("accepts the right key", async () => {
    const guard = await loadGuard();
    const res = await guard((r) => router.handle(r), "secret")({ method: "GET", url: "/invoices", headers: { "x-api-key": "secret" } });
    expect(res.status).toBe(200);
  });
});
