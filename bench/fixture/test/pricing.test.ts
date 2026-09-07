import { describe, expect, it } from "vitest";
import { applyStuff, lineSubtotal, taxOn } from "../src/domain/pricing.js";

const line = (quantity: number, unitPriceCents: number) => ({ description: "x", quantity, unitPriceCents });

describe("pricing", () => {
  it("multiplies quantity by unit price", () => {
    expect(lineSubtotal(line(3, 250))).toBe(750);
  });

  it("rejects negative quantities", () => {
    expect(() => lineSubtotal(line(-1, 100))).toThrow(RangeError);
  });

  it("applies no discount under ten lines", () => {
    const lines = Array.from({ length: 9 }, () => line(1, 1000));
    expect(applyStuff(lines)).toEqual({ subtotal: 9000, discount: 0 });
  });

  it("applies five percent at ten lines", () => {
    const lines = Array.from({ length: 10 }, () => line(1, 1000));
    expect(applyStuff(lines)).toEqual({ subtotal: 10000, discount: 500 });
  });

  it("applies ten percent at twenty-five lines", () => {
    const lines = Array.from({ length: 25 }, () => line(1, 1000));
    expect(applyStuff(lines)).toEqual({ subtotal: 25000, discount: 2500 });
  });

  it("computes tax on the net amount", () => {
    expect(taxOn(10000, 7)).toBe(700);
  });
});
