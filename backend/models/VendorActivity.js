const mongoose = require('mongoose');
const { ACTIVITY_TYPES } = require('../utils/vendorFields');

// Notes, calls, emails, meetings, follow-ups, tasks and reminders logged
// against a vendor. Renders as the chronological timeline on the vendor
// profile. Distinct from the system-wide ActivityLog (UserActivity), which is
// the immutable audit trail — this one is user-authored content.
const vendorActivitySchema = new mongoose.Schema({
  vendor: { type: mongoose.Schema.Types.ObjectId, ref: 'Vendor', required: true },

  activityType: { type: String, enum: ACTIVITY_TYPES, default: 'Note' },
  subject: { type: String, trim: true, maxlength: 200, default: '' },
  body: { type: String, required: true, trim: true, maxlength: 5000 },

  // Set for Follow-up / Task / Reminder types.
  dueDate: { type: Date, default: null },
  completedAt: { type: Date, default: null },

  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
  createdByName: { type: String, default: '' },
}, { timestamps: true });

// Timeline query for one vendor.
vendorActivitySchema.index({ vendor: 1, createdAt: -1 });
// "Open follow-ups / tasks" queries.
vendorActivitySchema.index({ dueDate: 1, completedAt: 1 });

module.exports = mongoose.model('VendorActivity', vendorActivitySchema);
