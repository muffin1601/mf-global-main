const mongoose = require('mongoose');

const schema = new mongoose.Schema({
  jobId: { type: mongoose.Schema.Types.ObjectId, ref: 'CareerJob', required: true, index: true },
  jobTitle: { type: String, required: true },
  department: { type: String, required: true },
  fullName: { type: String, required: true, maxlength: 120 },
  email: { type: String, required: true, maxlength: 254 },
  phone: { type: String, required: true, maxlength: 30 },
  location: { type: String, required: true, maxlength: 120 },
  experience: { type: String, required: true, maxlength: 80 },
  currentCompany: { type: String, maxlength: 120, default: '' },
  designation: { type: String, maxlength: 120, default: '' },
  expectedSalary: { type: String, maxlength: 100, default: '' },
  noticePeriod: { type: String, required: true, maxlength: 100 },
  resume: { data: Buffer, contentType: String, filename: String },
  coverLetter: { type: String, maxlength: 3000, default: '' },
  comments: { type: String, maxlength: 3000, default: '' },
  consent: { type: Boolean, required: true },
  status: { type: String, enum: ['New', 'Under Review', 'Shortlisted', 'Interview Scheduled', 'Selected', 'Rejected', 'Hired'], default: 'New' },
  adminNotes: { type: String, maxlength: 5000, default: '' },
  submissionKey: { type: String, unique: true, sparse: true },
}, { timestamps: true, toJSON: { transform: (_doc, obj) => { delete obj.resume; delete obj.submissionKey; return obj; } } });
schema.index({ createdAt: -1 });
schema.index({ status: 1, createdAt: -1 });
module.exports = mongoose.model('CareerApplication', schema);
