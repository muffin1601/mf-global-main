// Shared plumbing for the vendor routes: consistent responses, safe error
// translation, audit logging, id validation and the performance rollup.

const mongoose = require('mongoose');
const ActivityLog = require('../models/UserActivity');
const VendorEvaluation = require('../models/VendorEvaluation');
const Vendor = require('../models/VendorData');

// --- Responses --------------------------------------------------------------
// Every vendor endpoint answers with the same envelope so the frontend has one
// success path and one error path.
const ok = (res, data = {}, status = 200) => res.status(status).json({ success: true, ...data });

const fail = (res, status, message, extra = {}) =>
  res.status(status).json({ success: false, message, ...extra });

// --- Ids --------------------------------------------------------------------
const isValidId = (id) => mongoose.Types.ObjectId.isValid(String(id || ''));

// Coerce a client-supplied value to an ObjectId, or null. Never trust the raw
// value in a query: an object like {"$ne": null} must not reach Mongo.
const toObjectId = (id) => (isValidId(id) ? new mongoose.Types.ObjectId(String(id)) : null);

// --- Errors -----------------------------------------------------------------
// Translate Mongoose/Mongo failures into human-readable messages. Raw
// validator text, stack traces and driver internals never reach the client.
const FRIENDLY_FIELDS = {
  name: 'Vendor name',
  v_code: 'Vendor code',
  gstin: 'GSTIN',
  pan: 'PAN',
  email: 'Email',
  nameNorm: 'Vendor name',
  purchasePrice: 'Purchase price',
  fullName: 'Contact name',
  line1: 'Address line 1',
  body: 'Content',
};

const friendly = (path) => FRIENDLY_FIELDS[path] || path.split('.').pop();

const handleError = (res, err, context) => {
  // Log server-side with context, but strip anything that could carry banking
  // data (req bodies are never logged here).
  console.error(`[vendor] ${context}:`, err && err.message ? err.message : err);

  if (err && err.name === 'ValidationError') {
    const errors = Object.values(err.errors || {}).map((e) => {
      if (e.kind === 'required') return `${friendly(e.path)} is required`;
      if (e.kind === 'enum') return `${friendly(e.path)} has an unsupported value`;
      if (e.kind === 'maxlength') return `${friendly(e.path)} is too long`;
      if (e.kind === 'min' || e.kind === 'max') return `${friendly(e.path)} is out of range`;
      return `${friendly(e.path)} is invalid`;
    });
    return fail(res, 400, errors[0] || 'Some fields are invalid', { errors });
  }

  if (err && err.name === 'CastError') {
    return fail(res, 400, `${friendly(err.path || '')} is not a valid value`);
  }

  if (err && err.code === 11000) {
    const field = Object.keys(err.keyPattern || {})[0] || '';
    return fail(res, 409, `${friendly(field) || 'This record'} already exists`);
  }

  if (err && err.name === 'VersionError') {
    return fail(res, 409, 'This vendor was changed by someone else. Reload and try again.');
  }

  return fail(res, 500, 'Something went wrong. Please try again.');
};

// --- Audit ------------------------------------------------------------------
// Reuses the CRM's existing ActivityLog collection so vendor events show up in
// the same audit stream as the rest of the app.
//
// `details` is written verbatim, so callers must pass only non-sensitive
// summaries — the SENSITIVE_KEYS scrub below is a second safety net that drops
// banking values should one ever be threaded through by mistake.
const SENSITIVE_KEYS = /account(number)?|ifsc|upi|password|token|cvv/i;

const scrub = (value) => {
  if (!value || typeof value !== 'object') return value;
  if (Array.isArray(value)) return value.map(scrub);
  const out = {};
  for (const [k, v] of Object.entries(value)) {
    if (SENSITIVE_KEYS.test(k)) {
      out[k] = '[redacted]';
    } else {
      out[k] = scrub(v);
    }
  }
  return out;
};

const logVendorAudit = async (req, action, details = {}) => {
  try {
    await ActivityLog.create({
      userId: req.user?.userId || String(req.user?._id || ''),
      name: req.user?.name || req.user?.username || '',
      role: req.user?.role || '',
      action,
      timestamp: new Date(),
      // vendorId is stored as a string so the per-vendor audit query can match
      // it with a plain equality test (details is a Mixed path — an ObjectId
      // stored here would never compare equal to the id from req.params).
      details: scrub({
        module: 'vendor',
        ...details,
        ...(details.vendorId ? { vendorId: String(details.vendorId) } : {}),
      }),
    });
  } catch (err) {
    // Audit must never break the user-facing operation.
    console.error('[vendor] audit write failed:', err.message);
  }
};

// Build a compact "what changed" summary for update audits — field names and
// before/after values only for fields that actually changed, never the whole
// document (which would bloat the log and could carry sensitive data).
const diffSummary = (before, after, fields) => {
  const changes = {};
  for (const field of fields) {
    const a = before?.[field];
    const b = after?.[field];
    const same = JSON.stringify(a ?? null) === JSON.stringify(b ?? null);
    if (!same) changes[field] = { from: a ?? null, to: b ?? null };
  }
  return changes;
};

// --- Performance rollup -----------------------------------------------------
// Recompute a vendor's denormalized performance block from its evaluations.
// Called after any evaluation write/delete. One aggregation, no N+1.
const CRITERIA = ['quality', 'delivery', 'leadTime', 'pricing', 'responsiveness', 'compliance'];

const recomputeVendorPerformance = async (vendorId) => {
  const id = toObjectId(vendorId);
  if (!id) return null;

  const group = { _id: null, evaluationCount: { $sum: 1 }, overallScore: { $avg: '$overallScore' }, lastEvaluatedAt: { $max: '$evaluationDate' } };
  for (const c of CRITERIA) group[c] = { $avg: `$${c}` };

  const [agg] = await VendorEvaluation.aggregate([{ $match: { vendor: id } }, { $group: group }]);

  const round = (n) => (typeof n === 'number' ? Math.round(n * 100) / 100 : null);

  const performance = agg
    ? {
      evaluationCount: agg.evaluationCount,
      overallScore: round(agg.overallScore),
      lastEvaluatedAt: agg.lastEvaluatedAt || null,
      ...Object.fromEntries(CRITERIA.map((c) => [c, round(agg[c])])),
    }
    : {
      evaluationCount: 0,
      overallScore: null,
      lastEvaluatedAt: null,
      ...Object.fromEntries(CRITERIA.map((c) => [c, null])),
    };

  await Vendor.updateOne({ _id: id }, { $set: { performance } });
  return performance;
};

// Map a 1–5 score onto the rating bands the UI shows. `null` stays "No data" —
// an unevaluated vendor is never presented as if it had been rated.
const performanceBand = (score) => {
  if (score == null) return 'No data';
  if (score < 2) return 'Poor';
  if (score < 3) return 'Average';
  if (score < 4) return 'Good';
  return 'Excellent';
};

// --- Mass-assignment protection --------------------------------------------
// Copy only the allowed keys from a client payload. Fields such as _id,
// v_code, createdBy, performance and isArchived can therefore never be set by
// a crafted request body.
const pick = (source = {}, allowed = []) => {
  const out = {};
  for (const key of allowed) {
    if (Object.prototype.hasOwnProperty.call(source, key)) out[key] = source[key];
  }
  return out;
};

// Escape a user-supplied string before it is used inside a RegExp, so search
// input cannot inject regex metacharacters (ReDoS / unintended matches).
const escapeRegex = (v) => String(v || '').replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

module.exports = {
  ok,
  fail,
  isValidId,
  toObjectId,
  handleError,
  logVendorAudit,
  diffSummary,
  recomputeVendorPerformance,
  performanceBand,
  pick,
  escapeRegex,
  scrub,
  CRITERIA,
};
