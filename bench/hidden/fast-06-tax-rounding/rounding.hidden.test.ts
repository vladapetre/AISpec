import { describe, expect, it } from "vitest";
import { percentOf } from "../../src/domain/money.js";
import { computeTotals } from "../../src/domain/invoice.js";

describe("hidden: percentages round half up to the cent", () => {
  it("1999 at 7% is 140", () => {
    expect(percentOf(1999, 7)).toBe(140);
  });
  it("exact multiples are unchanged", () => {
    expect(percentOf(10000, 7)).toBe(700);
  });
  it("half rounds up", () => {
    expect(percentOf(50, 5)).toBe(3); // 2.5 -> 3
  });
  it("flows into invoice totals", () => {
    const inv = { id: "x", customer: "c", currency: "EUR", createdAt: "2026-01-01T00:00:00.000Z", lines: [{ description: "a", quantity: 1, unitPriceCents: 1999 }] };
    expect(computeTotals(inv, 7).taxCents).toBe(140);
    expect(computeTotals(inv, 7).totalCents).toBe(2139);
  });
});
