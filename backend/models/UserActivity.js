const mongoose = require("mongoose");

const ActivityLogSchema = new mongoose.Schema({
  userId: String,
  name: String,
  role: String,
  action: String,
  timestamp: { type: Date, default: Date.now },
  details: mongoose.Schema.Types.Mixed,
});

module.exports = mongoose.model("ActivityLog", ActivityLogSchema);
