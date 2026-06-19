// Shared normalization for case-insensitive equality filtering.
// Instead of querying with new RegExp("^value$","i") (which cannot use a plain
// index efficiently), we maintain a lowercase shadow field (e.g. category_lc)
// for each filterable field and query it with an exact $in — fully index-backed.

// Fields that are filtered by case-insensitive equality in /clients/filter etc.
const NORMALIZED_FIELDS = [
  "category",
  "location",
  "state",
  "datatype",
  "callStatus",
  "status",
  "fileName",
];

const lcKey = (field) => `${field}_lc`;

const toLc = (v) => (v == null ? v : String(v).trim().toLowerCase());

// Given a source object (a lead or an update $set), return the _lc shadow values
// for whichever normalized fields are present.
const computeLcFields = (source = {}) => {
  const out = {};
  for (const field of NORMALIZED_FIELDS) {
    if (Object.prototype.hasOwnProperty.call(source, field)) {
      out[lcKey(field)] = toLc(source[field]);
    }
  }
  return out;
};

module.exports = { NORMALIZED_FIELDS, lcKey, toLc, computeLcFields };
