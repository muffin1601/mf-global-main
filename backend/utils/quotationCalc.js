// Server-side single source of truth for all quotation money math.
// Every numeric is coerced safely so NaN / Infinity can never be persisted.

const num = (v) => {
  const n = typeof v === "number" ? v : parseFloat(v);
  return Number.isFinite(n) ? n : 0;
};
const clamp = (v, min, max) => Math.min(Math.max(num(v), min), max);
const round2 = (v) => Math.round((num(v) + Number.EPSILON) * 100) / 100;

// One line item -> normalized amounts.
function calculateLineItem(item = {}) {
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

// Whole-quotation totals from items + summary. Authoritative.
function calculateQuotationTotals(items = [], summary = {}) {
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

  return {
    subtotal,
    totalTax,
    totalDiscount: summaryDiscount,
    additionalCharges,
    roundOff: round2(roundOff),
    grandTotal,
    amountReceived,
    balanceAmount,
  };
}

// Validate a quotation payload before persisting.
function validateQuotationPayload(party, items) {
  const errors = [];
  if (!party || !(party.name || party.company)) errors.push("Customer (party) is required.");
  if (!Array.isArray(items) || items.length === 0) {
    errors.push("At least one item is required.");
  } else {
    items.forEach((it, i) => {
      if (!it || (!it.name && !it.description)) errors.push(`Item ${i + 1}: name is required.`);
      if (num(it && it.qty) <= 0) errors.push(`Item ${i + 1}: quantity must be greater than 0.`);
      if (num(it && it.price) < 0) errors.push(`Item ${i + 1}: price cannot be negative.`);
    });
  }
  return { isValid: errors.length === 0, errors };
}

module.exports = { num, round2, calculateLineItem, calculateQuotationTotals, validateQuotationPayload };
