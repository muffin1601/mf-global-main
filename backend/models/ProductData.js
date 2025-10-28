const mongoose = require('mongoose');

const priceSchema = new mongoose.Schema({
  price_code: {
    type: String,
    unique: true,
  },
  purchase_price: {
    type: Number,
  },
  sales_5_50: Number,
  sales_50_100: Number,
  sales_100_above: Number,
  GST_rate: {
    type: Number,
    min: 0,
  },
  basic_amount: {
    type: Number,
  },
  net_amount: {
    type: Number,
  },
}, { _id: false }); 


const productSchema = new mongoose.Schema({
  p_code: {
    type: String,
  },
  s_code: {
    type: String,
  },
  p_name: {
    type: String,
  },
  cat_id: String,
  p_image: String,
  p_description: String,
  p_type: String,
  p_color: String,
  HSN_code: String,
  GST_rate: Number,
  p_price: priceSchema,
}, { timestamps: true }); 


productSchema.pre('save', async function (next) {
  if (this.isNew) {

    if (!this.p_code) {
      const prefix = "MF";
      const regex = new RegExp(`^${prefix}(\\d+)$`);

     
      const lastProduct = await mongoose.model('Product')
        .find({ p_code: { $regex: regex } })
        .sort({ p_code: -1 })
        .limit(1);

      let nextNum = 1;
      if (lastProduct.length && lastProduct[0].p_code) {
        const numPart = parseInt(lastProduct[0].p_code.replace(prefix, ''), 10);
        if (!isNaN(numPart)) nextNum = numPart + 1;
      }

      this.p_code = `${prefix}${String(nextNum).padStart(3, '0')}`;
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
