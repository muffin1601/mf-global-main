import { describe, expect, it } from "vitest";
import { calculateLineItem, calculateQuotationTotals, validateQuotationPayload } from "@/server/quotations/calc";

const items = [
  { name: "Service A", qty: 2, price: 100.1, discount: 10, tax: 18 },
  { name: "Service B", qty: 1, price: 50, discount: 0, tax: 5 },
];
const summary = { discount: 5, discountType: "%", additionalCharges: 10, autoRoundOff: true, roundOffSign: "+", roundOffAmount: 0.25, amountReceived: 100 };

describe("quotation calc (port of quotationCalc.js and its frontend tests)", () => {
  it("matches the MERN totals for line discount, tax, summary discount and charges", () => {
    expect(calculateQuotationTotals(items, summary)).toEqual({
      subtotal: 230.18, totalTax: 34.93, totalDiscount: 11.51, additionalCharges: 10, roundOff: 0.25, grandTotal: 263.85, amountReceived: 100, balanceAmount: 163.85,
    });
  });
  it("never produces NaN for blank or garbage numeric fields", () => {
    expect(calculateLineItem({ qty: "", price: undefined, discount: "bad", tax: "" })).toMatchObject({ taxableValue: 0, taxAmount: 0, total: 0 });
    const r = calculateQuotationTotals([], { discount: "", additionalCharges: "", roundOffAmount: "", amountReceived: "" });
    expect(Object.values(r).every(Number.isFinite)).toBe(true);
  });
  it("clamps negative amounts and percentage inputs", () => {
    const r = calculateQuotationTotals([{ qty: -2, price: 100, discount: 200, tax: 500 }], { discount: -10, additionalCharges: -5, amountReceived: -1 });
    expect(r.grandTotal).toBe(0);
    expect(r.balanceAmount).toBe(0);
  });
  it("supports a negative round-off sign and a flat discount; round-off ignored unless enabled", () => {
    const base = { discountType: "₹", discount: 20 };
    const line = [{ name: "x", qty: 1, price: 100, tax: 0 }];
    expect(calculateQuotationTotals(line, { ...base, autoRoundOff: true, roundOffSign: "-", roundOffAmount: 0.5 })).toMatchObject({ totalDiscount: 20, roundOff: -0.5, grandTotal: 79.5 });
    expect(calculateQuotationTotals(line, { ...base, roundOffSign: "-", roundOffAmount: 0.5 }).roundOff).toBe(0);
  });
  it("validates party and items like the server", () => {
    expect(validateQuotationPayload({ name: "A" }, []).isValid).toBe(false);
    expect(validateQuotationPayload({}, [{ name: "x", qty: 1, price: 1 }]).errors[0]).toMatch(/Customer/);
    expect(validateQuotationPayload({ name: "A" }, [{ name: "Bad", qty: -1, price: 2 }]).errors[0]).toMatch(/quantity/);
    expect(validateQuotationPayload({ name: "A" }, [{ name: "ok", qty: 1, price: -2 }]).errors[0]).toMatch(/negative/);
  });
});
