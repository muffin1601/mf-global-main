const mongoose = require('mongoose');
const slugify = require('slugify');

const priceSchema = new mongoose.Schema({
  price_code: { type: String, unique: true, sparse: true },
  purchase_price: Number,
  sales_5_50: Number,
  sales_50_100: Number,
  sales_100_above: Number,
  GST_rate: { type: Number, min: 0 },
  basic_amount: Number,
  net_amount: Number,
  price: Number,
  salePrice: { type: Number, default: null },
  currency: { type: String, default: 'INR' },
}, { _id: false });

const dimsSchema = new mongoose.Schema({
  length: Number,
  width: Number,
  height: Number,
  weight: Number,
  asString: { type: String, default: '' }
}, { _id: false });

const productSchema = new mongoose.Schema({
  p_code: { type: String, index: true },
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
  dimension: { type: String, default: "" },
  origin: {
    source: { type: String, enum: ["printkee", "coachingpromo", "crm"], default: "crm" },
    categoryId: String,
    subcategoryId: String,
    productId: String,
  },

  name: { type: String, trim: true },
  slug: { type: String, lowercase: true, sparse: true },

  description: {
    short: String,
    long: String
  },

  images: [{ url: String, altText: String }],
  subImages: [{ url: String, altText: String }],

  stock: { type: Number, default: 0 },
  SKU: { type: String, index: true, unique: true, sparse: true },
  sku: { type: String, index: true, sparse: true },

  attributes: {
    color: [String],
    size: [String],
    material: String
  },

  productCode: String,
  quantity: { type: Number, default: 0 },
  GSTRate: Number,
  brand: String,
  fabricType: String,
  size: [String],
  colour: [String],

  dimensions: dimsSchema,

  price: { type: Number, default: null },
  salePrice: { type: Number, default: null },

  tags: [String],
  keywords: [String],

  specifications: [{ key: String, value: String }],
  additionalInfo: [{ label: String, value: String }],

  metaTitle: String,
  metaDescription: String,

  isFeatured: { type: Boolean, default: false },
  isActive: { type: Boolean, default: true },
  isPublished: { type: Boolean, default: true },
  isDeleted: { type: Boolean, default: false },

  ratings: {
    average: { type: Number, default: 0 },
    count: { type: Number, default: 0 }
  },

  category: { type: mongoose.Schema.Types.ObjectId, ref: "Category", default: null },
  subcategory: { type: mongoose.Schema.Types.ObjectId, ref: "Subcategory", default: null },

  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
  updatedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },

}, { timestamps: true });

productSchema.virtual('name_from_pname')
  .get(function () {
    return this.name || this.p_name;
  });

productSchema.virtual('sku_from_scode')
  .get(function () {
    return this.SKU || this.sku || this.s_code;
  });

productSchema.virtual('primaryImage')
  .get(function () {
    if (this.images && this.images.length) return this.images[0].url || null;
    if (this.p_image) return this.p_image;
    if (this.image) return this.image;
    return null;
  });

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

    if (this.p_price && !this.p_price.price_code) {
      const regex = /^RS(\d+)$/;
      const lastProductWithPrice = await mongoose.model('Product')
        .find({ 'p_price.price_code': regex })
        .sort({ 'p_price.price_code': -1 })
        .limit(1);

      let nextPriceNum = 1;
      if (lastProductWithPrice.length && lastProductWithPrice[0].p_price && lastProductWithPrice[0].p_price.price_code) {
        const numPart = parseInt(lastProductWithPrice[0].p_price.price_code.slice(2));
        if (!isNaN(numPart)) nextPriceNum = numPart + 1;
      }

      this.p_price.price_code = `RS${String(nextPriceNum).padStart(3, '0')}`;
    }
  }

  if (!this.name && this.p_name) this.name = this.p_name;

  if (!this.description || (!this.description.short && !this.description.long)) {
    this.description = this.description || {};
    if (this.p_description && !this.description.long) {
      this.description.long = this.p_description;
    }
  }

  if (!this.slug && (this.name || this.p_name)) {
    try {
      const base = (this.name || this.p_name || 'product').toString().trim();
      let candidate = slugify(base, { lower: true, strict: true });
      this.slug = `${candidate}-${this.p_code || Math.random().toString(36).slice(2, 6)}`;
    } catch {}
  }

  if ((!this.SKU || this.SKU === '') && this.s_code) this.SKU = this.s_code;
  if ((!this.sku || this.sku === '') && this.SKU) this.sku = this.SKU;
  if ((!this.SKU || this.SKU === '') && this.sku) this.SKU = this.sku;

  if ((this.price === null || typeof this.price === 'undefined') &&
      this.p_price && typeof this.p_price.net_amount !== 'undefined') {
    this.price = this.p_price.net_amount;
  }

  if ((this.salePrice === null || typeof this.salePrice === 'undefined') &&
      this.p_price && typeof this.p_price.sales_5_50 !== 'undefined') {
    this.salePrice = this.p_price.sales_5_50;
  }

  if (this.dimension && (!this.dimensions || !this.dimensions.asString)) {
    this.dimensions = this.dimensions || {};
    if (!this.dimensions.asString) this.dimensions.asString = this.dimension;
  }

  next();
});

productSchema.index({ slug: 1 }, { unique: true, sparse: true });
productSchema.index({ SKU: 1 }, { unique: true, sparse: true });
productSchema.index({ p_code: 1 }, { unique: true, sparse: true });

module.exports = mongoose.model('Product', productSchema);
