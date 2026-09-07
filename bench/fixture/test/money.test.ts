import { describe, expect, it } from "vitest";
import { formatCents, percentOf, sum } from "../src/domain/money.js";

describe("money", () => {
  it("sums integer cents", () => {
    expect(sum([100, 250, 5])).toBe(355);
  });

  it("rejects non-integer cents", () => {
    expect(() => sum([1.5])).toThrow(TypeError);
  });

  it("computes a percentage on an exact multiple", () => {
    expect(percentOf(10000, 7)).toBe(700);
  });

  it("formats cents with two decimals and the currency", () => {
    expect(formatCents(123456, "EUR")).toBe("1234.56 EUR");
    expect(formatCents(-5, "GBP")).toBe("-0.05 GBP");
  });
});
