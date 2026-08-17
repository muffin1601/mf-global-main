// CSV column mapping, row validation and export field definitions for the
// vendor import/export workflow.

const {
  VENDOR_STATUSES, VENDOR_PRIORITIES, VENDOR_TYPES,
  normalizeCode, isEmail, isPhone, isGstin, isPan, isUrl, isPincode, gstinMatchesPan,
} = require('./vendorFields');

// Human-friendly header spellings mapped onto internal field keys, so staff can
// upload the spreadsheet they already keep instead of reformatting it.
const HEADER_ALIASES = {
  name: ['vendor name', 'name', 'supplier name', 'company', 'company name', 'firm'],
  legalName: ['legal name', 'legal business name', 'registered name'],
  type: ['vendor type', 'type', 'supplier type'],
  categoryName: ['category', 'vendor category', 'segment'],
  status: ['status', 'vendor status'],
  priority: ['priority', 'vendor priority'],
  email: ['email', 'email address', 'e-mail', 'mail'],
  phone: ['phone', 'phone number', 'mobile', 'mobile number', 'contact number'],
  contact_name: ['contact person', 'contact name', 'primary contact', 'contact'],
  website: ['website', 'web site', 'url'],
  gstin: ['gstin', 'gst', 'gst number', 'gst no'],
  pan: ['pan', 'pan number', 'pan no'],
  cin: ['cin', 'cin number'],
  industry: ['industry', 'sector'],
  description: ['description', 'about', 'notes'],
  addr1: ['address', 'address line 1', 'address1', 'street'],
  addr2: ['address line 2', 'address2'],
  city: ['city', 'town'],
  state: ['state', 'region'],
  pin_code: ['pincode', 'pin code', 'postal code', 'zip', 'zip code'],
  tags: ['tags', 'labels'],
};

// Only the vendor name is genuinely required — everything else can be filled in
// later without blocking the import of a real supplier list.
const REQUIRED_FIELDS = ['name'];

const normalizeHeader = (h) => String(h || '').trim().toLowerCase().replace(/\s+/g, ' ');

// Best-effort automatic mapping of a file's headers onto internal fields.
// The user reviews and can override every choice before validation runs.
const suggestMapping = (headers = []) => {
  const mapping = {};
  const used = new Set();

  for (const header of headers) {
    const key = normalizeHeader(header);
    for (const [field, aliases] of Object.entries(HEADER_ALIASES)) {
      if (used.has(field)) continue;
      if (aliases.includes(key)) {
        mapping[header] = field;
        used.add(field);
        break;
      }
    }
    if (!(header in mapping)) mapping[header] = '';
  }

  return mapping;
};

const MAPPABLE_FIELDS = Object.keys(HEADER_ALIASES);

const missingRequired = (mapping = {}) => {
  const mapped = new Set(Object.values(mapping).filter(Boolean));
  return REQUIRED_FIELDS.filter((f) => !mapped.has(f));
};

// Turn one raw CSV row into a vendor-shaped object using the confirmed mapping.
const mapRow = (row = {}, mapping = {}) => {
  const out = {};
  for (const [header, field] of Object.entries(mapping)) {
    if (!field || !MAPPABLE_FIELDS.includes(field)) continue;
    const value = row[header];
    if (value === undefined || value === null) continue;
    out[field] = String(value).trim();
  }
  if (out.tags) {
    out.tags = out.tags.split(/[;,|]/).map((t) => t.trim()).filter(Boolean).slice(0, 25);
  }
  return out;
};

// Per-row validation. Returns an array of human-readable problems; empty means
// the row is importable. Optional fields with a bad format are reported rather
// than silently dropped — no invalid record is skipped without an explanation.
const validateRow = (vendor = {}) => {
  const errors = [];

  if (!vendor.name) errors.push('Vendor name is missing');
  else if (vendor.name.length > 200) errors.push('Vendor name is longer than 200 characters');

  if (vendor.email && !isEmail(vendor.email)) errors.push(`Invalid email "${vendor.email}"`);
  if (vendor.phone && !isPhone(vendor.phone)) errors.push(`Invalid phone number "${vendor.phone}"`);
  if (vendor.website && !isUrl(vendor.website)) errors.push(`Invalid website "${vendor.website}"`);
  if (vendor.gstin && !isGstin(vendor.gstin)) errors.push(`Invalid GSTIN "${vendor.gstin}"`);
  if (vendor.pan && !isPan(vendor.pan)) errors.push(`Invalid PAN "${vendor.pan}"`);
  if (vendor.gstin && vendor.pan && isGstin(vendor.gstin) && isPan(vendor.pan)
    && !gstinMatchesPan(vendor.gstin, vendor.pan)) {
    errors.push('GSTIN does not match the PAN in the same row');
  }
  if (vendor.pin_code && !isPincode(vendor.pin_code)) errors.push(`Invalid PIN code "${vendor.pin_code}"`);

  if (vendor.status && !VENDOR_STATUSES.includes(vendor.status)) {
    errors.push(`Status must be one of: ${VENDOR_STATUSES.join(', ')}`);
  }
  if (vendor.priority && !VENDOR_PRIORITIES.includes(vendor.priority)) {
    errors.push(`Priority must be one of: ${VENDOR_PRIORITIES.join(', ')}`);
  }
  if (vendor.type && !VENDOR_TYPES.includes(vendor.type)) {
    errors.push(`Vendor type must be one of: ${VENDOR_TYPES.join(', ')}`);
  }

  return errors;
};

// Normalise the values that have a canonical stored form.
const canonicalizeRow = (vendor = {}) => {
  const out = { ...vendor };
  if (out.gstin) out.gstin = normalizeCode(out.gstin);
  if (out.pan) out.pan = normalizeCode(out.pan);
  if (out.cin) out.cin = normalizeCode(out.cin);
  if (out.email) out.email = out.email.toLowerCase();
  return out;
};

// --- Export -----------------------------------------------------------------
// Deliberately excludes every banking field: a vendor export is routinely
// mailed around, and account details must not travel with it.
const EXPORT_FIELDS = [
  { label: 'Vendor Code', value: 'v_code' },
  { label: 'Vendor Name', value: 'name' },
  { label: 'Legal Name', value: 'legalName' },
  { label: 'Type', value: 'type' },
  { label: 'Category', value: 'categoryName' },
  { label: 'Status', value: 'status' },
  { label: 'Priority', value: 'priority' },
  { label: 'Primary Contact', value: 'primaryContactName' },
  { label: 'Contact Designation', value: 'primaryContactDesignation' },
  { label: 'Phone', value: 'phone' },
  { label: 'Email', value: 'email' },
  { label: 'Website', value: 'website' },
  { label: 'GSTIN', value: 'gstin' },
  { label: 'PAN', value: 'pan' },
  { label: 'CIN', value: 'cin' },
  { label: 'Industry', value: 'industry' },
  { label: 'Address', value: 'addressLine' },
  { label: 'City', value: 'city' },
  { label: 'State', value: 'state' },
  { label: 'Pincode', value: 'pincode' },
  { label: 'Country', value: 'country' },
  { label: 'Tags', value: 'tagList' },
  { label: 'Owner', value: 'ownerName' },
  { label: 'Products Supplied', value: 'productCount' },
  { label: 'Performance Score', value: 'performanceScore' },
  { label: 'Performance Band', value: 'performanceBand' },
  { label: 'Archived', value: 'archived' },
  { label: 'Created Date', value: 'createdDate' },
];

// The header row of the downloadable import template.
const TEMPLATE_HEADERS = [
  'Vendor Name', 'Legal Name', 'Vendor Type', 'Category', 'Status', 'Priority',
  'Contact Person', 'Phone', 'Email', 'Website', 'GSTIN', 'PAN', 'CIN',
  'Industry', 'Address Line 1', 'Address Line 2', 'City', 'State', 'Pincode', 'Tags',
];

module.exports = {
  HEADER_ALIASES,
  REQUIRED_FIELDS,
  MAPPABLE_FIELDS,
  suggestMapping,
  missingRequired,
  mapRow,
  validateRow,
  canonicalizeRow,
  normalizeHeader,
  EXPORT_FIELDS,
  TEMPLATE_HEADERS,
};
