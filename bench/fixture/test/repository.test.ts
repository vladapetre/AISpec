import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { JsonInvoiceRepository, MemoryInvoiceRepository } from "../src/storage/jsonRepository.js";
import { Invoice } from "../src/domain/invoice.js";

const inv = (id: string, createdAt: string): Invoice => ({
  id,
  customer: "c",
  currency: "EUR",
  createdAt,
  lines: [{ description: "x", quantity: 1, unitPriceCents: 100 }],
});

describe("JsonInvoiceRepository", () => {
  let dir: string;
  afterEach(() => {
    if (dir) rmSync(dir, { recursive: true, force: true });
  });

  it("round-trips invoices and sorts newest first", () => {
    dir = mkdtempSync(join(tmpdir(), "ledgerlite-"));
    const repo = new JsonInvoiceRepository(join(dir, "invoices.json"));
    repo.save(inv("INV-1001", "2026-01-01T00:00:00.000Z"));
    repo.save(inv("INV-1002", "2026-02-01T00:00:00.000Z"));
    expect(repo.all().map((i) => i.id)).toEqual(["INV-1002", "INV-1001"]);
    expect(repo.byId("INV-1001")?.customer).toBe("c");
    expect(repo.nextId()).toBe("INV-1003");
  });

  it("starts numbering at 1001 on an empty store", () => {
    dir = mkdtempSync(join(tmpdir(), "ledgerlite-"));
    const repo = new JsonInvoiceRepository(join(dir, "invoices.json"));
    expect(repo.nextId()).toBe("INV-1001");
  });
});

describe("MemoryInvoiceRepository", () => {
  it("behaves like the file store", () => {
    const repo = new MemoryInvoiceRepository([inv("INV-1001", "2026-01-01T00:00:00.000Z")]);
    expect(repo.nextId()).toBe("INV-1002");
    repo.save(inv("INV-1002", "2026-02-01T00:00:00.000Z"));
    expect(repo.all()[0].id).toBe("INV-1002");
  });
});
