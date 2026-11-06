const mongoose = require('mongoose');
const schema = new mongoose.Schema({
  key: { type: String, unique: true, default: 'admin' },
  pinHash: { type: String, required: true },
  updatedAt: { type: Date, default: Date.now },
});
module.exports = mongoose.model('CareerSettings', schema);
