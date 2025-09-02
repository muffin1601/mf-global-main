const mongoose = require("mongoose");

const visitorSchema = new mongoose.Schema({
  date: { type: String, unique: true },
  count: { type: Number, default: 0 },
  visitors: [
    {
      ip: String,
      city: String,
      region: String,
      device: String,
      timestamp: { type: Date, default: Date.now },
    },
  ],
});

module.exports = mongoose.model("Visitor", visitorSchema);
