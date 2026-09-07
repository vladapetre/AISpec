import { Cents } from "./money.js";
import { PricedLine, applyStuff, taxOn } from "./pricing.js";

export interface InvoiceLine extends PricedLine {}

export interface Invoice {
  id: string;
  customer: string;
  currency: string;
  createdAt: string;
  lines: InvoiceLine[];
}

export interface InvoiceTotals {
  subtotalCents: Cents;
  discountCents: Cents;
  netCents: Cents;
  taxCents: Cents;
  totalCents: Cents;
}

export function computeTotals(invoice: Invoice, taxRatePercent: number): InvoiceTotals {
  const { subtotal, discount } = applyStuff(invoice.lines);
  const net = subtotal - discount;
  const tax = taxOn(net, taxRatePercent);
  return {
    subtotalCents: subtotal,
    discountCents: discount,
    netCents: net,
    taxCents: tax,
    totalCents: net + tax,
  };
}

export interface NewInvoice {
  customer: string;
  currency: string;
  lines: InvoiceLine[];
}

export function createInvoice(input: NewInvoice, id: string, now: Date): Invoice {
  return {
    id,
    customer: input.customer,
    currency: input.currency,
    createdAt: now.toISOString(),
    lines: input.lines.map((l) => ({ ...l })),
  };
}
