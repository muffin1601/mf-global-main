// Vendor vocabularies, normalisers and format validators (port of the MERN
// utils/vendorFields.js + vendorValidators.js). Pure functions: no I/O.
import type { VendorStatus } from "@/generated/prisma/enums";

export const VENDOR_PRIORITIES = ["Low", "Medium", "High", "Critical"] as const;
export const VENDOR_TYPES = ["Manufacturer", "Trader", "Importer", "Distributor", "Service Provider", "Contractor", "Other"] as const;
export const ADDRESS_TYPES = ["Registered Office", "Billing", "Shipping", "Warehouse", "Other"] as const;
export const DOCUMENT_TYPES = ["GST Certificate", "PAN", "Company Registration", "Bank Proof", "Agreement", "Contract", "NDA", "Compliance Certificate", "Price List", "Other"] as const;
export const ACTIVITY_TYPES = ["Note", "Call", "Email", "Meeting", "Follow-up", "Task", "Reminder", "Comment"] as const;
export const PAYMENT_METHODS = ["Bank Transfer", "NEFT", "RTGS", "UPI", "Cheque", "Cash", "Credit Card", "Other"] as const;
export const CURRENCIES = ["INR", "USD", "EUR", "GBP", "AED", "SGD", "JPY", "CNY", "AUD"] as const;
export const EVAL_CRITERIA = ["quality", "delivery", "leadTime", "pricing", "responsiveness", "compliance"] as const;
export type EvalCriterion = (typeof EVAL_CRITERIA)[number];
export const EVAL_LABELS: Record<EvalCriterion, string> = {
  quality: "Product quality",
  delivery: "Delivery reliability",
  leadTime: "Lead time",
  pricing: "Pricing competitiveness",
  responsiveness: "Response time",
  compliance: "Compliance",
};

// Workflow statuses. MERN had Suspended/Blacklisted; the migrated schema has
// INACTIVE/BLOCKED, so "Suspended" folds into Inactive and "Blacklisted" is BLOCKED.
export const STATUS_VALUES = ["ACTIVE", "PENDING", "INACTIVE", "BLOCKED"] as const satisfies readonly VendorStatus[];
export const STATUS_LABEL: Record<string, string> = { ACTIVE: "Active", PENDING: "Pending", INACTIVE: "Inactive", BLOCKED: "Blacklisted", ARCHIVED: "Archived" };

export function parseStatus(value: unknown): VendorStatus | null {
  const v = String(value ?? "").trim().toLowerCase();
  if (v === "active") return "ACTIVE";
  if (v === "pending") return "PENDING";
  if (v === "inactive" || v === "suspended") return "INACTIVE";
  if (v === "blocked" || v === "blacklisted") return "BLOCKED";
  return null;
}

const text = (v: unknown) => (v == null ? "" : String(v));
export const normalizeText = (v: unknown) => text(v).trim().replace(/\s+/g, " ").toLowerCase();

const LEGAL_SUFFIXES = ["private limited", "pvt ltd", "pvt limited", "p ltd", "private ltd", "limited", "ltd", "llp", "inc", "incorporated", "corporation", "corp", "company", "co", "gmbh", "plc", "and sons", "enterprises", "enterprise"].sort((a, b) => b.length - a.length);

export function normalizeCompanyName(v: unknown): string {
  let s = normalizeText(v).replace(/[.,'"&()-]/g, " ").replace(/\s+/g, " ").trim();
  for (const suffix of LEGAL_SUFFIXES) {
    if (s.endsWith(` ${suffix}`)) {
      s = s.slice(0, -(suffix.length + 1)).trim();
      break;
    }
  }
  return s.replace(/[^a-z0-9]/g, "");
}
export const normalizeCode = (v: unknown) => text(v).toUpperCase().replace(/[^A-Z0-9]/g, "");
export function normalizePhone(v: unknown): string {
  let d = text(v).replace(/\D/g, "");
  if (d.length === 12 && d.startsWith("91")) d = d.slice(2);
  if (d.length === 11 && d.startsWith("0")) d = d.slice(1);
  return d;
}
export const normalizeEmail = (v: unknown) => text(v).trim().toLowerCase();

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[a-z]{2,}$/i;
const GSTIN_RE = /^[0-3][0-9][A-Z]{5}[0-9]{4}[A-Z][1-9A-Z]Z[0-9A-Z]$/;
const PAN_RE = /^[A-Z]{5}[0-9]{4}[A-Z]$/;
const CIN_RE = /^[LU][0-9]{5}[A-Z]{2}[0-9]{4}[A-Z]{3}[0-9]{6}$/;
const IFSC_RE = /^[A-Z]{4}0[A-Z0-9]{6}$/;
const PINCODE_RE = /^[1-9][0-9]{5}$/;
const MOBILE_RE = /^[6-9][0-9]{9}$/;
const UPI_RE = /^[\w.-]{2,256}@[a-zA-Z]{2,64}$/;
const ACCOUNT_RE = /^[0-9]{9,18}$/;

export const isEmail = (v: unknown) => EMAIL_RE.test(text(v).trim());
export const isGstin = (v: unknown) => GSTIN_RE.test(normalizeCode(v));
export const isPan = (v: unknown) => PAN_RE.test(normalizeCode(v));
export const isCin = (v: unknown) => CIN_RE.test(normalizeCode(v));
export const isIfsc = (v: unknown) => IFSC_RE.test(normalizeCode(v));
export const isPincode = (v: unknown) => PINCODE_RE.test(text(v).trim());
export const isAccountNumber = (v: unknown) => ACCOUNT_RE.test(text(v).replace(/\s/g, ""));
export const isUpi = (v: unknown) => UPI_RE.test(text(v).trim());
export function isPhone(v: unknown) {
  const d = normalizePhone(v);
  return d.length === 10 ? MOBILE_RE.test(d) : d.length >= 7 && d.length <= 15;
}
export function isUrl(v: unknown) {
  const raw = text(v).trim();
  if (!raw) return false;
  try {
    return /\.[a-z]{2,}$/i.test(new URL(/^https?:\/\//i.test(raw) ? raw : `https://${raw}`).hostname);
  } catch {
    return false;
  }
}
export const canonicalUrl = (v: unknown) => {
  const r = text(v).trim();
  return !r ? "" : /^https?:\/\//i.test(r) ? r : `https://${r}`;
};
export function gstinMatchesPan(gstin: unknown, pan: unknown) {
  const g = normalizeCode(gstin);
  const p = normalizeCode(pan);
  if (!GSTIN_RE.test(g) || !PAN_RE.test(p)) return true;
  return g.slice(2, 12) === p;
}
export function maskTail(v: unknown, visible = 4) {
  const s = text(v).replace(/\s/g, "");
  if (!s) return "";
  if (s.length <= visible) return "*".repeat(s.length);
  return `${"*".repeat(Math.min(s.length - visible, 12))}${s.slice(-visible)}`;
}

export const has = (v: unknown) => v !== undefined && v !== null && String(v).trim() !== "";
export const clean = (v: unknown): string | null => (has(v) ? String(v).trim() : null);
export const isUuid = (v: unknown): v is string => typeof v === "string" && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(v);
export const parseDate = (v: unknown): Date | null => {
  if (!has(v)) return null;
  const d = v instanceof Date ? v : new Date(String(v));
  return Number.isNaN(d.getTime()) ? null : d;
};

export type Input = Record<string, unknown>;

export function validateVendorPayload(body: Input, opts: { partial?: boolean; currentType?: string | null } = {}): string[] {
  const errors: string[] = [];
  const need = (f: string) => !opts.partial || Object.prototype.hasOwnProperty.call(body, f);
  if (need("name")) {
    const name = text(body.name).trim();
    if (!name) errors.push("Vendor name is required");
    else if (name.length < 2) errors.push("Vendor name must be at least 2 characters");
    else if (name.length > 200) errors.push("Vendor name must be 200 characters or fewer");
  }
  if (has(body.legalName) && text(body.legalName).length > 250) errors.push("Legal business name must be 250 characters or fewer");
  if (has(body.email) && !isEmail(body.email)) errors.push("Enter a valid email address");
  if (has(body.phone) && !isPhone(body.phone)) errors.push("Enter a valid phone number");
  if (has(body.website) && !isUrl(body.website)) errors.push("Enter a valid website URL");
  if (has(body.gstin) && !isGstin(body.gstin)) errors.push("Enter a valid 15-character GSTIN");
  if (has(body.pan) && !isPan(body.pan)) errors.push("Enter a valid 10-character PAN");
  if (has(body.cin) && !isCin(body.cin)) errors.push("Enter a valid 21-character CIN");
  if (has(body.gstin) && has(body.pan) && !gstinMatchesPan(body.gstin, body.pan)) errors.push("GSTIN does not match the PAN provided (characters 3-12 of a GSTIN are the PAN)");
  if (has(body.status) && !parseStatus(body.status)) errors.push("Select a valid vendor status");
  if (has(body.priority) && !(VENDOR_PRIORITIES as readonly string[]).includes(text(body.priority))) errors.push("Select a valid vendor priority");
  if (has(body.vendorType) && !(VENDOR_TYPES as readonly string[]).includes(text(body.vendorType)) && body.vendorType !== opts.currentType) errors.push("Select a valid vendor type");
  if (body.tags !== undefined) {
    if (!Array.isArray(body.tags)) errors.push("Tags must be a list");
    else if (body.tags.length > 25) errors.push("A vendor can have at most 25 tags");
    else if (body.tags.some((t) => text(t).length > 40)) errors.push("Each tag must be 40 characters or fewer");
  }
  if (body.contacts !== undefined) {
    if (!Array.isArray(body.contacts)) errors.push("Contacts must be a list");
    else body.contacts.forEach((c, i) => errors.push(...validateContact(c as Input, i + 1)));
  }
  if (body.addresses !== undefined) {
    if (!Array.isArray(body.addresses)) errors.push("Addresses must be a list");
    else body.addresses.forEach((a, i) => errors.push(...validateAddress(a as Input, i + 1)));
  }
  if (body.bank !== undefined && body.bank !== null) {
    if (typeof body.bank !== "object") errors.push("Bank details are invalid");
    else errors.push(...validateBank(body.bank as Input));
  }
  return errors;
}

export function validateContact(c: Input = {}, pos: number | null = null): string[] {
  const e: string[] = [];
  const at = pos ? ` (contact ${pos})` : "";
  if (!has(c.name)) e.push(`Contact full name is required${at}`);
  else if (text(c.name).length > 120) e.push(`Contact full name is too long${at}`);
  if (has(c.email) && !isEmail(c.email)) e.push(`Enter a valid contact email${at}`);
  if (has(c.phone) && !isPhone(c.phone)) e.push(`Enter a valid contact phone number${at}`);
  if (!has(c.email) && !has(c.phone)) e.push(`Provide at least an email or a phone number for the contact${at}`);
  return e;
}

export function validateAddress(a: Input = {}, pos: number | null = null): string[] {
  const e: string[] = [];
  const at = pos ? ` (address ${pos})` : "";
  if (!has(a.line1)) e.push(`Address line 1 is required${at}`);
  else if (text(a.line1).length > 200) e.push(`Address line 1 is too long${at}`);
  if (has(a.type) && !(ADDRESS_TYPES as readonly string[]).includes(text(a.type))) e.push(`Select a valid address type${at}`);
  const country = text(a.country || "India").trim().toLowerCase();
  if (has(a.postalCode) && country === "india" && !isPincode(a.postalCode)) e.push(`Enter a valid 6-digit PIN code${at}`);
  return e;
}

export const isMasked = (v: unknown) => /\*/.test(text(v));

export function validateBank(b: Input = {}): string[] {
  const e: string[] = [];
  if (has(b.accountNumber) && !isMasked(b.accountNumber) && !isAccountNumber(b.accountNumber)) e.push("Account number must be 9 to 18 digits");
  if (has(b.ifsc) && !isIfsc(b.ifsc)) e.push("Enter a valid 11-character IFSC code");
  if (has(b.upi) && !isUpi(b.upi)) e.push("Enter a valid UPI ID (for example name@bank)");
  if (has(b.currency) && !(CURRENCIES as readonly string[]).includes(text(b.currency))) e.push("Select a supported currency");
  if (has(b.preferredPaymentMethod) && !(PAYMENT_METHODS as readonly string[]).includes(text(b.preferredPaymentMethod))) e.push("Select a valid payment method");
  if (has(b.creditPeriodDays)) {
    const d = Number(b.creditPeriodDays);
    if (!Number.isFinite(d) || d < 0 || d > 3650) e.push("Credit period must be between 0 and 3650 days");
  }
  if (has(b.accountNumber) && !isMasked(b.accountNumber) && !has(b.ifsc)) e.push("An IFSC code is required when an account number is provided");
  return e;
}

export function validatePriceTiers(tiers: Input[] = []): string[] {
  const errors: string[] = [];
  const norm: { min: number; max: number; index: number }[] = [];
  tiers.forEach((t, i) => {
    const at = ` (tier ${i + 1})`;
    const min = Number(t.minQty);
    const max = !has(t.maxQty) ? Infinity : Number(t.maxQty);
    const price = Number(t.unitPrice);
    if (!Number.isFinite(min) || min < 0) { errors.push(`Minimum quantity is invalid${at}`); return; }
    if (Number.isNaN(max)) { errors.push(`Maximum quantity is invalid${at}`); return; }
    if (max <= min) { errors.push(`Maximum quantity must be greater than minimum quantity${at}`); return; }
    if (!Number.isFinite(price) || price < 0) { errors.push(`Unit price is invalid${at}`); return; }
    if (has(t.discountPercent)) {
      const d = Number(t.discountPercent);
      if (!Number.isFinite(d) || d < 0 || d > 100) errors.push(`Discount must be between 0 and 100${at}`);
    }
    norm.push({ min, max, index: i + 1 });
  });
  norm.sort((a, b) => a.min - b.min);
  for (let i = 1; i < norm.length; i += 1) {
    const cur = norm[i]!; const prev = norm[i - 1]!;
    if (cur.min < prev.max) errors.push(`Quantity ranges overlap between tier ${prev.index} and tier ${cur.index}`);
  }
  return errors;
}

export function validateVendorProductPayload(body: Input, opts: { partial?: boolean } = {}): string[] {
  const e: string[] = [];
  const need = (f: string) => !opts.partial || Object.prototype.hasOwnProperty.call(body, f);
  if (need("productId") && !has(body.productId)) e.push("Select a product");
  if (need("purchasePrice")) {
    const p = Number(body.purchasePrice);
    if (!has(body.purchasePrice) || !Number.isFinite(p)) e.push("Purchase price is required");
    else if (p < 0) e.push("Purchase price cannot be negative");
    else if (p > 1e12) e.push("Purchase price is unrealistically large");
  }
  const range = (f: string, label: string, min: number, max: number) => {
    if (!has(body[f])) return;
    const n = Number(body[f]);
    if (!Number.isFinite(n)) e.push(`${label} must be a number`);
    else if (n < min || n > max) e.push(`${label} must be between ${min} and ${max}`);
  };
  range("moq", "Minimum order quantity", 0, 1e9);
  range("leadTimeDays", "Lead time (days)", 0, 3650);
  range("taxRate", "Tax rate", 0, 100);
  range("discountPercent", "Discount", 0, 100);
  if (has(body.currency) && !(CURRENCIES as readonly string[]).includes(text(body.currency))) e.push("Select a supported currency");
  const from = has(body.effectiveFrom) ? parseDate(body.effectiveFrom) : null;
  const to = has(body.effectiveTo) ? parseDate(body.effectiveTo) : null;
  if (has(body.effectiveFrom) && !from) e.push("Effective-from date is invalid");
  if (has(body.effectiveTo) && !to) e.push("Effective-until date is invalid");
  if (from && to && to <= from) e.push("Effective-until must be after effective-from");
  if (body.priceTiers !== undefined) {
    if (!Array.isArray(body.priceTiers)) e.push("Price tiers must be a list");
    else e.push(...validatePriceTiers(body.priceTiers as Input[]));
  }
  return e;
}

export function validateDocumentPayload(body: Input): string[] {
  const e: string[] = [];
  if (!has(body.name)) e.push("Document name is required");
  else if (text(body.name).length > 200) e.push("Document name is too long");
  if (has(body.documentType) && !(DOCUMENT_TYPES as readonly string[]).includes(text(body.documentType))) e.push("Select a valid document type");
  const issue = parseDate(body.issueDate);
  const expiry = parseDate(body.expiryDate);
  if (has(body.issueDate) && !issue) e.push("Issue date is invalid");
  if (has(body.expiryDate) && !expiry) e.push("Expiry date is invalid");
  if (issue && expiry && expiry <= issue) e.push("Expiry date must be after the issue date");
  return e;
}

export function validateEvaluationPayload(body: Input): string[] {
  const e: string[] = [];
  for (const k of EVAL_CRITERIA) {
    const n = Number(body[k]);
    if (!has(body[k]) || !Number.isFinite(n)) e.push(`${EVAL_LABELS[k]} rating is required`);
    else if (!Number.isInteger(n) || n < 1 || n > 5) e.push(`${EVAL_LABELS[k]} rating must be a whole number between 1 and 5`);
  }
  if (has(body.evaluationDate) && !parseDate(body.evaluationDate)) e.push("Evaluation date is invalid");
  if (has(body.comments) && text(body.comments).length > 2000) e.push("Comments must be 2000 characters or fewer");
  return e;
}

export function validateActivityPayload(body: Input): string[] {
  const e: string[] = [];
  if (!has(body.description)) e.push("Activity content is required");
  else if (text(body.description).length > 5000) e.push("Activity content must be 5000 characters or fewer");
  if (has(body.type) && !(ACTIVITY_TYPES as readonly string[]).includes(text(body.type))) e.push("Select a valid activity type");
  if (has(body.occurredAt) && !parseDate(body.occurredAt)) e.push("Activity date is invalid");
  return e;
}

export function validateCategoryPayload(body: Input, opts: { partial?: boolean } = {}): string[] {
  const e: string[] = [];
  if (!opts.partial || Object.prototype.hasOwnProperty.call(body, "name")) {
    const n = text(body.name).trim();
    if (!n) e.push("Category name is required");
    else if (n.length < 2) e.push("Category name must be at least 2 characters");
    else if (n.length > 120) e.push("Category name must be 120 characters or fewer");
  }
  if (has(body.description) && text(body.description).length > 1000) e.push("Description must be 1000 characters or fewer");
  return e;
}

export const performanceBand = (score: number | null | undefined) =>
  score == null ? "No data" : score < 2 ? "Poor" : score < 3 ? "Average" : score < 4 ? "Good" : "Excellent";

export type DocExpiryState = "none" | "expired" | "expiring" | "valid";
export function expiryState(expiry: Date | null, now = new Date()): { state: DocExpiryState; days: number | null } {
  if (!expiry) return { state: "none", days: null };
  const days = Math.ceil((expiry.getTime() - now.getTime()) / 86_400_000);
  return { state: days < 0 ? "expired" : days <= 30 ? "expiring" : "valid", days };
}
