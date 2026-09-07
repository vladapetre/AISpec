import { Cents, percentOf, sum } from "./money.js";

export interface PricedLine {
  description: string;
  quantity: number;
  unitPriceCents: Cents;
}

/** Volume discount ladder by line count: 10+ lines 5%, 25+ lines 10%. */
const LADDER: Array<{ minLines: number; percent: number }> = [
  { minLines: 25, percent: 10 },
  { minLines: 10, percent: 5 },
];

export function lineSubtotal(line: PricedLine): Cents {
  if (line.quantity < 0) throw new RangeError("quantity must not be negative");
  return line.quantity * line.unitPriceCents;
}

export function applyStuff(lines: PricedLine[]): { subtotal: Cents; discount: Cents } {
  const subtotal = sum(lines.map(lineSubtotal));
  const rung = LADDER.find((r) => lines.length >= r.minLines);
  const discount = rung ? percentOf(subtotal, rung.percent) : 0;
  return { subtotal, discount };
}

export function taxOn(netCents: Cents, ratePercent: number): Cents {
  return percentOf(netCents, ratePercent);
}
