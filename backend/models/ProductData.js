// models/Product.js

const mongoose = require('mongoose');

// Nested price schema
const priceSchema = new mongoose.Schema({
  price_code: {
    type: String,
    unique: true
  },
  single_price: {
    type: Number,
    required: true
  },
  sales_5_50: Number,
  sales_50_100: Number,
  sales_100_above: Number
}, { _id: false });

const productSchema = new mongoose.Schema({
  p_code: {
    type: String,
    unique: true
  },
  product_code: {
    type: String, },
  p_name: {
    type: String,
    required: true
  },
  cat_id: String,
  p_image: String,
  p_description: String,
  p_type: String,
  p_color: String,
  HSN_code: String,
  GST_rate: Number,
  p_price: priceSchema
});

// Pre-save hook to auto-generate p_code and price_code
productSchema.pre('save', async function (next) {
  if (this.isNew) {
    // Auto-generate p_code
    if (!this.p_code && this.p_name) {
      const firstLetter = this.p_name[0].toUpperCase();
      const regex = new RegExp(`^P${firstLetter}(\\d+)$`);
      
      const lastProduct = await mongoose.model('Product').find({ p_code: regex }).sort({ p_code: -1 }).limit(1);
      
      let nextNum = 1;
      if (lastProduct.length && lastProduct[0].p_code) {
        const numPart = parseInt(lastProduct[0].p_code.slice(2));
        if (!isNaN(numPart)) nextNum = numPart + 1;
      }
      this.p_code = `P${firstLetter}${String(nextNum).padStart(3, '0')}`;
    }

    // Auto-generate price_code
    if (this.p_price && !this.p_price.price_code) {
      const regex = /^RS(\d+)$/;
      const lastProductWithPrice = await mongoose.model('Product').find({ 'p_price.price_code': regex }).sort({ 'p_price.price_code': -1 }).limit(1);

      let nextPriceNum = 1;
      if (lastProductWithPrice.length && lastProductWithPrice[0].p_price.price_code) {
        const numPart = parseInt(lastProductWithPrice[0].p_price.price_code.slice(2));
        if (!isNaN(numPart)) nextPriceNum = numPart + 1;
      }
      this.p_price.price_code = `RS${String(nextPriceNum).padStart(3, '0')}`;
    }
  }

  next();
});

module.exports = mongoose.model('Product', productSchema);
