const mongoose = require('mongoose');
const { normalizeText } = require('../utils/vendorFields');

// Configurable vendor categories (master data). Deliberately NOT an enum on the
// vendor — the business adds/retires categories without a code change.
const vendorCategorySchema = new mongoose.Schema({
  code: { type: String, unique: true },
  name: { type: String, required: true, trim: true, maxlength: 120 },
  nameNorm: { type: String, default: '' },
  description: { type: String, trim: true, maxlength: 1000, default: '' },
  isActive: { type: Boolean, default: true },
  sortOrder: { type: Number, default: 0 },
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
}, { timestamps: true });

// Case-insensitive uniqueness: "Raw Materials" and "raw materials" are the
// same category. Enforced in the DB, not just in the route.
vendorCategorySchema.index({ nameNorm: 1 }, { unique: true });

// Auto-generate a stable code (VC + first letter + sequence), mirroring the
// existing Category / Vendor code conventions in this codebase.
vendorCategorySchema.pre('save', async function (next) {
  try {
    this.nameNorm = normalizeText(this.name);
    if (this.code || !this.name) return next();

    const firstLetter = /[A-Za-z]/.test(this.name[0]) ? this.name[0].toUpperCase() : 'X';
    const regex = new RegExp(`^VC${firstLetter}(\\d+)$`);
    const last = await this.constructor.findOne({ code: regex }).sort({ code: -1 }).select('code').lean();

    let nextNumber = 1;
    if (last && last.code) {
      const match = last.code.match(/\d+$/);
      if (match) nextNumber = parseInt(match[0], 10) + 1;
    }

    this.code = `VC${firstLetter}${String(nextNumber).padStart(3, '0')}`;
    return next();
  } catch (err) {
    return next(err);
  }
});

module.exports = mongoose.model('VendorCategory', vendorCategorySchema);
