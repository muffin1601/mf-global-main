// Preview-only mirror of the server calculation. Persisted totals always come
// from backend/utils/quotationCalc.js; this keeps the form stable while typing.
export const finiteNumber = (value) => {
  const number = typeof value === 'number' ? value : Number.parseFloat(value);
  return Number.isFinite(number) ? number : 0;
};

const clamp = (value, min, max) => Math.min(Math.max(finiteNumber(value), min), max);
const round2 = (value) => Math.round((finiteNumber(value) + Number.EPSILON) * 100) / 100;

export const calculateQuotationLine = (item = {}) => {
  const quantity = Math.max(0, finiteNumber(item.qty));
  const price = Math.max(0, finiteNumber(item.price));
  const lineDiscount = clamp(item.discount, 0, 100);
  const taxRate = clamp(item.tax, 0, 100);
  const taxableValue = quantity * price * (1 - lineDiscount / 100);
  const taxAmount = taxableValue * (taxRate / 100);
  return { taxableValue: round2(taxableValue), taxAmount: round2(taxAmount), total: round2(taxableValue + taxAmount) };
};

export const calculateQuotationPreview = (items = [], summary = {}) => {
  let subtotal = 0;
  let tax = 0;

  for (const item of items) {
    const line = calculateQuotationLine(item);
    subtotal += line.taxableValue;
    tax += line.taxAmount;
  }

  subtotal = round2(subtotal);
  tax = round2(tax);
  const summaryDiscount = summary.discountType === '%'
    ? round2(subtotal * (clamp(summary.discount, 0, 100) / 100))
    : Math.max(0, round2(summary.discount));
  const additionalCharges = Math.max(0, round2(summary.additionalCharges));
  const roundOff = summary.autoRoundOff
    ? (summary.roundOffSign === '+' ? 1 : -1) * Math.max(0, round2(summary.roundOffAmount))
    : 0;
  const finalTotal = Math.max(0, round2(subtotal + tax + additionalCharges - summaryDiscount + roundOff));
  const balanceAmount = round2(finalTotal - Math.max(0, round2(summary.amountReceived)));

  return { subtotal, tax, summaryDiscount, additionalCharges, roundOff, finalTotal, balanceAmount };
};
