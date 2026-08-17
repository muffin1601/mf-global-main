// Client-side vendor validation.
//
// Deliberately mirrors backend/utils/vendorValidators.js. This layer exists to
// give immediate inline feedback — it is NOT the enforcement point. Every rule
// here is also enforced on the server, which is what actually protects the data.

export const VENDOR_STATUSES = ['Active', 'Pending', 'Inactive', 'Suspended', 'Blacklisted'];
export const VENDOR_PRIORITIES = ['Low', 'Medium', 'High', 'Critical'];

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[a-z]{2,}$/i;
const GSTIN_RE = /^[0-3][0-9][A-Z]{5}[0-9]{4}[A-Z][1-9A-Z]Z[0-9A-Z]$/;
const PAN_RE = /^[A-Z]{5}[0-9]{4}[A-Z]$/;
const CIN_RE = /^[LUu][0-9]{5}[A-Z]{2}[0-9]{4}[A-Z]{3}[0-9]{6}$/;
const IFSC_RE = /^[A-Z]{4}0[A-Z0-9]{6}$/;
const PINCODE_RE = /^[1-9][0-9]{5}$/;
const INDIAN_MOBILE_RE = /^[6-9][0-9]{9}$/;
const UPI_RE = /^[\w.-]{2,256}@[a-zA-Z]{2,64}$/;
const ACCOUNT_RE = /^[0-9]{9,18}$/;

export const normalizeCode = (v) => String(v || '').toUpperCase().replace(/[^A-Z0-9]/g, '');

export const normalizePhone = (v) => {
  let digits = String(v || '').replace(/\D/g, '');
  if (digits.length === 12 && digits.startsWith('91')) digits = digits.slice(2);
  if (digits.length === 11 && digits.startsWith('0')) digits = digits.slice(1);
  return digits;
};

export const isEmail = (v) => EMAIL_RE.test(String(v || '').trim());
export const isGstin = (v) => GSTIN_RE.test(normalizeCode(v));
export const isPan = (v) => PAN_RE.test(normalizeCode(v));
export const isCin = (v) => CIN_RE.test(normalizeCode(v));
export const isIfsc = (v) => IFSC_RE.test(normalizeCode(v));
export const isPincode = (v) => PINCODE_RE.test(String(v || '').trim());
export const isAccountNumber = (v) => ACCOUNT_RE.test(String(v || '').replace(/\s/g, ''));
export const isUpi = (v) => UPI_RE.test(String(v || '').trim());
export const isMasked = (v) => /\*/.test(String(v || ''));

export const isPhone = (v) => {
  const digits = normalizePhone(v);
  if (digits.length === 10) return INDIAN_MOBILE_RE.test(digits);
  return digits.length >= 7 && digits.length <= 15;
};

export const isUrl = (v) => {
  const raw = String(v || '').trim();
  if (!raw) return false;
  try {
    const url = new URL(/^https?:\/\//i.test(raw) ? raw : `https://${raw}`);
    return /\.[a-z]{2,}$/i.test(url.hostname);
  } catch {
    return false;
  }
};

// GSTIN embeds the PAN at characters 3–12.
export const gstinMatchesPan = (gstin, pan) => {
  const g = normalizeCode(gstin);
  const p = normalizeCode(pan);
  if (!GSTIN_RE.test(g) || !PAN_RE.test(p)) return true;
  return g.slice(2, 12) === p;
};

const present = (v) => v !== undefined && v !== null && String(v).trim() !== '';

/**
 * Validate the vendor form.
 * @returns {Object} field name -> message, for inline display under each input.
 */
export const validateVendorForm = (form = {}) => {
  const errors = {};

  const name = String(form.name || '').trim();
  if (!name) errors.name = 'Vendor name is required';
  else if (name.length < 2) errors.name = 'Enter at least 2 characters';
  else if (name.length > 200) errors.name = 'Use 200 characters or fewer';

  if (present(form.legalName) && form.legalName.length > 250) {
    errors.legalName = 'Use 250 characters or fewer';
  }
  if (present(form.email) && !isEmail(form.email)) errors.email = 'Enter a valid email address';
  if (present(form.phone) && !isPhone(form.phone)) errors.phone = 'Enter a valid phone number';
  if (present(form.website) && !isUrl(form.website)) errors.website = 'Enter a valid website (for example acme.com)';
  if (present(form.gstin) && !isGstin(form.gstin)) errors.gstin = 'Enter a valid 15-character GSTIN';
  if (present(form.pan) && !isPan(form.pan)) errors.pan = 'Enter a valid 10-character PAN';
  if (present(form.cin) && !isCin(form.cin)) errors.cin = 'Enter a valid 21-character CIN';
  if (present(form.gstin) && present(form.pan) && !gstinMatchesPan(form.gstin, form.pan)) {
    errors.gstin = 'This GSTIN does not match the PAN entered';
  }

  if (present(form.status) && !VENDOR_STATUSES.includes(form.status)) errors.status = 'Select a valid status';
  if (present(form.priority) && !VENDOR_PRIORITIES.includes(form.priority)) errors.priority = 'Select a valid priority';

  return errors;
};

export const validateContactForm = (form = {}) => {
  const errors = {};
  const name = String(form.fullName || '').trim();

  if (!name) errors.fullName = 'Full name is required';
  else if (name.length > 120) errors.fullName = 'Use 120 characters or fewer';

  if (present(form.email) && !isEmail(form.email)) errors.email = 'Enter a valid email address';
  if (present(form.phone) && !isPhone(form.phone)) errors.phone = 'Enter a valid phone number';
  if (present(form.whatsapp) && !isPhone(form.whatsapp)) errors.whatsapp = 'Enter a valid WhatsApp number';
  if (present(form.altPhone) && !isPhone(form.altPhone)) errors.altPhone = 'Enter a valid phone number';

  if (!present(form.email) && !present(form.phone)) {
    errors.email = 'Add an email or a phone number';
  }
  return errors;
};

export const validateAddressForm = (form = {}) => {
  const errors = {};
  if (!String(form.line1 || '').trim()) errors.line1 = 'Address line 1 is required';
  else if (form.line1.length > 200) errors.line1 = 'Use 200 characters or fewer';

  const country = String(form.country || 'India').trim().toLowerCase();
  if (present(form.pincode) && country === 'india' && !isPincode(form.pincode)) {
    errors.pincode = 'Enter a valid 6-digit PIN code';
  }
  return errors;
};

export const validateBankForm = (form = {}) => {
  const errors = {};
  // A masked value is the untouched stored number echoed back — not an edit.
  if (present(form.accountNumber) && !isMasked(form.accountNumber) && !isAccountNumber(form.accountNumber)) {
    errors.accountNumber = 'Account number must be 9 to 18 digits';
  }
  if (present(form.ifsc) && !isIfsc(form.ifsc)) errors.ifsc = 'Enter a valid 11-character IFSC';
  if (present(form.upi) && !isUpi(form.upi)) errors.upi = 'Enter a valid UPI ID (for example name@bank)';
  if (present(form.accountNumber) && !isMasked(form.accountNumber) && !present(form.ifsc)) {
    errors.ifsc = 'An IFSC is required with an account number';
  }
  if (present(form.creditPeriodDays)) {
    const days = Number(form.creditPeriodDays);
    if (!Number.isFinite(days) || days < 0 || days > 3650) {
      errors.creditPeriodDays = 'Enter between 0 and 3650 days';
    }
  }
  return errors;
};

export const validateVendorProductForm = (form = {}) => {
  const errors = {};
  if (!present(form.product)) errors.product = 'Select a product';

  const price = Number(form.purchasePrice);
  if (!present(form.purchasePrice)) errors.purchasePrice = 'Purchase price is required';
  else if (!Number.isFinite(price) || price < 0) errors.purchasePrice = 'Enter a valid price';

  const range = (field, label, min, max) => {
    if (!present(form[field])) return;
    const n = Number(form[field]);
    if (!Number.isFinite(n) || n < min || n > max) errors[field] = `${label} must be between ${min} and ${max}`;
  };
  range('moq', 'Minimum order quantity', 0, 1e9);
  range('leadTimeDays', 'Lead time', 0, 3650);
  range('taxRate', 'Tax rate', 0, 100);
  range('discountPercent', 'Discount', 0, 100);

  if (present(form.effectiveFrom) && present(form.effectiveTo)
    && new Date(form.effectiveTo) <= new Date(form.effectiveFrom)) {
    errors.effectiveTo = 'Must be after the effective-from date';
  }

  // Quantity bands must not overlap — the same rule the server applies.
  const tiers = (form.priceTiers || [])
    .map((t, i) => ({
      i,
      min: Number(t.minQty),
      max: t.maxQty === '' || t.maxQty === null || t.maxQty === undefined ? Infinity : Number(t.maxQty),
      price: Number(t.unitPrice),
    }));

  for (const tier of tiers) {
    if (!Number.isFinite(tier.min) || tier.min < 0) errors.priceTiers = `Tier ${tier.i + 1}: minimum quantity is invalid`;
    else if (tier.max <= tier.min) errors.priceTiers = `Tier ${tier.i + 1}: maximum must be greater than minimum`;
    else if (!Number.isFinite(tier.price) || tier.price < 0) errors.priceTiers = `Tier ${tier.i + 1}: unit price is invalid`;
  }
  if (!errors.priceTiers) {
    const sorted = [...tiers].sort((a, b) => a.min - b.min);
    for (let i = 1; i < sorted.length; i += 1) {
      if (sorted[i].min < sorted[i - 1].max) {
        errors.priceTiers = 'Quantity ranges overlap — adjust the tiers so they do not cover the same quantities';
        break;
      }
    }
  }

  return errors;
};

export const validateDocumentForm = (form = {}) => {
  const errors = {};
  if (!String(form.name || '').trim()) errors.name = 'Document name is required';
  else if (form.name.length > 200) errors.name = 'Use 200 characters or fewer';

  if (present(form.issueDate) && present(form.expiryDate)
    && new Date(form.expiryDate) <= new Date(form.issueDate)) {
    errors.expiryDate = 'Expiry must be after the issue date';
  }
  return errors;
};

// Mirrors the backend allowlist so an obviously wrong file is caught before it
// is uploaded. The server re-checks both the extension and the mimetype.
export const ALLOWED_DOCUMENT_EXTENSIONS = ['.pdf', '.jpg', '.jpeg', '.png', '.webp', '.doc', '.docx', '.xls', '.xlsx'];
export const MAX_DOCUMENT_BYTES = 10 * 1024 * 1024;

export const validateDocumentFile = (file) => {
  if (!file) return 'Choose a file to upload';
  const ext = `.${String(file.name || '').split('.').pop().toLowerCase()}`;
  if (!ALLOWED_DOCUMENT_EXTENSIONS.includes(ext)) {
    return `Unsupported file type. Allowed: ${ALLOWED_DOCUMENT_EXTENSIONS.join(', ')}`;
  }
  if (file.size > MAX_DOCUMENT_BYTES) return 'File is too large. The maximum size is 10 MB.';
  if (file.size === 0) return 'That file is empty';
  return '';
};

export const validateActivityForm = (form = {}) => {
  const errors = {};
  const body = String(form.body || '').trim();
  if (!body) errors.body = 'Add some details';
  else if (body.length > 5000) errors.body = 'Use 5000 characters or fewer';
  if (present(form.subject) && form.subject.length > 200) errors.subject = 'Use 200 characters or fewer';
  return errors;
};

export const validateEvaluationForm = (form = {}) => {
  const errors = {};
  const criteria = {
    quality: 'Product quality',
    delivery: 'Delivery reliability',
    leadTime: 'Lead time',
    pricing: 'Pricing competitiveness',
    responsiveness: 'Response time',
    compliance: 'Compliance',
  };
  Object.entries(criteria).forEach(([key, label]) => {
    const n = Number(form[key]);
    if (!present(form[key]) || !Number.isFinite(n)) errors[key] = `Rate ${label.toLowerCase()}`;
    else if (n < 1 || n > 5) errors[key] = 'Rate between 1 and 5';
  });
  return errors;
};

export const hasErrors = (errors) => Object.keys(errors || {}).length > 0;
