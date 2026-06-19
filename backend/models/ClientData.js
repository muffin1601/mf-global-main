const mongoose = require("mongoose");
const { NORMALIZED_FIELDS, lcKey, toLc, computeLcFields } = require("../utils/normalizeFields");

const additionalContactSchema = new mongoose.Schema({
  name: { type: String },
  contact: { type: String },
  details: { type: String },
}, { _id: false });

const addressSchema = new mongoose.Schema({
  street: { type: String },
  city: { type: String },
  state: { type: String },
  postalCode: { type: String },
  country: { type: String },
}, { _id: false });

const clientSchema = new mongoose.Schema(
  {
    name: { type: String },
    company: { type: String },
    email: { type: String },
    countryCode: { type: String },
    phone: { type: String },
    contact: { type: String },
    location: { type: String },
    state: { type: String },
    category: { type: String },
    quantity: { type: Number },
    requirements: { type: String },
    remarks: { type: String },
    datatype: { type: String },
    callStatus: { type: String, default: "Not Called" },
    followUpDate: { type: Date, default: null },

    assignedTo: [
      {
        user: {
          _id: { type: mongoose.Schema.Types.ObjectId, required: true },
          name: { type: String, required: true },
        },
        permissions: {
          view: { type: Boolean, default: false },
          update: { type: Boolean, default: false },
          delete: { type: Boolean, default: false },
        },
      },
    ],

    status: { type: String, default: "New Lead" },
    followUpDateOne: { type: Date, default: null },
    followUpDateTwo: { type: Date, default: null },
    followUpDateThree: { type: Date, default: null },
    callingdate: { type: Date, default: null },
    inquiryDate: { type: String },
    address: { type: String },
    fileName: { type: String, default: null },

    
    billingAddress: {
      type: addressSchema,
      default: null,
    },
    shippingAddress: {
      type: addressSchema,
      default: null,
    },

    additionalContacts: [additionalContactSchema],

    // --- Normalized lowercase shadow fields (auto-maintained, see hooks) ---
    // Used for index-backed case-insensitive equality filtering.
    category_lc: { type: String },
    location_lc: { type: String },
    state_lc: { type: String },
    datatype_lc: { type: String },
    callStatus_lc: { type: String },
    status_lc: { type: String },
    fileName_lc: { type: String },

    // Auto-maintained denormalized flag: true when assignedTo has entries.
    // Lets assigned/unassigned queries use a plain index instead of scanning
    // the assignedTo array ($exists / $size / $elemMatch).
    isAssigned: { type: Boolean, default: false },
  },
  { timestamps: true }
);

const computeIsAssigned = (arr) => Array.isArray(arr) && arr.length > 0;

// --- Keep _lc fields in sync automatically ---
// Document saves (new docs, .save()).
clientSchema.pre("save", function (next) {
  for (const field of NORMALIZED_FIELDS) {
    if (this.isModified(field) || this.isNew) {
      this[lcKey(field)] = toLc(this[field]);
    }
  }
  if (this.isModified("assignedTo") || this.isNew) {
    this.isAssigned = computeIsAssigned(this.assignedTo);
  }
  next();
});

// Update queries (findOneAndUpdate / updateOne / updateMany).
function syncLcOnUpdate(next) {
  const update = this.getUpdate() || {};
  const setBlock = update.$set || update;
  const lc = computeLcFields(setBlock);
  // If assignedTo is being fully set (an array), keep isAssigned in sync.
  const extra = { ...lc };
  if (Object.prototype.hasOwnProperty.call(setBlock, "assignedTo")) {
    extra.isAssigned = computeIsAssigned(setBlock.assignedTo);
  }
  if (Object.keys(extra).length) {
    if (update.$set) update.$set = { ...update.$set, ...extra };
    else Object.assign(update, extra);
    this.setUpdate(update);
  }
  next();
}
clientSchema.pre("findOneAndUpdate", syncLcOnUpdate);
clientSchema.pre("updateOne", syncLcOnUpdate);
clientSchema.pre("updateMany", syncLcOnUpdate);

// Bulk inserts (e.g. CSV import) bypass document save hooks — sync here too.
clientSchema.pre("insertMany", function (next, docs) {
  if (Array.isArray(docs)) {
    for (const doc of docs) {
      Object.assign(doc, computeLcFields(doc));
      doc.isAssigned = computeIsAssigned(doc.assignedTo);
    }
  }
  next();
});

// --- P0 performance indexes (no schema/field changes) ---
// KPI counts, converted/trending lists, new-leads recency.
clientSchema.index({ status: 1, createdAt: -1 });
// Per-user dashboards, assigned filter, sales-performance aggregation.
clientSchema.index({ "assignedTo.user.name": 1, status: 1 });
// Follow-up reminder buckets (today / upcoming) per user.
clientSchema.index({ "assignedTo.user.name": 1, followUpDate: 1 });
// Duplicate detection + cron upserts (phone / contact lookups).
clientSchema.index({ phone: 1 });
clientSchema.index({ contact: 1 });
// Global recency sort / new-clients window.
clientSchema.index({ createdAt: -1 });

// --- Indexes for normalized lowercase filter fields (index-backed $in) ---
clientSchema.index({ category_lc: 1 });
clientSchema.index({ location_lc: 1 });
clientSchema.index({ state_lc: 1 });
clientSchema.index({ datatype_lc: 1 });
clientSchema.index({ callStatus_lc: 1 });
clientSchema.index({ status_lc: 1 });
clientSchema.index({ fileName_lc: 1 });

// Assigned / unassigned filtering — replaces assignedTo array scans.
clientSchema.index({ isAssigned: 1 });

module.exports = mongoose.model("ClientData", clientSchema);
