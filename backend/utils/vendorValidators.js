// Server-side payload validation for the vendor module.
//
// Runs BEFORE Mongoose so users get one clear message per problem instead of a
// raw ValidationError, and so cross-field rules (GSTIN vs PAN, price tier
// overlaps, effective-date windows) are checked in one place. The Mongoose
// schema still validates independently — this layer improves the message, it
// does not replace enforcement.

const {
  VENDOR_STATUSES,
  VENDOR_PRIORITIES,
  VENDOR_TYPES,
  ADDRESS_TYPES,
  CONTACT_TYPES,
  DOCUMENT_TYPES,
  ACTIVITY_TYPES,
  PAYMENT_METHODS,
  CURRENCIES,
  isEmail,
  isGstin,
  isPan,
  isCin,
  isIfsc,
  isPincode,
  isAccountNumber,
  isUpi,
  isPhone,
  isUrl,
  gstinMatchesPan,
} = require('./vendorFields');

const has = (v) => v !== undefined && v !== null && String(v).trim() !== '';

const validateVendorPayload = (body = {}, { partial = false, currentType = null } = {}) => {
  const errors = [];
  const need = (field) => (partial ? Object.prototype.hasOwnProperty.call(body, field) : true);

  if (need('name')) {
    const name = String(body.name || '').trim();
    if (!name) errors.push('Vendor name is required');
    else if (name.length < 2) errors.push('Vendor name must be at least 2 characters');
    else if (name.length > 200) errors.push('Vendor name must be 200 characters or fewer');
  }

  if (has(body.legalName) && String(body.legalName).length > 250) {
    errors.push('Legal business name must be 250 characters or fewer');
  }
  if (has(body.email) && !isEmail(body.email)) errors.push('Enter a valid email address');
  if (has(body.phone) && !isPhone(body.phone)) errors.push('Enter a valid phone number');
  if (has(body.website) && !isUrl(body.website)) errors.push('Enter a valid website URL');
  if (has(body.gstin) && !isGstin(body.gstin)) errors.push('Enter a valid 15-character GSTIN');
  if (has(body.pan) && !isPan(body.pan)) errors.push('Enter a valid 10-character PAN');
  if (has(body.cin) && !isCin(body.cin)) errors.push('Enter a valid 21-character CIN');
  if (has(body.gstin) && has(body.pan) && !gstinMatchesPan(body.gstin, body.pan)) {
    errors.push('GSTIN does not match the PAN provided (characters 3–12 of a GSTIN are the PAN)');
  }
  if (has(body.pin_code) && !isPincode(body.pin_code)) errors.push('Enter a valid 6-digit PIN code');

  if (has(body.status) && !VENDOR_STATUSES.includes(body.status)) errors.push('Select a valid vendor status');
  if (has(body.priority) && !VENDOR_PRIORITIES.includes(body.priority)) errors.push('Select a valid vendor priority');
  // A value carried over from an older record is accepted unchanged, so
  // editing a pre-existing vendor never fails on a type we no longer offer.
  if (has(body.type) && !VENDOR_TYPES.includes(body.type) && body.type !== currentType) {
    errors.push('Select a valid vendor type');
  }

  if (body.tags !== undefined) {
    if (!Array.isArray(body.tags)) errors.push('Tags must be a list');
    else if (body.tags.length > 25) errors.push('A vendor can have at most 25 tags');
    else if (body.tags.some((t) => String(t).length > 40)) errors.push('Each tag must be 40 characters or fewer');
  }

  if (body.contacts !== undefined) {
    if (!Array.isArray(body.contacts)) errors.push('Contacts must be a list');
    else body.contacts.forEach((c, i) => errors.push(...validateContact(c, i + 1)));
  }

  if (body.addresses !== undefined) {
    if (!Array.isArray(body.addresses)) errors.push('Addresses must be a list');
    else body.addresses.forEach((a, i) => errors.push(...validateAddress(a, i + 1)));
  }

  if (body.bank !== undefined && body.bank !== null) {
    if (typeof body.bank !== 'object') errors.push('Bank details are invalid');
    else errors.push(...validateBank(body.bank));
  }

  return errors;
};

const validateContact = (contact = {}, position = null) => {
  const errors = [];
  const at = position ? ` (contact ${position})` : '';

  if (!has(contact.fullName)) errors.push(`Contact full name is required${at}`);
  else if (String(contact.fullName).length > 120) errors.push(`Contact full name is too long${at}`);

  if (has(contact.email) && !isEmail(contact.email)) errors.push(`Enter a valid contact email${at}`);
  if (has(contact.phone) && !isPhone(contact.phone)) errors.push(`Enter a valid contact phone number${at}`);
  if (has(contact.whatsapp) && !isPhone(contact.whatsapp)) errors.push(`Enter a valid WhatsApp number${at}`);
  if (has(contact.altPhone) && !isPhone(contact.altPhone)) errors.push(`Enter a valid alternate phone number${at}`);
  if (has(contact.contactType) && !CONTACT_TYPES.includes(contact.contactType)) {
    errors.push(`Select a valid contact type${at}`);
  }
  if (!has(contact.email) && !has(contact.phone)) {
    errors.push(`Provide at least an email or a phone number for the contact${at}`);
  }
  return errors;
};

const validateAddress = (address = {}, position = null) => {
  const errors = [];
  const at = position ? ` (address ${position})` : '';

  if (!has(address.line1)) errors.push(`Address line 1 is required${at}`);
  else if (String(address.line1).length > 200) errors.push(`Address line 1 is too long${at}`);
  if (has(address.addressType) && !ADDRESS_TYPES.includes(address.addressType)) {
    errors.push(`Select a valid address type${at}`);
  }
  // Only enforce the Indian 6-digit format when the address is in India.
  const country = String(address.country || 'India').trim().toLowerCase();
  if (has(address.pincode) && country === 'india' && !isPincode(address.pincode)) {
    errors.push(`Enter a valid 6-digit PIN code${at}`);
  }
  return errors;
};

// A value the UI echoed back from the masked display (e.g. "********9012").
// It carries no new information, so the route leaves the stored number alone
// and validation must not reject it as a malformed account number.
const isMaskedValue = (v) => /\*/.test(String(v || ''));

const validateBank = (bank = {}) => {
  const errors = [];
  if (has(bank.accountNumber) && !isMaskedValue(bank.accountNumber) && !isAccountNumber(bank.accountNumber)) {
    errors.push('Account number must be 9 to 18 digits');
  }
  if (has(bank.ifsc) && !isIfsc(bank.ifsc)) errors.push('Enter a valid 11-character IFSC code');
  if (has(bank.upi) && !isUpi(bank.upi)) errors.push('Enter a valid UPI ID (for example name@bank)');
  if (has(bank.currency) && !CURRENCIES.includes(bank.currency)) errors.push('Select a supported currency');
  if (has(bank.preferredPaymentMethod) && !PAYMENT_METHODS.includes(bank.preferredPaymentMethod)) {
    errors.push('Select a valid payment method');
  }
  if (bank.creditPeriodDays !== undefined && bank.creditPeriodDays !== '' && bank.creditPeriodDays !== null) {
    const days = Number(bank.creditPeriodDays);
    if (!Number.isFinite(days) || days < 0 || days > 3650) {
      errors.push('Credit period must be between 0 and 3650 days');
    }
  }
  // An account number without an IFSC cannot be paid to — catch the half-filled
  // form. A masked echo is exempt: the stored pair is already complete.
  if (has(bank.accountNumber) && !isMaskedValue(bank.accountNumber) && !has(bank.ifsc)) {
    errors.push('An IFSC code is required when an account number is provided');
  }
  return errors;
};

// --- Vendor product / pricing ----------------------------------------------
const validateVendorProductPayload = (body = {}, { partial = false } = {}) => {
  const errors = [];
  const need = (f) => (partial ? Object.prototype.hasOwnProperty.call(body, f) : true);

  if (need('product') && !has(body.product)) errors.push('Select a product');

  if (need('purchasePrice')) {
    const price = Number(body.purchasePrice);
    if (!has(body.purchasePrice) || !Number.isFinite(price)) errors.push('Purchase price is required');
    else if (price < 0) errors.push('Purchase price cannot be negative');
    else if (price > 1e12) errors.push('Purchase price is unrealistically large');
  }

  const numberRange = (field, label, min, max) => {
    if (body[field] === undefined || body[field] === '' || body[field] === null) return;
    const n = Number(body[field]);
    if (!Number.isFinite(n)) errors.push(`${label} must be a number`);
    else if (n < min || n > max) errors.push(`${label} must be between ${min} and ${max}`);
  };
  numberRange('moq', 'Minimum order quantity', 0, 1e9);
  numberRange('leadTimeDays', 'Lead time (days)', 0, 3650);
  numberRange('taxRate', 'Tax rate', 0, 100);
  numberRange('discountPercent', 'Discount', 0, 100);

  if (has(body.currency) && !CURRENCIES.includes(body.currency)) errors.push('Select a supported currency');

  const from = has(body.effectiveFrom) ? new Date(body.effectiveFrom) : null;
  const to = has(body.effectiveTo) ? new Date(body.effectiveTo) : null;
  if (from && Number.isNaN(from.getTime())) errors.push('Effective-from date is invalid');
  if (to && Number.isNaN(to.getTime())) errors.push('Effective-until date is invalid');
  if (from && to && !Number.isNaN(from.getTime()) && !Number.isNaN(to.getTime()) && to <= from) {
    errors.push('Effective-until must be after effective-from');
  }

  if (body.priceTiers !== undefined) {
    if (!Array.isArray(body.priceTiers)) {
      errors.push('Price tiers must be a list');
    } else {
      errors.push(...validatePriceTiers(body.priceTiers));
    }
  }

  return errors;
};

// Quantity bands must be well-formed and must not overlap each other.
const validatePriceTiers = (tiers = []) => {
  const errors = [];
  const normalized = [];

  tiers.forEach((tier, i) => {
    const at = ` (tier ${i + 1})`;
    const min = Number(tier.minQty);
    const max = tier.maxQty === null || tier.maxQty === undefined || tier.maxQty === ''
      ? Infinity
      : Number(tier.maxQty);
    const price = Number(tier.unitPrice);

    if (!Number.isFinite(min) || min < 0) { errors.push(`Minimum quantity is invalid${at}`); return; }
    if (!Number.isFinite(max) && max !== Infinity) { errors.push(`Maximum quantity is invalid${at}`); return; }
    if (max <= min) { errors.push(`Maximum quantity must be greater than minimum quantity${at}`); return; }
    if (!Number.isFinite(price) || price < 0) { errors.push(`Unit price is invalid${at}`); return; }
    if (tier.discountPercent !== undefined && tier.discountPercent !== '' && tier.discountPercent !== null) {
      const d = Number(tier.discountPercent);
      if (!Number.isFinite(d) || d < 0 || d > 100) errors.push(`Discount must be between 0 and 100${at}`);
    }

    normalized.push({ min, max, index: i + 1 });
  });

  normalized.sort((a, b) => a.min - b.min);
  for (let i = 1; i < normalized.length; i += 1) {
    if (normalized[i].min < normalized[i - 1].max) {
      errors.push(`Quantity ranges overlap between tier ${normalized[i - 1].index} and tier ${normalized[i].index}`);
    }
  }

  return errors;
};

// --- Documents / evaluations / activities / categories ----------------------
const validateDocumentPayload = (body = {}) => {
  const errors = [];
  if (!has(body.name)) errors.push('Document name is required');
  else if (String(body.name).length > 200) errors.push('Document name is too long');
  if (has(body.documentType) && !DOCUMENT_TYPES.includes(body.documentType)) {
    errors.push('Select a valid document type');
  }
  const issue = has(body.issueDate) ? new Date(body.issueDate) : null;
  const expiry = has(body.expiryDate) ? new Date(body.expiryDate) : null;
  if (issue && Number.isNaN(issue.getTime())) errors.push('Issue date is invalid');
  if (expiry && Number.isNaN(expiry.getTime())) errors.push('Expiry date is invalid');
  if (issue && expiry && !Number.isNaN(issue.getTime()) && !Number.isNaN(expiry.getTime()) && expiry <= issue) {
    errors.push('Expiry date must be after the issue date');
  }
  return errors;
};

const EVAL_CRITERIA = ['quality', 'delivery', 'leadTime', 'pricing', 'responsiveness', 'compliance'];
const EVAL_LABELS = {
  quality: 'Product quality',
  delivery: 'Delivery reliability',
  leadTime: 'Lead time',
  pricing: 'Pricing competitiveness',
  responsiveness: 'Response time',
  compliance: 'Compliance',
};

const validateEvaluationPayload = (body = {}) => {
  const errors = [];
  for (const key of EVAL_CRITERIA) {
    const n = Number(body[key]);
    if (!has(body[key]) || !Number.isFinite(n)) {
      errors.push(`${EVAL_LABELS[key]} rating is required`);
    } else if (n < 1 || n > 5) {
      errors.push(`${EVAL_LABELS[key]} rating must be between 1 and 5`);
    }
  }
  if (has(body.evaluationDate) && Number.isNaN(new Date(body.evaluationDate).getTime())) {
    errors.push('Evaluation date is invalid');
  }
  if (has(body.comments) && String(body.comments).length > 2000) {
    errors.push('Comments must be 2000 characters or fewer');
  }
  return errors;
};

const validateActivityPayload = (body = {}) => {
  const errors = [];
  if (!has(body.body)) errors.push('Activity content is required');
  else if (String(body.body).length > 5000) errors.push('Activity content must be 5000 characters or fewer');
  if (has(body.activityType) && !ACTIVITY_TYPES.includes(body.activityType)) {
    errors.push('Select a valid activity type');
  }
  if (has(body.dueDate) && Number.isNaN(new Date(body.dueDate).getTime())) errors.push('Due date is invalid');
  return errors;
};

const validateCategoryPayload = (body = {}, { partial = false } = {}) => {
  const errors = [];
  if (!partial || Object.prototype.hasOwnProperty.call(body, 'name')) {
    const name = String(body.name || '').trim();
    if (!name) errors.push('Category name is required');
    else if (name.length < 2) errors.push('Category name must be at least 2 characters');
    else if (name.length > 120) errors.push('Category name must be 120 characters or fewer');
  }
  if (has(body.description) && String(body.description).length > 1000) {
    errors.push('Description must be 1000 characters or fewer');
  }
  return errors;
};

module.exports = {
  validateVendorPayload,
  validateContact,
  validateAddress,
  validateBank,
  validateVendorProductPayload,
  validatePriceTiers,
  validateDocumentPayload,
  validateEvaluationPayload,
  validateActivityPayload,
  validateCategoryPayload,
  EVAL_CRITERIA,
};
