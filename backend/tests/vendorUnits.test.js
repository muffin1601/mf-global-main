// Pure-function tests for the vendor module's normalization, validation,
// duplicate-key and CSV-mapping logic. No database required.

const test = require('node:test');
const assert = require('node:assert/strict');

const {
  normalizeCompanyName, normalizeCode, normalizePhone, normalizeEmail,
  isGstin, isPan, isIfsc, isEmail, isPhone, isUrl, isPincode, isUpi,
  gstinMatchesPan, maskTail, canonicalUrl,
} = require('../utils/vendorFields');

const {
  validateVendorPayload, validateContact, validateAddress, validateBank,
  validateVendorProductPayload, validatePriceTiers, validateEvaluationPayload,
} = require('../utils/vendorValidators');

const { suggestMapping, mapRow, validateRow, missingRequired } = require('../utils/vendorCsv');
const { performanceBand, pick, escapeRegex, scrub } = require('../utils/vendorHelpers');

test('normalizeCompanyName collapses case, whitespace and legal suffixes', () => {
  const key = normalizeCompanyName('ABC Pvt Ltd');
  assert.equal(normalizeCompanyName('abc pvt ltd'), key);
  assert.equal(normalizeCompanyName('  ABC PVT LTD  '), key);
  assert.equal(normalizeCompanyName('A.B.C.  Pvt.  Ltd.'), key);
  assert.equal(normalizeCompanyName('ABC Private Limited'), key);
  // Genuinely different businesses must NOT collapse together.
  assert.notEqual(normalizeCompanyName('ABD Pvt Ltd'), key);
});

test('identifier normalizers strip formatting', () => {
  assert.equal(normalizeCode(' 27aapfu0939f1zv '), '27AAPFU0939F1ZV');
  assert.equal(normalizePhone('+91 98765-43210'), '9876543210');
  assert.equal(normalizePhone('09876543210'), '9876543210');
  assert.equal(normalizeEmail('  Sales@Vendor.COM '), 'sales@vendor.com');
});

test('GSTIN / PAN / IFSC format checks', () => {
  assert.ok(isGstin('27AAPFU0939F1ZV'));
  assert.ok(isGstin('27aapfu0939f1zv'), 'lowercase input is normalized before checking');
  assert.ok(!isGstin('27AAPFU0939F1Z'), 'too short');
  assert.ok(isPan('AAPFU0939F'));
  assert.ok(!isPan('AAPFU0939'));
  assert.ok(isIfsc('HDFC0001234'));
  assert.ok(!isIfsc('HDFC1001234'), '5th character must be zero');
});

test('GSTIN is cross-checked against PAN', () => {
  assert.ok(gstinMatchesPan('27AAPFU0939F1ZV', 'AAPFU0939F'));
  assert.ok(!gstinMatchesPan('27AAPFU0939F1ZV', 'BBPFU0939F'));
  // Nothing to compare against -> no false rejection.
  assert.ok(gstinMatchesPan('', 'AAPFU0939F'));
});

test('email / phone / url / pincode / upi validators', () => {
  assert.ok(isEmail('a.b@vendor.co.in'));
  assert.ok(!isEmail('a.b@vendor'));
  assert.ok(isPhone('9876543210'));
  assert.ok(!isPhone('1234567890'), 'Indian mobiles start 6-9');
  assert.ok(isPhone('+1 415 555 0123'), 'international numbers still accepted');
  assert.ok(isUrl('vendor.com'));
  assert.ok(isUrl('https://vendor.com/path'));
  assert.ok(!isUrl('not a url'));
  assert.ok(isPincode('110001'));
  assert.ok(!isPincode('011000'));
  assert.ok(isUpi('vendor@okhdfcbank'));
  assert.equal(canonicalUrl('vendor.com'), 'https://vendor.com');
});

test('maskTail hides all but the last four characters', () => {
  const masked = maskTail('123456789012');
  assert.ok(masked.endsWith('9012'));
  assert.ok(!masked.includes('12345'), 'the leading digits must not survive');
  assert.equal(maskTail(''), '');
});

test('validateVendorPayload reports human-readable problems', () => {
  assert.deepEqual(validateVendorPayload({ name: 'Acme Supplies' }), []);

  const errors = validateVendorPayload({ name: 'A', email: 'nope', gstin: 'BAD', website: 'x' });
  assert.ok(errors.some((e) => /at least 2 characters/.test(e)));
  assert.ok(errors.some((e) => /valid email/.test(e)));
  assert.ok(errors.some((e) => /valid 15-character GSTIN/.test(e)));
  assert.ok(errors.some((e) => /valid website/.test(e)));
  // No raw Mongoose text leaks into the message.
  errors.forEach((e) => assert.ok(!/ValidationError|Cast to/.test(e)));
});

test('partial validation only checks the fields present', () => {
  assert.deepEqual(validateVendorPayload({ priority: 'High' }, { partial: true }), []);
  assert.ok(validateVendorPayload({ name: '' }, { partial: true }).length);
});

test('contact and address rules', () => {
  assert.ok(validateContact({}).some((e) => /full name is required/i.test(e)));
  assert.ok(validateContact({ fullName: 'Jo' }).some((e) => /at least an email or a phone/i.test(e)));
  assert.deepEqual(validateContact({ fullName: 'Jo', phone: '9876543210' }), []);

  assert.ok(validateAddress({}).some((e) => /Address line 1 is required/.test(e)));
  assert.deepEqual(validateAddress({ line1: '12 Main St', pincode: '110001' }), []);
  // A non-Indian address is not held to the 6-digit rule.
  assert.deepEqual(validateAddress({ line1: '1 Foo', country: 'Germany', pincode: 'W1A 1AA' }), []);
});

test('bank details must be internally consistent', () => {
  assert.deepEqual(validateBank({ accountNumber: '123456789012', ifsc: 'HDFC0001234' }), []);
  assert.ok(validateBank({ accountNumber: '123456789012' }).some((e) => /IFSC code is required/.test(e)));
  assert.ok(validateBank({ accountNumber: '12' }).some((e) => /9 to 18 digits/.test(e)));
});

test('price tiers must not overlap', () => {
  assert.deepEqual(validatePriceTiers([
    { minQty: 1, maxQty: 50, unitPrice: 120 },
    { minQty: 50, maxQty: 100, unitPrice: 110 },
    { minQty: 100, maxQty: null, unitPrice: 100 },
  ]), []);

  const overlap = validatePriceTiers([
    { minQty: 1, maxQty: 60, unitPrice: 120 },
    { minQty: 50, maxQty: 100, unitPrice: 110 },
  ]);
  assert.ok(overlap.some((e) => /overlap/i.test(e)));

  assert.ok(validatePriceTiers([{ minQty: 10, maxQty: 5, unitPrice: 1 }])
    .some((e) => /greater than minimum/i.test(e)));
});

test('vendor product payload validates prices and date windows', () => {
  assert.ok(validateVendorProductPayload({}).some((e) => /Select a product/.test(e)));
  assert.ok(validateVendorProductPayload({ product: 'x' }).some((e) => /Purchase price is required/.test(e)));
  assert.ok(validateVendorProductPayload({ product: 'x', purchasePrice: -1 })
    .some((e) => /cannot be negative/.test(e)));
  assert.ok(validateVendorProductPayload({
    product: 'x', purchasePrice: 10, effectiveFrom: '2025-06-01', effectiveTo: '2025-01-01',
  }).some((e) => /must be after effective-from/.test(e)));
  assert.ok(validateVendorProductPayload({ product: 'x', purchasePrice: 10, taxRate: 200 })
    .some((e) => /Tax rate must be between/.test(e)));
});

test('evaluations require every criterion within 1-5', () => {
  const complete = { quality: 4, delivery: 5, leadTime: 3, pricing: 4, responsiveness: 5, compliance: 4 };
  assert.deepEqual(validateEvaluationPayload(complete), []);
  assert.ok(validateEvaluationPayload({ ...complete, quality: 9 }).some((e) => /between 1 and 5/.test(e)));
  assert.ok(validateEvaluationPayload({ ...complete, compliance: undefined })
    .some((e) => /Compliance rating is required/.test(e)));
});

test('performanceBand distinguishes "No data" from a real score', () => {
  assert.equal(performanceBand(null), 'No data');
  assert.equal(performanceBand(1.4), 'Poor');
  assert.equal(performanceBand(2.5), 'Average');
  assert.equal(performanceBand(3.6), 'Good');
  assert.equal(performanceBand(4.8), 'Excellent');
});

test('pick drops keys that are not explicitly allowed (mass-assignment guard)', () => {
  const out = pick({ name: 'Acme', _id: 'evil', isArchived: true, v_code: 'VX999' }, ['name']);
  assert.deepEqual(out, { name: 'Acme' });
});

test('escapeRegex neutralises regex metacharacters in search input', () => {
  const rx = new RegExp(escapeRegex('a.*b('));
  assert.ok(rx.test('a.*b('));
  assert.ok(!rx.test('axxb'));
});

test('audit scrub redacts anything that looks like banking data', () => {
  const cleaned = scrub({ name: 'Acme', bank: { accountNumber: '123456789', ifsc: 'HDFC0001234', bankName: 'HDFC' } });
  assert.equal(cleaned.bank.accountNumber, '[redacted]');
  assert.equal(cleaned.bank.ifsc, '[redacted]');
  assert.equal(cleaned.bank.bankName, 'HDFC', 'non-sensitive fields survive');
  assert.equal(cleaned.name, 'Acme');
});

test('CSV header mapping recognises common spellings', () => {
  const mapping = suggestMapping(['Vendor Name', 'GST Number', 'Mobile Number', 'Unknown Column']);
  assert.equal(mapping['Vendor Name'], 'name');
  assert.equal(mapping['GST Number'], 'gstin');
  assert.equal(mapping['Mobile Number'], 'phone');
  assert.equal(mapping['Unknown Column'], '');
  assert.deepEqual(missingRequired(mapping), []);
  assert.deepEqual(missingRequired({ 'Some Column': 'city' }), ['name']);
});

test('CSV rows map and validate, and invalid rows are explained not dropped', () => {
  const mapping = { 'Vendor Name': 'name', Email: 'email', GSTIN: 'gstin', Tags: 'tags' };

  const good = mapRow({ 'Vendor Name': ' Acme Supplies ', Email: 'a@b.com', GSTIN: '27AAPFU0939F1ZV', Tags: 'steel; bulk' }, mapping);
  assert.equal(good.name, 'Acme Supplies');
  assert.deepEqual(good.tags, ['steel', 'bulk']);
  assert.deepEqual(validateRow(good), []);

  const bad = mapRow({ 'Vendor Name': '', Email: 'oops', GSTIN: 'XX' }, mapping);
  const errors = validateRow(bad);
  assert.ok(errors.some((e) => /Vendor name is missing/.test(e)));
  assert.ok(errors.some((e) => /Invalid email/.test(e)));
  assert.ok(errors.some((e) => /Invalid GSTIN/.test(e)));
});
