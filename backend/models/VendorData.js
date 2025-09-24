const mongoose = require('mongoose');

const vendorSchema = new mongoose.Schema({
  v_code: {
    type: String,
    unique: true
  },
  name: {
    type: String,
    
  },
  contact_name: String,
  phone: String,
  type: {
    type: String,
    
  },
  cat_id: String,
  products: [String],
  addr1: String,
  addr2: String,
  city: String,
  state: String,
  pin_code: String,
  email: String
});

// Auto-generate v_code before saving
vendorSchema.pre('save', async function (next) {
  if (this.v_code || !this.name) return next();

  const firstLetter = this.name[0].toUpperCase();
  const regex = new RegExp(`^V${firstLetter}(\\d+)$`);

  const lastVendor = await this.constructor.findOne({ v_code: regex })
    .sort({ v_code: -1 });

  let nextNumber = 1;
  if (lastVendor && lastVendor.v_code) {
    const match = lastVendor.v_code.match(/\d+$/);
    if (match) {
      nextNumber = parseInt(match[0], 10) + 1;
    }
  }

  const paddedNumber = String(nextNumber).padStart(3, '0');
  this.v_code = `V${firstLetter}${paddedNumber}`;

  next();
});

const Vendor = mongoose.model('Vendor', vendorSchema);
module.exports = Vendor;
