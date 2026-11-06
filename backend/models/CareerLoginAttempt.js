const mongoose = require('mongoose');
const schema = new mongoose.Schema({
  ipHash: { type: String, required: true, unique: true },
  failures: { type: Number, default: 0 },
  lockedUntil: Date,
  updatedAt: { type: Date, default: Date.now, index: { expires: 86400 } },
});
module.exports = mongoose.model('CareerLoginAttempt', schema);
