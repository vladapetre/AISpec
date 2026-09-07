import { describe, expect, it } from "vitest";
import { DEFAULT_CONFIG } from "../../src/config.js";
import { buildRouter } from "../../src/http/handlers.js";
import { MemoryInvoiceRepository } from "../../src/storage/jsonRepository.js";

const post = (body: unknown) => {
  const repo = new MemoryInvoiceRepository([]);
  const router = buildRouter({ repo, config: DEFAULT_CONFIG });
  return router.handle({ method: "POST", url: "/invoices", headers: {}, body }).then((res) => ({ res, repo }));
};

const good = { customer: "Acme", currency: "EUR", lines: [{ description: "a", quantity: 1, unitPriceCents: 100 }] };

describe("hidden: POST /invoices validation", () => {
  it("accepts a valid body", async () => {
    const { res } = await post(good);
    expect(res.status).toBe(201);
  });

  it("rejects a missing customer and names the field", async () => {
    const { res, repo } = await post({ ...good, customer: "" });
    expect(res.status).toBe(400);
    const body = JSON.parse(res.body);
    expect(body.error.field).toBe("customer");
    expect(typeof body.error.message).toBe("string");
    expect(repo.all()).toHaveLength(0);
  });

  it("rejects a bad currency", async () => {
    const { res } = await post({ ...good, currency: "eur" });
    expect(res.status).toBe(400);
    expect(JSON.parse(res.body).error.field).toBe("currency");
  });

  it("rejects an empty line list", async () => {
    const { res } = await post({ ...good, lines: [] });
    expect(res.status).toBe(400);
    expect(JSON.parse(res.body).error.field).toBe("lines");
  });

  it("rejects a negative quantity with an indexed field", async () => {
    const { res } = await post({ ...good, lines: [{ description: "a", quantity: -1, unitPriceCents: 100 }] });
    expect(res.status).toBe(400);
    expect(JSON.parse(res.body).error.field).toBe("lines[0].quantity");
  });

  it("rejects a non-integer price", async () => {
    const { res } = await post({ ...good, lines: [{ description: "a", quantity: 1, unitPriceCents: 1.5 }] });
    expect(res.status).toBe(400);
    expect(JSON.parse(res.body).error.field).toBe("lines[0].unitPriceCents");
  });
});
