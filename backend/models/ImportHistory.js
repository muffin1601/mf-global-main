const mongoose = require("mongoose");

// One row of the downloadable import report.
const reportRowSchema = new mongoose.Schema(
  {
    rowNumber: { type: Number },
    company: { type: String },
    status: { type: String }, // "Imported" | "Skipped" | "Duplicate"
    reason: { type: String, default: "" },
    leadId: { type: mongoose.Schema.Types.ObjectId, ref: "ClientData", default: null },
  },
  { _id: false }
);

// Audit record for every CSV lead import. One document per import job.
const importHistorySchema = new mongoose.Schema(
  {
    // Who ran the import (User.userId string + display fields, mirroring the
    // existing UserActivity convention).
    userId: { type: String, index: true },
    userName: { type: String },
    role: { type: String },

    fileName: { type: String },

    totalRows: { type: Number, default: 0 },
    imported: { type: Number, default: 0 },
    skipped: { type: Number, default: 0 },
    duplicates: { type: Number, default: 0 },
    errors: { type: Number, default: 0 },

    // "in_progress" while batches are still being committed; "completed" when
    // the last batch finishes; "failed" on a fatal error.
    status: { type: String, default: "in_progress" },

    // If an admin assigned the imported leads to a user during import.
    assignedToName: { type: String, default: null },

    // Full per-row report (capped at REPORT_ROW_CAP rows). Powers the CSV
    // download. Truncated reports set reportTruncated = true.
    report: { type: [reportRowSchema], default: [] },
    reportTruncated: { type: Boolean, default: false },
  },
  { timestamps: true }
);

importHistorySchema.index({ createdAt: -1 });
importHistorySchema.index({ userId: 1, createdAt: -1 });

module.exports = mongoose.model("ImportHistory", importHistorySchema);
