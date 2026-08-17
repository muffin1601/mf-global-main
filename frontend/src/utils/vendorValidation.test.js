// The client-side validation rules must agree with the server's, otherwise the
// form would accept input the API then rejects (or vice versa).

import { describe, it, expect } from 'vitest';

import {
  validateVendorForm, validateContactForm, validateAddressForm, validateBankForm,
  validateVendorProductForm, validateDocumentForm, validateActivityForm,
  validateEvaluationForm, validateDocumentFile, hasErrors,
  isEmail, isPhone, isGstin, isPan, isIfsc, isUrl, isPincode, isUpi, isMasked,
  gstinMatchesPan, normalizeCode, normalizePhone,
} from './vendorValidation';

describe('field format checks', () => {
  it('accepts and rejects emails, phones and URLs correctly', () => {
    expect(isEmail('sales@acme.co.in')).toBe(true);
    expect(isEmail('sales@acme')).toBe(false);

    expect(isPhone('9876543210')).toBe(true);
    expect(isPhone('+91 98765-43210')).toBe(true);
    expect(isPhone('1234567890')).toBe(false); // Indian mobiles start 6-9

    expect(isUrl('acme.com')).toBe(true);
    expect(isUrl('https://acme.com/a')).toBe(true);
    expect(isUrl('acme')).toBe(false);
  });

  it('validates Indian statutory identifiers', () => {
    expect(isGstin('27AAPFU0939F1ZV')).toBe(true);
    expect(isGstin('27aapfu0939f1zv')).toBe(true);
    expect(isGstin('27AAPFU0939F1Z')).toBe(false);
    expect(isPan('AAPFU0939F')).toBe(true);
    expect(isPan('AAPFU093')).toBe(false);
    expect(isIfsc('HDFC0001234')).toBe(true);
    expect(isIfsc('HDFC1001234')).toBe(false);
    expect(isPincode('110001')).toBe(true);
    expect(isPincode('011000')).toBe(false);
    expect(isUpi('acme@okhdfcbank')).toBe(true);
  });

  it('normalizes identifiers and phone numbers the same way the server does', () => {
    expect(normalizeCode(' 27aapfu0939f1zv ')).toBe('27AAPFU0939F1ZV');
    expect(normalizePhone('+91 98765-43210')).toBe('9876543210');
    expect(normalizePhone('09876543210')).toBe('9876543210');
  });

  it('cross-checks a GSTIN against its PAN', () => {
    expect(gstinMatchesPan('27AAPFU0939F1ZV', 'AAPFU0939F')).toBe(true);
    expect(gstinMatchesPan('27AAPFU0939F1ZV', 'BBPFU0939F')).toBe(false);
    expect(gstinMatchesPan('', 'AAPFU0939F')).toBe(true); // nothing to compare
  });

  it('recognises a masked account number', () => {
    expect(isMasked('********9012')).toBe(true);
    expect(isMasked('123456789012')).toBe(false);
  });
});

describe('validateVendorForm', () => {
  it('passes a minimal valid vendor', () => {
    expect(validateVendorForm({ name: 'Acme Supplies' })).toEqual({});
  });

  it('reports one readable message per field', () => {
    const errors = validateVendorForm({ name: 'A', email: 'bad', gstin: 'XX', website: 'x' });
    expect(errors.name).toMatch(/at least 2 characters/);
    expect(errors.email).toMatch(/valid email/);
    expect(errors.gstin).toMatch(/valid 15-character GSTIN/);
    expect(errors.website).toMatch(/valid website/);
    expect(hasErrors(errors)).toBe(true);
  });

  it('flags a GSTIN that does not belong to the PAN entered', () => {
    const errors = validateVendorForm({
      name: 'Acme', gstin: '27AAPFU0939F1ZV', pan: 'BBPFU0939F',
    });
    expect(errors.gstin).toMatch(/does not match the PAN/);
  });
});

describe('validateContactForm', () => {
  it('requires a name and at least one way to reach the contact', () => {
    expect(validateContactForm({}).fullName).toMatch(/required/);
    expect(validateContactForm({ fullName: 'Asha' }).email).toMatch(/email or a phone/);
    expect(validateContactForm({ fullName: 'Asha', phone: '9876543210' })).toEqual({});
  });
});

describe('validateAddressForm', () => {
  it('requires line 1 and only enforces the 6-digit PIN inside India', () => {
    expect(validateAddressForm({}).line1).toMatch(/required/);
    expect(validateAddressForm({ line1: '1 Main St', pincode: '110001' })).toEqual({});
    expect(validateAddressForm({ line1: '1 Main St', pincode: 'W1A 1AA' }).pincode).toBeTruthy();
    expect(validateAddressForm({ line1: '1 Main St', country: 'UK', pincode: 'W1A 1AA' })).toEqual({});
  });
});

describe('validateBankForm', () => {
  it('requires an IFSC alongside a real account number', () => {
    expect(validateBankForm({ accountNumber: '123456789012' }).ifsc).toMatch(/IFSC is required/);
    expect(validateBankForm({ accountNumber: '123456789012', ifsc: 'HDFC0001234' })).toEqual({});
    expect(validateBankForm({ accountNumber: '12' }).accountNumber).toMatch(/9 to 18 digits/);
  });

  it('treats a masked account number as unchanged, not invalid', () => {
    // The form only ever holds the mask, so re-submitting it must not error.
    expect(validateBankForm({ accountNumber: '********9012' })).toEqual({});
  });

  it('bounds the credit period', () => {
    expect(validateBankForm({ creditPeriodDays: 45 })).toEqual({});
    expect(validateBankForm({ creditPeriodDays: 99999 }).creditPeriodDays).toBeTruthy();
  });
});

describe('validateVendorProductForm', () => {
  const base = { product: 'p1', purchasePrice: 100 };

  it('requires a product and a sane price', () => {
    expect(validateVendorProductForm({}).product).toMatch(/Select a product/);
    expect(validateVendorProductForm({ product: 'p1' }).purchasePrice).toMatch(/required/);
    expect(validateVendorProductForm({ ...base, purchasePrice: -5 }).purchasePrice).toBeTruthy();
    expect(validateVendorProductForm(base)).toEqual({});
  });

  it('rejects an effective window that ends before it starts', () => {
    const errors = validateVendorProductForm({
      ...base, effectiveFrom: '2026-06-01', effectiveTo: '2026-01-01',
    });
    expect(errors.effectiveTo).toMatch(/after the effective-from/);
  });

  it('accepts contiguous price tiers and rejects overlapping ones', () => {
    expect(validateVendorProductForm({
      ...base,
      priceTiers: [
        { minQty: 1, maxQty: 50, unitPrice: 120 },
        { minQty: 50, maxQty: 100, unitPrice: 110 },
        { minQty: 100, maxQty: '', unitPrice: 100 },
      ],
    })).toEqual({});

    expect(validateVendorProductForm({
      ...base,
      priceTiers: [
        { minQty: 1, maxQty: 60, unitPrice: 120 },
        { minQty: 50, maxQty: 100, unitPrice: 110 },
      ],
    }).priceTiers).toMatch(/overlap/i);
  });

  it('bounds tax and discount percentages', () => {
    expect(validateVendorProductForm({ ...base, taxRate: 200 }).taxRate).toBeTruthy();
    expect(validateVendorProductForm({ ...base, discountPercent: 150 }).discountPercent).toBeTruthy();
  });
});

describe('document validation', () => {
  it('requires a name and a sensible expiry', () => {
    expect(validateDocumentForm({}).name).toMatch(/required/);
    expect(validateDocumentForm({
      name: 'GST', issueDate: '2026-06-01', expiryDate: '2026-01-01',
    }).expiryDate).toMatch(/after the issue date/);
  });

  it('rejects unsupported and oversized files before upload', () => {
    const file = (name, size) => ({ name, size });
    expect(validateDocumentFile(file('gst.pdf', 1024))).toBe('');
    expect(validateDocumentFile(file('evil.html', 1024))).toMatch(/Unsupported file type/);
    expect(validateDocumentFile(file('big.pdf', 11 * 1024 * 1024))).toMatch(/too large/);
    expect(validateDocumentFile(file('empty.pdf', 0))).toMatch(/empty/);
    expect(validateDocumentFile(null)).toMatch(/Choose a file/);
  });
});

describe('activity and evaluation validation', () => {
  it('requires activity content', () => {
    expect(validateActivityForm({}).body).toBeTruthy();
    expect(validateActivityForm({ body: 'Called about the quote' })).toEqual({});
  });

  it('requires every evaluation criterion within 1-5', () => {
    const complete = {
      quality: 4, delivery: 5, leadTime: 3, pricing: 4, responsiveness: 5, compliance: 4,
    };
    expect(validateEvaluationForm(complete)).toEqual({});
    expect(validateEvaluationForm({ ...complete, quality: 9 }).quality).toMatch(/between 1 and 5/);
    expect(validateEvaluationForm({ ...complete, compliance: undefined }).compliance).toBeTruthy();
  });
});
