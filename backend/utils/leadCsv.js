// Shared CSV lead-import logic: header mapping, per-row validation, field
// mapping to the ClientData shape, and duplicate detection. Used by the
// /lead-import endpoints. Kept self-contained so the legacy /upload-csv route is
// unaffected.

// -------------------------------------------------------------------------
// Header aliases — map the human-friendly column names non-technical staff use
// (and the legacy CRM headers) onto canonical internal field keys. All lookups
// are case-insensitive and whitespace-trimmed.
// -------------------------------------------------------------------------
const HEADER_ALIASES = {
  company: ["company name", "company", "companyname", "firm", "organisation", "organization"],
  name: ["contact person", "contact person name", "contact name", "name", "contactperson", "person"],
  phone: ["mobile number", "mobile no", "mobile no.", "mobile", "phone", "phone number", "phone no", "contact number"],
  email: ["email", "email address", "e-mail", "mail"],
  location: ["city", "location", "town"],
  state: ["state", "region"],
  category: ["category", "industry", "segment"],
  requirements: ["requirements", "requirement", "needs"],
  remarks: ["remarks", "remark", "notes", "note"],
  // Optional / back-compat fields (accepted but never required).
  contact: ["alternate contact", "alt contact", "secondary contact"],
  datatype: ["datatype", "data type", "source", "lead source"],
  quantity: ["quantity", "qty"],
  address: ["address", "full address"],
};

// Required friendly fields (per spec): Company Name, Contact Person, Mobile Number.
const REQUIRED_FIELDS = ["company", "name", "phone"];

// Canonical lead-source values supported by the CRM.
const DATATYPE_ALIASES = {
  indiamart: "IndiaMart",
  offline: "Offline",
  tradeindia: "TradeIndia",
  justdial: "JustDial",
  webportals: "WebPortals",
  linkedin: "LinkedIn",
  linkend: "LinkedIn",
  calling: "Offline",
  exhibition: "Offline",
  other: "Other",
};

// Generous length caps that match real lead data (the model itself has no
// length constraints — these only guard against absurd/garbage cells).
const MAX_LEN = { company: 150, name: 100, location: 100, state: 100, category: 100 };

const PHONE_REGEX = /^[6-9][0-9]{9}$/;
// Pragmatic email check — good enough to catch obvious typos without rejecting
// valid-but-unusual addresses.
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// Strip control/non-printable chars and trim. Keeps the value a string.
const cleanInput = (input) =>
  (input == null ? "" : String(input)).replace(/[^\x20-\x7E]/g, "").trim();

// Strip a leading +91/91 country code (and any non-digits) so 12-digit and
// 0-prefixed numbers normalise to a bare 10-digit mobile number.
const normalizePhone = (raw) => {
  let digits = (raw || "").replace(/\D/g, "");
  if (digits.length === 12 && digits.startsWith("91")) digits = digits.slice(2);
  if (digits.length === 11 && digits.startsWith("0")) digits = digits.slice(1);
  return digits;
};

// Parse DD-MM-YYYY / DD/MM/YYYY (Excel export format here) plus anything Date
// natively parses. Returns a valid Date or null.
const parseDate = (raw) => {
  if (!raw) return null;
  const dmy = String(raw).trim().match(/^(\d{1,2})[-/](\d{1,2})[-/](\d{4})$/);
  const d = dmy
    ? new Date(Number(dmy[3]), Number(dmy[2]) - 1, Number(dmy[1]))
    : new Date(raw);
  return isNaN(d.getTime()) ? null : d;
};

// Build a map from a raw CSV header row to canonical keys. Returns
// { map: { rawHeaderLower -> canonicalKey }, missingRequired: [friendlyName] }.
const buildHeaderMap = (rawHeaders) => {
  const lowerHeaders = rawHeaders.map((h) => cleanInput(h).toLowerCase());
  const map = {};
  for (const [canonical, aliases] of Object.entries(HEADER_ALIASES)) {
    const idx = lowerHeaders.findIndex((h) => aliases.includes(h));
    if (idx !== -1) map[lowerHeaders[idx]] = canonical;
  }
  const present = new Set(Object.values(map));
  const FRIENDLY = { company: "Company Name", name: "Contact Person", phone: "Mobile Number" };
  const missingRequired = REQUIRED_FIELDS.filter((f) => !present.has(f)).map((f) => FRIENDLY[f]);
  return { map, missingRequired };
};

// Convert a raw csv-parser row object into canonical field keys using the map.
const canonicalizeRow = (row, headerMap) => {
  const out = {};
  for (const rawKey in row) {
    const canonical = headerMap[cleanInput(rawKey).toLowerCase()];
    if (canonical) out[canonical] = cleanInput(row[rawKey]);
  }
  return out;
};

// Is this row completely empty? (the ~1M blank trailing rows Excel appends).
const isBlankRow = (canonical) =>
  Object.values(canonical).every((v) => !v || !String(v).trim());

// Validate a single canonicalized row.
// Returns { ok: true, lead } or { ok: false, reason }.
// `lead` is the ClientData-shaped object ready for insert (without assignedTo).
const validateRow = (canonical, fileName) => {
  const company = canonical.company || "";
  const name = canonical.name || "";
  const phone = normalizePhone(canonical.phone);
  const email = (canonical.email || "").trim();

  if (!company) return { ok: false, reason: "Missing Company Name" };
  if (!name) return { ok: false, reason: "Missing Contact Person" };
  if (!canonical.phone || !phone) return { ok: false, reason: "Missing Mobile Number" };
  if (!PHONE_REGEX.test(phone)) return { ok: false, reason: "Invalid Mobile Number" };
  if (email && !EMAIL_REGEX.test(email)) return { ok: false, reason: "Invalid Email Format" };

  const lenChecks = [
    { v: company, max: MAX_LEN.company, label: "Company Name" },
    { v: name, max: MAX_LEN.name, label: "Contact Person" },
    { v: canonical.location, max: MAX_LEN.location, label: "City" },
    { v: canonical.state, max: MAX_LEN.state, label: "State" },
    { v: canonical.category, max: MAX_LEN.category, label: "Category" },
  ];
  for (const c of lenChecks) {
    if (c.v && c.v.length > c.max) {
      return { ok: false, reason: `${c.label} exceeds ${c.max} characters` };
    }
  }

  let category = canonical.category || null;
  if (category) category = category.charAt(0).toUpperCase() + category.slice(1).toLowerCase();

  const datatype = DATATYPE_ALIASES[(canonical.datatype || "").toLowerCase()] || "Other";
  const location = canonical.location || null;
  const state = canonical.state || null;

  const lead = {
    name,
    company,
    email: email || null,
    phone,
    contact: (canonical.contact || "").replace(/\s+/g, "") || null,
    location,
    state,
    category,
    quantity: Number(canonical.quantity) || 0,
    requirements: canonical.requirements || "",
    remarks: canonical.remarks || "",
    datatype,
    callStatus: "Not Called",
    followUpDate: parseDate(canonical["follow up date"]) || null,
    assignedTo: [],
    status: "New Lead",
    billingAddress: { street: canonical.address || "", state: state || "" },
    inquiryDate: new Date().toISOString(),
    fileName,
  };
  return { ok: true, lead };
};

module.exports = {
  HEADER_ALIASES,
  REQUIRED_FIELDS,
  MAX_LEN,
  PHONE_REGEX,
  EMAIL_REGEX,
  cleanInput,
  normalizePhone,
  parseDate,
  buildHeaderMap,
  canonicalizeRow,
  isBlankRow,
  validateRow,
};
