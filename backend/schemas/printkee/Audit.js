const mongoose = require('mongoose');

const AuditSchema = new mongoose.Schema(
  {
    createdBy: { type: String, default: null },
    updatedBy: { type: String, default: null }
  },
  { _id: false }
);

module.exports = AuditSchema;
