import { describe, expect, it } from "vitest";
import { DEFAULT_CONFIG } from "../../src/config.js";
import { Invoice } from "../../src/domain/invoice.js";
import { buildRouter } from "../../src/http/handlers.js";
import { MemoryInvoiceRepository } from "../../src/storage/jsonRepository.js";

const seed: Invoice[] = Array.from({ length: 5 }, (_, i) => ({
  id: `INV-${1001 + i}`,
  customer: `Customer ${i}`,
  currency: "EUR",
  createdAt: `2026-08-0${i + 1}T00:00:00.000Z`,
  lines: [{ description: "x", quantity: 1, unitPriceCents: 1000 }],
}));

const router = () => buildRouter({ repo: new MemoryInvoiceRepository(seed), config: DEFAULT_CONFIG });

describe("hidden: pagination starts at page 1", () => {
  it("page 1 returns the two newest", async () => {
    const res = await router().handle({ method: "GET", url: "/invoices?page=1&size=2", headers: {} });
    const body = JSON.parse(res.body);
    expect(body.items.map((i: Invoice) => i.id)).toEqual(["INV-1005", "INV-1004"]);
  });

  it("page 2 returns the next two", async () => {
    const res = await router().handle({ method: "GET", url: "/invoices?page=2&size=2", headers: {} });
    const body = JSON.parse(res.body);
    expect(body.items.map((i: Invoice) => i.id)).toEqual(["INV-1003", "INV-1002"]);
  });

  it("page 3 returns the last one", async () => {
    const res = await router().handle({ method: "GET", url: "/invoices?page=3&size=2", headers: {} });
    const body = JSON.parse(res.body);
    expect(body.items.map((i: Invoice) => i.id)).toEqual(["INV-1001"]);
  });
});
