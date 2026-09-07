import { describe, expect, it } from "vitest";
import { computeTotals, createInvoice } from "../src/domain/invoice.js";

describe("invoice", () => {
  const now = new Date("2026-09-01T10:00:00.000Z");

  it("creates an invoice with a copied line list", () => {
    const input = { customer: "Acme", currency: "EUR", lines: [{ description: "a", quantity: 1, unitPriceCents: 100 }] };
    const inv = createInvoice(input, "INV-1", now);
    input.lines[0].quantity = 99;
    expect(inv.lines[0].quantity).toBe(1);
    expect(inv.createdAt).toBe("2026-09-01T10:00:00.000Z");
  });

  it("computes totals with tax on the net", () => {
    const inv = createInvoice(
      { customer: "Acme", currency: "EUR", lines: [{ description: "a", quantity: 2, unitPriceCents: 5000 }] },
      "INV-2",
      now,
    );
    expect(computeTotals(inv, 7)).toEqual({
      subtotalCents: 10000,
      discountCents: 0,
      netCents: 10000,
      taxCents: 700,
      totalCents: 10700,
    });
  });
});
