const mongoose = require('mongoose');

const SalesSchema = new mongoose.Schema({
  name: String,
  deals: Number,
  leads: Number,
  rate: Number,
  change: { type: String, enum: ['up', 'down', 'neutral'], default: 'neutral' }
});

module.exports = mongoose.model('Sales', SalesSchema);
