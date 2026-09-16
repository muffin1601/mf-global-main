const mongoose = require('mongoose');
const { generateProductCode } = require('../services/productCode');

const priceSchema = new mongoose.Schema({
  price_code: { type: String, unique: true },
  purchase_price: Number,
  sales_5_50: Number,
  sales_50_100: Number,
  sales_100_above: Number,
  GST_rate: { type: Number, min: 0 },
  basic_amount: Number,
  net_amount: Number,
}, { _id: false });

const productSchema = new mongoose.Schema({
  p_code: { type: String, unique: true, sparse: true, immutable: true },
  s_code: String,
  p_name: String,
  cat_id: String,
  p_image: String,
  p_description: String,
  p_type: String,
  p_color: String,
  HSN_code: String,
  GST_rate: Number,
  p_price: priceSchema,


  dimension: {
    type: String,
    default: "",   
  },

}, { timestamps: true });

// Supports the product catalogue's common list filters and sort order.
productSchema.index({ cat_id: 1, updatedAt: -1 });
productSchema.index({ p_name: 1 });

productSchema.pre('save', async function (next) {
  if (this.isNew) {
    if (!this.p_code && this.cat_id) {
      this.p_code = await generateProductCode(this.cat_id);
    }

    if (this.p_price && !this.p_price.price_code) {
      const regex = /^RS(\d+)$/;
      const lastProductWithPrice = await mongoose.model('Product')
        .find({ 'p_price.price_code': regex })
        .sort({ 'p_price.price_code': -1 })
        .limit(1);

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
