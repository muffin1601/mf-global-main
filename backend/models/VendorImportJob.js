const mongoose = require('mongoose');

// One row of the downloadable import report. Mirrors the shape the existing
// lead-import history uses so the two reports feel the same to users.
const reportRowSchema = new mongoose.Schema({
  rowNumber: { type: Number },
  vendorName: { type: String, default: '' },
  status: { type: String }, // "Imported" | "Duplicate" | "Error"
  reason: { type: String, default: '' },
  vendorId: { type: mongoose.Schema.Types.ObjectId, ref: 'Vendor', default: null },
}, { _id: false });

// Tracks a vendor CSV import across its upload -> map -> validate -> commit
// steps. The uploaded file stays on disk until the job completes or expires,
// so each step re-reads the same source rather than trusting the client to
// resend them.
const vendorImportJobSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', index: true },
  userName: { type: String, default: '' },

  fileName: { type: String, default: '' },
  storedName: { type: String, default: '' },
  headers: { type: [String], default: [] },
  mapping: { type: mongoose.Schema.Types.Mixed, default: {} },

  totalRows: { type: Number, default: 0 },
  imported: { type: Number, default: 0 },
  duplicates: { type: Number, default: 0 },
  // Named errorCount, not `errors`: `errors` is a reserved Mongoose document
  // path and shadowing it breaks validation error reporting on the model.
  errorCount: { type: Number, default: 0 },

  // uploaded -> validated -> completed | failed
  status: { type: String, default: 'uploaded' },

  report: { type: [reportRowSchema], default: [] },
  reportTruncated: { type: Boolean, default: false },
}, { timestamps: true });

vendorImportJobSchema.index({ createdAt: -1 });

module.exports = mongoose.model('VendorImportJob', vendorImportJobSchema);
