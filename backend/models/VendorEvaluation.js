const mongoose = require('mongoose');

// One periodic performance evaluation of a vendor. Every criterion is scored
// 1–5. The vendor's rolled-up `performance` block is recomputed from these
// records — it is never invented, so a vendor with no evaluations reports
// `overallScore: null` ("No data") rather than a fabricated number.
const scoreField = { type: Number, min: 1, max: 5, required: true };

const vendorEvaluationSchema = new mongoose.Schema({
  vendor: { type: mongoose.Schema.Types.ObjectId, ref: 'Vendor', required: true },

  quality: scoreField,
  delivery: scoreField,
  leadTime: scoreField,
  pricing: scoreField,
  responsiveness: scoreField,
  compliance: scoreField,

  // Unweighted mean of the six criteria, computed on save (never client-supplied).
  overallScore: { type: Number, min: 1, max: 5 },

  evaluationDate: { type: Date, default: () => new Date() },
  periodLabel: { type: String, trim: true, maxlength: 60, default: '' },
  comments: { type: String, trim: true, maxlength: 2000, default: '' },

  evaluatedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
  evaluatedByName: { type: String, default: '' },
}, { timestamps: true });

vendorEvaluationSchema.index({ vendor: 1, evaluationDate: -1 });

const CRITERIA = ['quality', 'delivery', 'leadTime', 'pricing', 'responsiveness', 'compliance'];

vendorEvaluationSchema.pre('validate', function (next) {
  const values = CRITERIA.map((k) => this[k]).filter((v) => typeof v === 'number');
  if (values.length === CRITERIA.length) {
    this.overallScore = Math.round((values.reduce((a, b) => a + b, 0) / values.length) * 100) / 100;
  }
  next();
});

module.exports = mongoose.model('VendorEvaluation', vendorEvaluationSchema);
module.exports.CRITERIA = CRITERIA;
