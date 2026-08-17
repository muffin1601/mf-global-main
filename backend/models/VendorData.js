const mongoose = require('mongoose');
const Counter = require('./Counter');
const {
  VENDOR_STATUSES,
  VENDOR_PRIORITIES,
  VENDOR_TYPES,
  ADDRESS_TYPES,
  CONTACT_TYPES,
  PAYMENT_METHODS,
  CURRENCIES,
  normalizeCompanyName,
  normalizeCode,
  normalizePhone,
  normalizeEmail,
  canonicalUrl,
  maskTail,
} = require('../utils/vendorFields');

/* --------------------------------------------------------------------------
 * Embedded sub-documents
 *
 * Contacts and addresses are embedded (not referenced): they are always read
 * with their vendor, are small and bounded, and have no independent lifecycle.
 * Products, pricing, documents, evaluations and activities ARE separate
 * collections — they grow unbounded and are queried on their own.
 * ------------------------------------------------------------------------ */

const vendorContactSchema = new mongoose.Schema({
  fullName: { type: String, required: true, trim: true, maxlength: 120 },
  designation: { type: String, trim: true, maxlength: 120, default: '' },
  department: { type: String, trim: true, maxlength: 120, default: '' },
  email: { type: String, trim: true, lowercase: true, default: '' },
  phone: { type: String, trim: true, default: '' },
  whatsapp: { type: String, trim: true, default: '' },
  altPhone: { type: String, trim: true, default: '' },
  contactType: { type: String, enum: CONTACT_TYPES, default: 'General' },
  isPrimary: { type: Boolean, default: false },
  notes: { type: String, trim: true, maxlength: 2000, default: '' },
  isActive: { type: Boolean, default: true },
}, { timestamps: true });

const vendorAddressSchema = new mongoose.Schema({
  addressType: { type: String, enum: ADDRESS_TYPES, default: 'Registered Office' },
  line1: { type: String, required: true, trim: true, maxlength: 200 },
  line2: { type: String, trim: true, maxlength: 200, default: '' },
  landmark: { type: String, trim: true, maxlength: 200, default: '' },
  city: { type: String, trim: true, maxlength: 100, default: '' },
  state: { type: String, trim: true, maxlength: 100, default: '' },
  country: { type: String, trim: true, maxlength: 100, default: 'India' },
  pincode: { type: String, trim: true, maxlength: 20, default: '' },
  isDefault: { type: Boolean, default: false },
}, { timestamps: true });

/* Banking / payment block.
 *
 * accountNumber carries `select: false` so it is EXCLUDED from every query
 * unless a route explicitly opts in. Lists, exports, audit entries and error
 * payloads therefore cannot leak it by accident. `accountNumberMasked` is
 * maintained automatically and is what the UI renders. */
const vendorBankSchema = new mongoose.Schema({
  bankName: { type: String, trim: true, maxlength: 150, default: '' },
  accountHolderName: { type: String, trim: true, maxlength: 150, default: '' },
  accountNumber: { type: String, trim: true, default: '', select: false },
  accountNumberMasked: { type: String, default: '' },
  ifsc: { type: String, trim: true, uppercase: true, default: '' },
  branch: { type: String, trim: true, maxlength: 150, default: '' },
  upi: { type: String, trim: true, default: '' },
  paymentTerms: { type: String, trim: true, maxlength: 200, default: '' },
  creditPeriodDays: { type: Number, min: 0, max: 3650, default: 0 },
  currency: { type: String, enum: CURRENCIES, default: 'INR' },
  preferredPaymentMethod: { type: String, enum: [...PAYMENT_METHODS, ''], default: '' },
}, { _id: false });

/* Denormalized performance rollup, recomputed from VendorEvaluation whenever an
 * evaluation is written. Keeping it on the vendor lets the list page sort and
 * filter on rating without an aggregation per row (avoids N+1). */
const vendorPerformanceSchema = new mongoose.Schema({
  evaluationCount: { type: Number, default: 0 },
  overallScore: { type: Number, default: null }, // null = never evaluated
  quality: { type: Number, default: null },
  delivery: { type: Number, default: null },
  leadTime: { type: Number, default: null },
  pricing: { type: Number, default: null },
  responsiveness: { type: Number, default: null },
  compliance: { type: Number, default: null },
  lastEvaluatedAt: { type: Date, default: null },
}, { _id: false });

const vendorSchema = new mongoose.Schema({
  /* --- Legacy fields (kept for backward compatibility with the original
     vendor list / product module; still populated and still readable). --- */
  v_code: { type: String, unique: true },
  name: { type: String, required: true, trim: true, maxlength: 200 },
  contact_name: { type: String, trim: true, default: '' },
  phone: { type: String, trim: true, default: '' },
  email: { type: String, trim: true, lowercase: true, default: '' },
  // No enum: the legacy vendor screen writes this field directly and existing
  // rows hold values that predate the vocabulary. The new module restricts the
  // choice in validateVendorPayload instead, so old data stays editable.
  type: { type: String, trim: true, maxlength: 100, default: '' },
  cat_id: { type: String, default: '' }, // legacy product-category id
  products: { type: [String], default: [] }, // legacy free-text product names
  addr1: { type: String, default: '' },
  addr2: { type: String, default: '' },
  city: { type: String, default: '' },
  state: { type: String, default: '' },
  pin_code: { type: String, default: '' },

  /* --- Enterprise master data --- */
  legalName: { type: String, trim: true, maxlength: 250, default: '' },
  category: { type: mongoose.Schema.Types.ObjectId, ref: 'VendorCategory', default: null },
  status: { type: String, enum: VENDOR_STATUSES, default: 'Pending' },
  priority: { type: String, enum: VENDOR_PRIORITIES, default: 'Medium' },
  website: { type: String, trim: true, default: '' },
  gstin: { type: String, trim: true, uppercase: true, default: '' },
  pan: { type: String, trim: true, uppercase: true, default: '' },
  cin: { type: String, trim: true, uppercase: true, default: '' },
  taxRegistration: { type: String, trim: true, maxlength: 200, default: '' },
  industry: { type: String, trim: true, maxlength: 150, default: '' },
  description: { type: String, trim: true, maxlength: 5000, default: '' },
  tags: { type: [String], default: [] },
  logo: { type: String, default: '' }, // relative /uploads path

  contacts: { type: [vendorContactSchema], default: [] },
  addresses: { type: [vendorAddressSchema], default: [] },
  bank: { type: vendorBankSchema, default: () => ({}) },
  performance: { type: vendorPerformanceSchema, default: () => ({}) },

  /* --- Ownership & lifecycle --- */
  owner: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
  updatedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
  isArchived: { type: Boolean, default: false },
  archivedAt: { type: Date, default: null },
  archivedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
  lastActivityAt: { type: Date, default: null },

  /* --- Normalized shadow fields (auto-maintained; power duplicate detection
     and index-backed case-insensitive search). Never edited directly. --- */
  nameNorm: { type: String, default: '', index: true },
  gstinNorm: { type: String, default: '' },
  panNorm: { type: String, default: '' },
  emailNorm: { type: String, default: '' },
  phoneNorm: { type: String, default: '' },
}, { timestamps: true });

/* --------------------------------------------------------------------------
 * Indexes — deliberately minimal. Each one below backs a query the module
 * actually issues; no speculative indexes.
 * ------------------------------------------------------------------------ */
// Duplicate lookups + identifier search. Sparse partial indexes so the many
// vendors without a GSTIN/PAN don't all collide on "".
vendorSchema.index({ gstinNorm: 1 }, { partialFilterExpression: { gstinNorm: { $gt: '' } } });
vendorSchema.index({ panNorm: 1 }, { partialFilterExpression: { panNorm: { $gt: '' } } });
vendorSchema.index({ emailNorm: 1 }, { partialFilterExpression: { emailNorm: { $gt: '' } } });
vendorSchema.index({ phoneNorm: 1 }, { partialFilterExpression: { phoneNorm: { $gt: '' } } });
// Default list view: non-archived, filtered by status, newest first.
vendorSchema.index({ isArchived: 1, status: 1, createdAt: -1 });
// Category and owner facet filters (both always combined with isArchived).
vendorSchema.index({ isArchived: 1, category: 1 });
vendorSchema.index({ isArchived: 1, owner: 1 });
// NOTE: there is deliberately no `text` index here. The list endpoint searches
// with anchored/­escaped regexes (so it can match partial codes and phone
// fragments, which $text cannot), so a text index would never be used — it
// would only cost write throughput and a lengthy build on a large collection.
// MongoDB also permits just one text index per collection, so leaving it out
// keeps that slot free.

/* --------------------------------------------------------------------------
 * Hooks
 * ------------------------------------------------------------------------ */

// Keep the normalized shadow fields and the masked account number in sync.
const applyDerivedFields = function () {
  this.nameNorm = normalizeCompanyName(this.name);
  this.gstinNorm = normalizeCode(this.gstin);
  this.panNorm = normalizeCode(this.pan);
  this.emailNorm = normalizeEmail(this.email);
  this.phoneNorm = normalizePhone(this.phone);
  if (this.website) this.website = canonicalUrl(this.website);

  // Only recompute the mask when the real number is loaded/changed — otherwise
  // `select: false` leaves it undefined and we would blank an existing mask.
  if (this.bank && this.isModified('bank.accountNumber')) {
    this.bank.accountNumberMasked = maskTail(this.bank.accountNumber);
  }

  // Exactly one primary contact and one default address.
  if (Array.isArray(this.contacts) && this.contacts.length) {
    const primaries = this.contacts.filter((c) => c.isPrimary);
    if (primaries.length === 0) {
      this.contacts[0].isPrimary = true;
    } else if (primaries.length > 1) {
      // Keep the most recently flagged one; demote the rest.
      primaries.slice(0, -1).forEach((c) => { c.isPrimary = false; });
    }
  }
  if (Array.isArray(this.addresses) && this.addresses.length) {
    const defaults = this.addresses.filter((a) => a.isDefault);
    if (defaults.length === 0) {
      this.addresses[0].isDefault = true;
    } else if (defaults.length > 1) {
      defaults.slice(0, -1).forEach((a) => { a.isDefault = false; });
    }
  }
};

/* Auto-generate v_code (V + first letter + zero-padded sequence), preserving
 * the original scheme so legacy codes stay consistent.
 *
 * The sequence comes from an ATOMIC counter rather than a "find the highest
 * existing code" scan: two vendors created at the same moment (which is exactly
 * what a CSV import does) would otherwise both read the same maximum and derive
 * the same code, and one insert would die on the unique index.
 *
 * The counter is seeded once per prefix from any codes that already exist, so
 * vendors created before this change are never re-used. */
const nextVendorSequence = async (Model, firstLetter) => {
  const key = `vendor:${firstLetter}`;

  const existing = await Counter.findOne({ role: key }).lean();
  if (!existing) {
    // Seed from the highest code already in the collection for this prefix.
    const last = await Model.findOne({ v_code: new RegExp(`^V${firstLetter}(\\d+)$`) })
      .sort({ v_code: -1 })
      .select('v_code')
      .lean();
    const match = last?.v_code?.match(/\d+$/);
    const seed = match ? parseInt(match[0], 10) : 0;
    // $setOnInsert: if another worker seeded it first, theirs wins and this is
    // a no-op — the $inc below still hands out a unique value either way.
    await Counter.updateOne({ role: key }, { $setOnInsert: { seq: seed } }, { upsert: true });
  }

  const counter = await Counter.findOneAndUpdate(
    { role: key },
    { $inc: { seq: 1 } },
    { new: true, upsert: true }
  );
  return counter.seq;
};

vendorSchema.pre('save', async function (next) {
  try {
    applyDerivedFields.call(this);

    if (this.v_code || !this.name) return next();

    const firstLetter = /[A-Za-z]/.test(this.name[0]) ? this.name[0].toUpperCase() : 'X';
    const seq = await nextVendorSequence(this.constructor, firstLetter);

    this.v_code = `V${firstLetter}${String(seq).padStart(3, '0')}`;
    return next();
  } catch (err) {
    return next(err);
  }
});

// Never ship the raw account number over the wire, even if a route forgot to
// exclude it — toJSON is the last line of defence.
vendorSchema.set('toJSON', {
  transform: (doc, ret) => {
    if (ret.bank) delete ret.bank.accountNumber;
    return ret;
  },
});

const Vendor = mongoose.model('Vendor', vendorSchema);
module.exports = Vendor;
