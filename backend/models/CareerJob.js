const mongoose = require('mongoose');

const schema = new mongoose.Schema({
  title: { type: String, required: true, trim: true, maxlength: 160 },
  department: { type: String, required: true, trim: true, maxlength: 100 },
  location: { type: String, required: true, trim: true, maxlength: 120 },
  employmentType: { type: String, required: true, enum: ['Full-time', 'Part-time', 'Contract', 'Internship'] },
  workMode: { type: String, required: true, enum: ['On-site', 'Remote', 'Hybrid'] },
  experience: { type: String, required: true, maxlength: 100 },
  salaryRange: { type: String, maxlength: 100, default: '' },
  vacancies: { type: Number, min: 1, max: 10000, required: true },
  displayOrder: { type: Number, min: 1, max: 10000, default: 1000 },
  description: { type: String, required: true, maxlength: 20000 },
  responsibilities: { type: String, required: true, maxlength: 10000 },
  qualifications: { type: String, required: true, maxlength: 10000 },
  skills: { type: String, required: true, maxlength: 10000 },
  benefits: { type: String, maxlength: 10000, default: '' },
  opensAt: { type: Date },
  deadline: { type: Date, required: true },
  status: { type: String, enum: ['Active', 'Closed', 'Draft'], default: 'Draft' },
  isPublished: { type: Boolean, default: false },
  publishedAt: Date,
  archivedAt: Date,
}, { timestamps: true });
schema.index({ status: 1, isPublished: 1, deadline: 1 });
schema.index({ createdAt: -1 });
module.exports = mongoose.model('CareerJob', schema);
