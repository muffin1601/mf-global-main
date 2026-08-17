// Duplicate vendor detection.
//
// Two tiers:
//   * BLOCKING  — GSTIN and PAN are legally unique per business. A second
//                 vendor carrying the same one is always a data error.
//   * WARNING   — name / email / phone matches are strong signals but have
//                 legitimate exceptions (two branches of a group, a shared
//                 reception number). These are surfaced for the user to review
//                 and can be overridden with `confirmDuplicate: true`.
//
// Matching runs on the normalized shadow fields, so case, surrounding
// whitespace, punctuation and legal suffixes are all ignored:
//   "ABC Pvt Ltd" / "abc pvt ltd" / "  ABC PVT LTD " -> the same key.

const Vendor = require('../models/VendorData');
const {
  normalizeCompanyName,
  normalizeCode,
  normalizeEmail,
  normalizePhone,
} = require('./vendorFields');

const BLOCKING_FIELDS = ['gstin', 'pan'];

const LABELS = {
  gstin: 'GSTIN',
  pan: 'PAN',
  name: 'vendor name',
  email: 'email address',
  phone: 'phone number',
};

/**
 * Find vendors that may already represent this business.
 *
 * @param {object} candidate           { name, gstin, pan, email, phone }
 * @param {string|null} excludeId      vendor _id to ignore (when editing)
 * @returns {Promise<{blocking: object[], warnings: object[]}>}
 */
const findPotentialDuplicates = async (candidate = {}, excludeId = null) => {
  const keys = {
    nameNorm: normalizeCompanyName(candidate.name),
    gstinNorm: normalizeCode(candidate.gstin),
    panNorm: normalizeCode(candidate.pan),
    emailNorm: normalizeEmail(candidate.email),
    phoneNorm: normalizePhone(candidate.phone),
  };

  const or = Object.entries(keys)
    .filter(([, value]) => value)
    .map(([field, value]) => ({ [field]: value }));

  if (!or.length) return { blocking: [], warnings: [] };

  const query = { $or: or };
  if (excludeId) query._id = { $ne: excludeId };

  // Archived vendors still count: re-creating an archived supplier should
  // prompt a restore, not a silent second record.
  const matches = await Vendor.find(query)
    .select('_id v_code name legalName status isArchived nameNorm gstinNorm panNorm emailNorm phoneNorm')
    .limit(10)
    .lean();

  const blocking = [];
  const warnings = [];

  for (const match of matches) {
    const matchedOn = Object.entries(keys)
      .filter(([field, value]) => value && match[field] === value)
      .map(([field]) => field.replace('Norm', ''));

    if (!matchedOn.length) continue;

    const entry = {
      _id: match._id,
      v_code: match.v_code,
      name: match.name,
      legalName: match.legalName,
      status: match.status,
      isArchived: match.isArchived,
      matchedOn,
      reason: `Matches an existing vendor on ${matchedOn.map((f) => LABELS[f] || f).join(' and ')}`,
    };

    if (matchedOn.some((f) => BLOCKING_FIELDS.includes(f))) blocking.push(entry);
    else warnings.push(entry);
  }

  return { blocking, warnings };
};

module.exports = { findPotentialDuplicates, BLOCKING_FIELDS, LABELS };
