import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { DEFAULT_CONFIG } from "../../src/config.js";
import { buildRouter } from "../../src/http/handlers.js";
import { JsonInvoiceRepository, MemoryInvoiceRepository } from "../../src/storage/jsonRepository.js";

const body = { customer: "Acme", currency: "EUR", lines: [{ description: "a", quantity: 1, unitPriceCents: 100 }] };

describe("hidden: invoice status lifecycle", () => {
  it("creates as draft, issues, pays, and refuses bad transitions", async () => {
    const repo = new MemoryInvoiceRepository([]);
    const router = buildRouter({ repo, config: DEFAULT_CONFIG });
    const created = JSON.parse((await router.handle({ method: "POST", url: "/invoices", headers: {}, body })).body);
    expect(created.status).toBe("draft");

    const payDraft = await router.handle({ method: "POST", url: `/invoices/${created.id}/pay`, headers: {} });
    expect(payDraft.status).toBe(409);

    const issued = await router.handle({ method: "POST", url: `/invoices/${created.id}/issue`, headers: {} });
    expect(issued.status).toBe(200);
    expect(JSON.parse(issued.body).status).toBe("issued");

    const reissue = await router.handle({ method: "POST", url: `/invoices/${created.id}/issue`, headers: {} });
    expect(reissue.status).toBe(409);

    const paid = await router.handle({ method: "POST", url: `/invoices/${created.id}/pay`, headers: {} });
    expect(paid.status).toBe(200);
    expect(JSON.parse(paid.body).status).toBe("paid");
    expect((repo.byId(created.id) as any).status).toBe("paid");
  });
});

describe("hidden: unmigrated records read as issued", () => {
  let dir: string;
  afterEach(() => {
    if (dir) rmSync(dir, { recursive: true, force: true });
  });

  it("defaults a missing status to issued", () => {
    dir = mkdtempSync(join(tmpdir(), "mig-"));
    const file = join(dir, "invoices.json");
    writeFileSync(
      file,
      JSON.stringify({ invoices: [{ id: "INV-1001", customer: "c", currency: "EUR", createdAt: "2026-01-01T00:00:00.000Z", lines: [] }] }),
    );
    const repo = new JsonInvoiceRepository(file);
    expect((repo.byId("INV-1001") as any).status).toBe("issued");
    expect((repo.all()[0] as any).status).toBe("issued");
  });
});

describe("hidden: the shipped data file was migrated", () => {
  it("every record in data/invoices.json carries a status", () => {
    const shape = JSON.parse(readFileSync("data/invoices.json", "utf8"));
    expect(shape.invoices.length).toBeGreaterThan(0);
    for (const inv of shape.invoices) expect(["draft", "issued", "paid"]).toContain(inv.status);
  });
});
