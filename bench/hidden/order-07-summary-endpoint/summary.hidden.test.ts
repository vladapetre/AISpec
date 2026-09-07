import { describe, expect, it } from "vitest";
import { DEFAULT_CONFIG } from "../../src/config.js";
import { buildRouter } from "../../src/http/handlers.js";
import { MemoryInvoiceRepository } from "../../src/storage/jsonRepository.js";

const seed = [
  {
    id: "INV-1001",
    customer: "Acme",
    currency: "EUR",
    createdAt: "2026-08-01T00:00:00.000Z",
    lines: [
      { description: "a", quantity: 2, unitPriceCents: 5000 },
      { description: "b", quantity: 1, unitPriceCents: 0 },
    ],
  },
];

describe("hidden: GET /invoices/:id/summary", () => {
  it("returns the summary shape", async () => {
    const router = buildRouter({ repo: new MemoryInvoiceRepository(seed as any), config: DEFAULT_CONFIG });
    const res = await router.handle({ method: "GET", url: "/invoices/INV-1001/summary", headers: {} });
    expect(res.status).toBe(200);
    const body = JSON.parse(res.body);
    expect(body).toMatchObject({ id: "INV-1001", customer: "Acme", currency: "EUR", lineCount: 2, totalCents: 10700, total: "107.00 EUR" });
  });

  it("404s like the detail route", async () => {
    const router = buildRouter({ repo: new MemoryInvoiceRepository([]), config: DEFAULT_CONFIG });
    const res = await router.handle({ method: "GET", url: "/invoices/INV-4/summary", headers: {} });
    expect(res.status).toBe(404);
    expect(JSON.parse(res.body).error.message).toMatch(/not found/);
  });
});
