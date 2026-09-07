/** All amounts are integer cents. Floats never leave this module. */

export type Cents = number;

export function assertCents(value: number, label = "amount"): Cents {
  if (!Number.isInteger(value)) throw new TypeError(`${label} must be integer cents, got ${value}`);
  return value;
}

export function sum(values: Cents[]): Cents {
  return values.reduce((acc, v) => acc + assertCents(v), 0);
}

/** Returns ratePercent% of amount, in cents. */
export function percentOf(amount: Cents, ratePercent: number): Cents {
  assertCents(amount);
  return Math.floor((amount * ratePercent) / 100);
}

export function formatCents(amount: Cents, currency: string): string {
  const sign = amount < 0 ? "-" : "";
  const abs = Math.abs(amount);
  const whole = Math.floor(abs / 100);
  const frac = String(abs % 100).padStart(2, "0");
  return `${sign}${whole}.${frac} ${currency}`;
}
