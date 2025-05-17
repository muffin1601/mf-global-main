const mongoose = require('mongoose');

const TaskSchema = new mongoose.Schema({
  title: String,
  description: String,
  status: { type: String, enum: ['done', 'pending', 'not_started'], default: 'not_started' }
});

module.exports = mongoose.model('Task', TaskSchema);

