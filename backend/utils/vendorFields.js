// Shared vendor field helpers: normalization (for duplicate detection and
// index-backed case-insensitive lookups), format validation, and masking of
// sensitive banking data.
//
// Used by the Vendor model (to maintain the *_norm shadow fields) and by the
// vendor routes (to validate payloads before they reach Mongoose, so users see
// human-readable errors instead of raw CastError/ValidationError text).

// --- Fixed business vocabularies -------------------------------------------
// These are genuinely fixed workflow states, so they are enums. Anything the
// business wants to configure (categories) lives in the VendorCategory
// collection instead.
const VENDOR_STATUSES = ["Active", "Pending", "Inactive", "Suspended", "Blacklisted"];
const VENDOR_PRIORITIES = ["Low", "Medium", "High", "Critical"];
const VENDOR_TYPES = ["Manufacturer", "Trader", "Importer", "Distributor", "Service Provider", "Contractor", "Other"];
const ADDRESS_TYPES = ["Registered Office", "Billing", "Shipping", "Warehouse", "Other"];
// Deliberately has no "Primary" entry: which contact is primary is the
// isPrimary flag, not a type. Keeping both produced a "Primary Primary" label.
const CONTACT_TYPES = ["General", "Sales", "Accounts", "Support", "Logistics", "Management", "Other"];
const DOCUMENT_TYPES = [
  "GST Certificate", "PAN", "Company Registration", "Bank Proof", "Agreement",
  "Contract", "NDA", "Compliance Certificate", "Price List", "Other",
];
const ACTIVITY_TYPES = ["Note", "Call", "Email", "Meeting", "Follow-up", "Task", "Reminder", "Comment"];
const PAYMENT_METHODS = ["Bank Transfer", "NEFT", "RTGS", "UPI", "Cheque", "Cash", "Credit Card", "Other"];
const CURRENCIES = ["INR", "USD", "EUR", "GBP", "AED", "SGD", "JPY", "CNY", "AUD"];

// --- Normalizers ------------------------------------------------------------
// Collapse whitespace + lowercase. "  ABC   Pvt Ltd " -> "abc pvt ltd".
const normalizeText = (v) =>
  v == null ? "" : String(v).trim().replace(/\s+/g, " ").toLowerCase();

// Aggressive normalization for company-name duplicate detection: drop legal
// suffixes and all non-alphanumerics so "ABC Pvt. Ltd." and "abc private
// limited" collapse to the same key.
const LEGAL_SUFFIXES = [
  "private limited", "pvt ltd", "pvt limited", "p ltd", "private ltd",
  "limited", "ltd", "llp", "inc", "incorporated", "corporation", "corp",
  "company", "co", "gmbh", "plc", "and sons", "enterprises", "enterprise",
];

const normalizeCompanyName = (v) => {
  let s = normalizeText(v).replace(/[.,'"&()-]/g, " ").replace(/\s+/g, " ").trim();
  // Strip a trailing legal suffix (longest match first so "pvt ltd" wins over "ltd").
  for (const suffix of [...LEGAL_SUFFIXES].sort((a, b) => b.length - a.length)) {
    if (s.endsWith(` ${suffix}`)) {
      s = s.slice(0, -(suffix.length + 1)).trim();
      break;
    }
  }
  return s.replace(/[^a-z0-9]/g, "");
};

// Uppercase, strip everything that is not alphanumeric (GSTIN / PAN / IFSC).
const normalizeCode = (v) => (v == null ? "" : String(v).toUpperCase().replace(/[^A-Z0-9]/g, ""));

// Bare national number: drop +91 / 91 / leading 0 so the same mobile entered in
// any format compares equal.
const normalizePhone = (v) => {
  let digits = (v == null ? "" : String(v)).replace(/\D/g, "");
  if (digits.length === 12 && digits.startsWith("91")) digits = digits.slice(2);
  if (digits.length === 11 && digits.startsWith("0")) digits = digits.slice(1);
  return digits;
};

const normalizeEmail = (v) => (v == null ? "" : String(v).trim().toLowerCase());

// --- Format validators ------------------------------------------------------
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[a-z]{2,}$/i;
// 2-digit state code, 10-char PAN, entity number, "Z", checksum char.
const GSTIN_RE = /^[0-3][0-9][A-Z]{5}[0-9]{4}[A-Z][1-9A-Z]Z[0-9A-Z]$/;
const PAN_RE = /^[A-Z]{5}[0-9]{4}[A-Z]$/;
const CIN_RE = /^[LUu][0-9]{5}[A-Z]{2}[0-9]{4}[A-Z]{3}[0-9]{6}$/;
const IFSC_RE = /^[A-Z]{4}0[A-Z0-9]{6}$/;
const PINCODE_RE = /^[1-9][0-9]{5}$/;
const INDIAN_MOBILE_RE = /^[6-9][0-9]{9}$/;
const UPI_RE = /^[\w.\-]{2,256}@[a-zA-Z]{2,64}$/;
// Account numbers are 9–18 digits across Indian banks.
const ACCOUNT_RE = /^[0-9]{9,18}$/;

const isEmail = (v) => EMAIL_RE.test(String(v || "").trim());
const isGstin = (v) => GSTIN_RE.test(normalizeCode(v));
const isPan = (v) => PAN_RE.test(normalizeCode(v));
const isCin = (v) => CIN_RE.test(normalizeCode(v));
const isIfsc = (v) => IFSC_RE.test(normalizeCode(v));
const isPincode = (v) => PINCODE_RE.test(String(v || "").trim());
const isAccountNumber = (v) => ACCOUNT_RE.test(String(v || "").replace(/\s/g, ""));
const isUpi = (v) => UPI_RE.test(String(v || "").trim());

// Accept any phone with 7–15 digits (international), but if it normalises to 10
// digits treat it as an Indian mobile and enforce the 6-9 leading digit rule.
const isPhone = (v) => {
  const digits = normalizePhone(v);
  if (digits.length === 10) return INDIAN_MOBILE_RE.test(digits);
  return digits.length >= 7 && digits.length <= 15;
};

const isUrl = (v) => {
  const raw = String(v || "").trim();
  if (!raw) return false;
  try {
    const url = new URL(/^https?:\/\//i.test(raw) ? raw : `https://${raw}`);
    // Require a dotted host so "foo" is rejected but "foo.com" passes.
    return /\.[a-z]{2,}$/i.test(url.hostname);
  } catch {
    return false;
  }
};

// Prefix a bare domain with https:// so stored websites are always clickable.
const canonicalUrl = (v) => {
  const raw = String(v || "").trim();
  if (!raw) return "";
  return /^https?:\/\//i.test(raw) ? raw : `https://${raw}`;
};

// GSTIN embeds the PAN at positions 3–12; catch the common data-entry mistake
// of pasting a GSTIN that belongs to a different PAN.
const gstinMatchesPan = (gstin, pan) => {
  const g = normalizeCode(gstin);
  const p = normalizeCode(pan);
  if (!GSTIN_RE.test(g) || !PAN_RE.test(p)) return true; // nothing to cross-check
  return g.slice(2, 12) === p;
};

// --- Masking ----------------------------------------------------------------
// Show only the last 4 characters. Never log or return the full value.
const maskTail = (v, visible = 4) => {
  const s = String(v || "").replace(/\s/g, "");
  if (!s) return "";
  if (s.length <= visible) return "*".repeat(s.length);
  return `${"*".repeat(Math.min(s.length - visible, 12))}${s.slice(-visible)}`;
};

module.exports = {
  VENDOR_STATUSES,
  VENDOR_PRIORITIES,
  VENDOR_TYPES,
  ADDRESS_TYPES,
  CONTACT_TYPES,
  DOCUMENT_TYPES,
  ACTIVITY_TYPES,
  PAYMENT_METHODS,
  CURRENCIES,
  normalizeText,
  normalizeCompanyName,
  normalizeCode,
  normalizePhone,
  normalizeEmail,
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
  canonicalUrl,
  gstinMatchesPan,
  maskTail,
};
