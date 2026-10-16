import { describe, expect, it } from 'vitest';
import { calculateQuotationLine, calculateQuotationPreview } from './quotationCalc';

describe('quotation preview calculations', () => {
  it('matches server rules for line discount, tax, summary discount and charges', () => {
    const result = calculateQuotationPreview([
      { qty: 2, price: 100.10, discount: 10, tax: 18 },
      { qty: 1, price: 50, discount: 0, tax: 5 },
    ], {
      discount: 5,
      discountType: '%',
      additionalCharges: 10,
      autoRoundOff: true,
      roundOffSign: '+',
      roundOffAmount: 0.25,
      amountReceived: 100,
    });

    expect(result).toEqual({
      subtotal: 230.18,
      tax: 34.93,
      summaryDiscount: 11.51,
      additionalCharges: 10,
      roundOff: 0.25,
      finalTotal: 263.85,
      balanceAmount: 163.85,
    });
  });

  it('never produces NaN while users are editing blank numeric fields', () => {
    const line = calculateQuotationLine({ qty: '', price: undefined, discount: 'bad', tax: '' });
    expect(line).toEqual({ taxableValue: 0, taxAmount: 0, total: 0 });

    const result = calculateQuotationPreview([], {
      discount: '', additionalCharges: '', roundOffAmount: '', amountReceived: '',
    });
    expect(Object.values(result).every(Number.isFinite)).toBe(true);
  });

  it('clamps negative amounts and percentage inputs', () => {
    const result = calculateQuotationPreview([
      { qty: -2, price: 100, discount: 200, tax: 500 },
    ], { discount: -10, additionalCharges: -5, amountReceived: -1 });
    expect(result.finalTotal).toBe(0);
    expect(result.balanceAmount).toBe(0);
  });
});
