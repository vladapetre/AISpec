import { describe, expect, it } from "vitest";
import { DEFAULT_CONFIG } from "../src/config.js";
import { Invoice } from "../src/domain/invoice.js";
import { buildRouter } from "../src/http/handlers.js";
import { MemoryInvoiceRepository } from "../src/storage/jsonRepository.js";

const seed: Invoice[] = Array.from({ length: 5 }, (_, i) => ({
  id: `INV-${1001 + i}`,
  customer: `Customer ${i}`,
  currency: "EUR",
  createdAt: `2026-08-0${i + 1}T00:00:00.000Z`,
  lines: [{ description: "x", quantity: 1, unitPriceCents: 1000 }],
}));

function app() {
  const repo = new MemoryInvoiceRepository(seed);
  const router = buildRouter({ repo, config: DEFAULT_CONFIG, now: () => new Date("2026-09-01T00:00:00.000Z") });
  return { repo, router };
}

describe("HTTP routes", () => {
  it("answers health", async () => {
    const { router } = app();
    const res = await router.handle({ method: "GET", url: "/health", headers: {} });
    expect(res.status).toBe(200);
    expect(JSON.parse(res.body)).toEqual({ ok: true });
  });

  it("limits the page size", async () => {
    const { router } = app();
    const res = await router.handle({ method: "GET", url: "/invoices?page=0&size=2", headers: {} });
    const body = JSON.parse(res.body);
    expect(body.items).toHaveLength(2);
    expect(body.total).toBe(5);
  });

  it("returns one invoice with totals", async () => {
    const { router } = app();
    const res = await router.handle({ method: "GET", url: "/invoices/INV-1003", headers: {} });
    expect(res.status).toBe(200);
    expect(JSON.parse(res.body).totals.totalCents).toBe(1070);
  });

  it("404s an unknown invoice", async () => {
    const { router } = app();
    const res = await router.handle({ method: "GET", url: "/invoices/INV-9999", headers: {} });
    expect(res.status).toBe(404);
  });

  it("creates an invoice", async () => {
    const { router, repo } = app();
    const res = await router.handle({
      method: "POST",
      url: "/invoices",
      headers: {},
      body: { customer: "New", currency: "EUR", lines: [{ description: "a", quantity: 2, unitPriceCents: 500 }] },
    });
    expect(res.status).toBe(201);
    const body = JSON.parse(res.body);
    expect(body.id).toBe("INV-1006");
    expect(repo.byId(body.id)).toBeDefined();
  });
});
