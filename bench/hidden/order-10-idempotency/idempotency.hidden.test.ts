import { describe, expect, it } from "vitest";
import { DEFAULT_CONFIG } from "../../src/config.js";
import { buildRouter } from "../../src/http/handlers.js";
import { MemoryInvoiceRepository } from "../../src/storage/jsonRepository.js";

const body = { customer: "Acme", currency: "EUR", lines: [{ description: "a", quantity: 1, unitPriceCents: 100 }] };

describe("hidden: Idempotency-Key on POST /invoices", () => {
  it("replays the same invoice for the same key and body", async () => {
    const repo = new MemoryInvoiceRepository([]);
    const router = buildRouter({ repo, config: DEFAULT_CONFIG } as any);
    const first = await router.handle({ method: "POST", url: "/invoices", headers: { "idempotency-key": "k-1" }, body });
    const second = await router.handle({ method: "POST", url: "/invoices", headers: { "idempotency-key": "k-1" }, body });
    expect(first.status).toBe(201);
    expect(second.status).toBe(200);
    expect(JSON.parse(second.body).id).toBe(JSON.parse(first.body).id);
    expect(repo.all()).toHaveLength(1);
  });

  it("rejects the same key with a different body", async () => {
    const repo = new MemoryInvoiceRepository([]);
    const router = buildRouter({ repo, config: DEFAULT_CONFIG } as any);
    await router.handle({ method: "POST", url: "/invoices", headers: { "idempotency-key": "k-2" }, body });
    const res = await router.handle({ method: "POST", url: "/invoices", headers: { "idempotency-key": "k-2" }, body: { ...body, customer: "Other" } });
    expect(res.status).toBe(409);
    expect(typeof JSON.parse(res.body).error.message).toBe("string");
    expect(repo.all()).toHaveLength(1);
  });

  it("creates twice without a key", async () => {
    const repo = new MemoryInvoiceRepository([]);
    const router = buildRouter({ repo, config: DEFAULT_CONFIG } as any);
    await router.handle({ method: "POST", url: "/invoices", headers: {}, body });
    await router.handle({ method: "POST", url: "/invoices", headers: {}, body });
    expect(repo.all()).toHaveLength(2);
  });
});
