import { describe, expect, it } from "vitest";
import { DEFAULT_CONFIG } from "../../src/config.js";
import { buildRouter } from "../../src/http/handlers.js";
import { MemoryInvoiceRepository } from "../../src/storage/jsonRepository.js";

const seed = [
  { id: "INV-1001", customer: "Acme, Inc.", currency: "EUR", createdAt: "2026-08-01T00:00:00.000Z", lines: [{ description: "a", quantity: 1, unitPriceCents: 10000 }] },
  { id: "INV-1002", customer: 'Bob "The Builder"', currency: "GBP", createdAt: "2026-08-02T00:00:00.000Z", lines: [{ description: "a", quantity: 2, unitPriceCents: 500 }] },
];

describe("hidden: GET /invoices.csv", () => {
  it("returns RFC 4180 CSV, newest first, totals with tax", async () => {
    const router = buildRouter({ repo: new MemoryInvoiceRepository(seed as any), config: DEFAULT_CONFIG });
    const res = await router.handle({ method: "GET", url: "/invoices.csv", headers: {} });
    expect(res.status).toBe(200);
    expect(res.headers["content-type"]).toMatch(/^text\/csv/);
    const lines = res.body.trim().split(/\r?\n/);
    expect(lines[0]).toBe("id,customer,currency,totalCents,createdAt");
    expect(lines[1]).toBe('INV-1002,"Bob ""The Builder""",GBP,1070,2026-08-02T00:00:00.000Z');
    expect(lines[2]).toBe('INV-1001,"Acme, Inc.",EUR,10700,2026-08-01T00:00:00.000Z');
    expect(lines).toHaveLength(3);
  });

  it("returns just the header on an empty store", async () => {
    const router = buildRouter({ repo: new MemoryInvoiceRepository([]), config: DEFAULT_CONFIG });
    const res = await router.handle({ method: "GET", url: "/invoices.csv", headers: {} });
    expect(res.body.trim()).toBe("id,customer,currency,totalCents,createdAt");
  });
});
