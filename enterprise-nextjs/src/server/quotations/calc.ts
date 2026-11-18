// Single source of truth for quotation money maths. Port of the MERN
// backend/utils/quotationCalc.js; pure (no server-only imports) so the browser
// form uses the very same module for its live preview.

export type ItemInput = { name?: unknown; description?: unknown; qty?: unknown; price?: unknown; discount?: unknown; tax?: unknown };
export type SummaryInput = {
  discount?: unknown;
  discountType?: unknown;
  additionalCharges?: unknown;
  applyTCS?: unknown;
  autoRoundOff?: unknown;
  roundOffSign?: unknown;
  roundOffAmount?: unknown;
  amountReceived?: unknown;
  paymentMethod?: unknown;
};

export const num = (v: unknown): number => {
  const n = typeof v === "number" ? v : Number.parseFloat(String(v));
  return Number.isFinite(n) ? n : 0;
};
const clamp = (v: unknown, min: number, max: number) => Math.min(Math.max(num(v), min), max);
export const round2 = (v: unknown) => Math.round((num(v) + Number.EPSILON) * 100) / 100;

export function calculateLineItem(item: ItemInput = {}) {
  const qty = Math.max(0, num(item.qty));
  const price = Math.max(0, num(item.price));
  const discountPct = clamp(item.discount, 0, 100);
  const taxRate = clamp(item.tax, 0, 100);

  const amount = qty * price;
  const discountAmount = amount * (discountPct / 100);
  const taxableValue = amount - discountAmount;
  const taxAmount = taxableValue * (taxRate / 100);

  return {
    qty, price, discountPct, taxRate,
    amount: round2(amount),
    discountAmount: round2(discountAmount),
    taxableValue: round2(taxableValue),
    taxAmount: round2(taxAmount),
    total: round2(taxableValue + taxAmount),
  };
}

export type QuotationTotals = {
  subtotal: number;
  totalTax: number;
  totalDiscount: number;
  additionalCharges: number;
  roundOff: number;
  grandTotal: number;
  amountReceived: number;
  balanceAmount: number;
};

/** Whole-quotation totals from items + summary. Authoritative on the server. */
export function calculateQuotationTotals(items: ItemInput[] = [], summary: SummaryInput = {}): QuotationTotals {
  let subtotal = 0;
  let totalTax = 0;
  for (const it of items) {
    const li = calculateLineItem(it);
    subtotal += li.taxableValue;
    totalTax += li.taxAmount;
  }
  subtotal = round2(subtotal);
  totalTax = round2(totalTax);

  const summaryDiscount =
    summary.discountType === "%"
      ? round2(subtotal * (clamp(summary.discount, 0, 100) / 100))
      : Math.max(0, round2(num(summary.discount)));

  const additionalCharges = Math.max(0, round2(num(summary.additionalCharges)));
  const preRoundTotal = round2(subtotal + totalTax + additionalCharges - summaryDiscount);

  const roundOff = summary.autoRoundOff
    ? (summary.roundOffSign === "+" ? 1 : -1) * Math.max(0, round2(num(summary.roundOffAmount)))
    : 0;

  const grandTotal = Math.max(0, round2(preRoundTotal + roundOff));
  const amountReceived = Math.max(0, round2(num(summary.amountReceived)));
  const balanceAmount = round2(grandTotal - amountReceived);

  return { subtotal, totalTax, totalDiscount: summaryDiscount, additionalCharges, roundOff: round2(roundOff), grandTotal, amountReceived, balanceAmount };
}

export function validateQuotationPayload(party: { name?: unknown; company?: unknown } | null | undefined, items: unknown) {
  const errors: string[] = [];
  if (!party || !(party.name || party.company)) errors.push("Customer (party) is required.");
  if (!Array.isArray(items) || items.length === 0) {
    errors.push("At least one item is required.");
  } else {
    (items as (ItemInput | null)[]).forEach((it, i) => {
      if (!it || (!it.name && !it.description)) errors.push(`Item ${i + 1}: name is required.`);
      if (num(it && it.qty) <= 0) errors.push(`Item ${i + 1}: quantity must be greater than 0.`);
      if (num(it && it.price) < 0) errors.push(`Item ${i + 1}: price cannot be negative.`);
    });
  }
  return { isValid: errors.length === 0, errors };
}
