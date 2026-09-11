import { describe, expect, it } from "vitest";
import { readdirSync } from "node:fs";
import { DEFAULT_CONFIG } from "../../src/config.js";
import { buildRouter } from "../../src/http/handlers.js";
import { MemoryInvoiceRepository } from "../../src/storage/jsonRepository.js";

type Handle = (req: any) => Promise<any>;
type Guard = (handle: Handle, key: string) => Handle;

// The task fixes the module directory (src/auth/) but not the export name or signature, so the
// hidden test discovers the guard by behaviour: for every exported function and every common
// calling shape, build a guarded handler and keep the first one that really lets the right key in
// and keeps the wrong key out. Accepted shapes for the key argument: a string, `{ apiKey }`,
// `{ auth: { apiKey } }`; accepted wrapping shapes: (handle, key), ({ handle }, key), (key)(handle).
const KEY_SHAPES: Array<(k: string) => any> = [(k) => k, (k) => ({ apiKey: k }), (k) => ({ auth: { apiKey: k } })];

async function loadGuard(): Promise<Guard> {
  const files = readdirSync(new URL("../../src/auth/", import.meta.url)).filter((f) => f.endsWith(".ts"));
  const probeRouter = buildRouter({ repo: new MemoryInvoiceRepository([]), config: DEFAULT_CONFIG });
  const probe: Handle = (r) => probeRouter.handle(r);
  const candidates: Guard[] = [];
  for (const f of files) {
    const mod: any = await import(`../../src/auth/${f.replace(/\.ts$/, ".js")}`);
    for (const value of Object.values(mod)) {
      if (typeof value !== "function") continue;
      const fn: any = value;
      for (const shape of KEY_SHAPES) {
        candidates.push((h, k) => fn(h, shape(k)));
        candidates.push((h, k) => (req) => fn({ handle: h }, shape(k)).handle(req));
        candidates.push((h, k) => fn(shape(k))(h));
      }
    }
  }
  for (const c of candidates) {
    try {
      const guarded = c(probe, "secret");
      if (typeof guarded !== "function") continue;
      const right = await guarded({ method: "GET", url: "/invoices", headers: { "x-api-key": "secret" } });
      const wrong = await guarded({ method: "GET", url: "/invoices", headers: { "x-api-key": "nope" } });
      if (right?.status === 200 && wrong?.status === 401) return c;
    } catch {}
  }
  throw new Error("no auth guard found under src/auth/ that admits the right key and rejects a wrong one");
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
