const mongoose = require('mongoose');
const { DOCUMENT_TYPES } = require('../utils/vendorFields');

/* Vendor compliance / contractual documents.
 *
 * `storedName` is the on-disk filename inside backend/uploads/vendors — it is
 * randomised and never derived from user input, and the file is served only
 * through the authenticated download route (never from the public /uploads
 * static mount), so documents are not guessable or publicly reachable. */
const vendorDocumentSchema = new mongoose.Schema({
  vendor: { type: mongoose.Schema.Types.ObjectId, ref: 'Vendor', required: true },

  name: { type: String, required: true, trim: true, maxlength: 200 },
  documentType: { type: String, enum: DOCUMENT_TYPES, default: 'Other' },
  description: { type: String, trim: true, maxlength: 1000, default: '' },

  storedName: { type: String, required: true },
  originalName: { type: String, required: true },
  mimeType: { type: String, default: '' },
  sizeBytes: { type: Number, default: 0 },

  issueDate: { type: Date, default: null },
  expiryDate: { type: Date, default: null },

  status: { type: String, enum: ['Active', 'Archived'], default: 'Active' },

  uploadedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
  uploadedByName: { type: String, default: '' },
}, { timestamps: true });

// Documents tab for one vendor, newest first.
vendorDocumentSchema.index({ vendor: 1, status: 1, createdAt: -1 });
// "Vendors with expiring documents" dashboard metric.
vendorDocumentSchema.index({ expiryDate: 1, status: 1 });

module.exports = mongoose.model('VendorDocument', vendorDocumentSchema);
