const mongoose = require("mongoose");

const productSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    slug: { type: String, required: true, unique: true, lowercase: true },

    // Updated Description
    description: {
      short: String,
      long: String,
    },

    price: { type: Number, required: true },
    salePrice: { type: Number, default: null },

    images: [
      {
        url: String,
        altText: String,
      },
    ],

    subImages: [
      {
        url: String,
        altText: String,
      },
    ],

    stock: { type: Number, default: 0 },
    sku: { type: String, unique: true, sparse: true },

    attributes: {
      color: [String],
      size: [String],
      material: String,
    },

    //  Additional Info
    additionalInfo: [
      {
        label: String,
        value: String,
      },
    ],

    //  Specifications
    specifications: [
      {
        key: String,
        value: String,
      },
    ],

    tags: [String],

    isFeatured: { type: Boolean, default: false },
    isActive: { type: Boolean, default: true },

    ratings: {
      average: { type: Number, default: 0 },
      count: { type: Number, default: 0 },
    },

    seo: {
      metaTitle: String,
      metaDescription: String,
      keywords: [String],
    },

    // Relational Links
    category: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Category",
    },

    subcategory: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Subcategory",
    },
  },
  { timestamps: true }
);


module.exports = productSchema;