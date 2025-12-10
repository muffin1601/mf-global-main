const express = require('express');
const router = express.Router();
const Product = require('../../models/ProductData');
const Category = require('../../models/Category');
const multer = require("multer");
const path = require("path");
const fs = require("fs");

// External DB models
const PrintkeeCategory = require("../../models/PrintkeeCategory");
const CoachingProduct = require("../../models/CoachingProduct");

// BASE URL for serving images outside CRM
const BASE_URL = process.env.BASE_URL || "https://printkee.com";

/* ============================================================
   MULTER STORAGE
============================================================ */
const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, "uploads/products"),
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname);
    const unique = Date.now() + "-" + Math.round(Math.random() * 1e9);
    cb(null, "product-" + unique + ext);
  }
});

const upload = multer({
  storage,
  fileFilter: (req, file, cb) => {
    file.mimetype.startsWith("image/")
      ? cb(null, true)
      : cb(new Error("Only images allowed"), false);
  }
});

/* ============================================================
   MAPPING FUNCTIONS
============================================================ */
function mapCRMtoPrintkee(p) {
  return {
    productCode: p.p_code,
    SKU: p.s_code,
    name: p.p_name,
    description: p.p_description,
    type: p.p_type,
    colour: [p.p_color],
    HSNCode: p.HSN_code,
    GSTRate: p.GST_rate,
    image: BASE_URL + p.p_image,
    price: {
      basic_amount: p.p_price.basic_amount,
      GST_rate: p.p_price.GST_rate,
      net_amount: p.p_price.net_amount,
    },
  };
}

function mapCRMtoCoaching(p) {
  return {
    sku: p.s_code,
    name: p.p_name,
    description: {
      short: p.p_description,
      long: p.p_description,
    },
    attributes: {
      material: p.p_type,
      color: [p.p_color],
    },
    price: p.p_price.net_amount,
    images: [{ url: BASE_URL + p.p_image }],
  };
}

/* ============================================================
   SYNC FUNCTIONS
============================================================ */
async function syncCreate(product) {
  if (product.origin.source === "printkee") {
    const cat = await PrintkeeCategory.findById(product.origin.categoryId);
    const sub = cat.subcategories.id(product.origin.subcategoryId);

    const mapped = mapCRMtoPrintkee(product);
    sub.products.push(mapped);

    const created = sub.products[sub.products.length - 1];
    product.origin.productId = created._id;

    await cat.save();
    await product.save();
  }

  if (product.origin.source === "coachingpromo") {
    const mapped = mapCRMtoCoaching(product);
    const created = await CoachingProduct.create(mapped);

    product.origin.productId = created._id;
    await product.save();
  }
}

async function syncUpdate(product) {
  if (product.origin.source === "printkee") {
    const cat = await PrintkeeCategory.findById(product.origin.categoryId);
    const sub = cat.subcategories.id(product.origin.subcategoryId);
    const prod = sub.products.id(product.origin.productId);

    Object.assign(prod, mapCRMtoPrintkee(product));
    await cat.save();
  }

  if (product.origin.source === "coachingpromo") {
    await CoachingProduct.findByIdAndUpdate(
      product.origin.productId,
      mapCRMtoCoaching(product)
    );
  }
}

async function syncDelete(product) {
  if (product.origin.source === "printkee") {
    const cat = await PrintkeeCategory.findById(product.origin.categoryId);
    const sub = cat.subcategories.id(product.origin.subcategoryId);

    sub.products = sub.products.filter(
      (p) => p._id.toString() !== product.origin.productId
    );

    await cat.save();
  }

  if (product.origin.source === "coachingpromo") {
    await CoachingProduct.findByIdAndDelete(product.origin.productId);
  }
}

/* ============================================================
   CREATE PRODUCT + SYNC
============================================================ */
router.post("/add-product", upload.single("p_image"), async (req, res) => {
  try {
    let data = req.body;

    if (data.p_price) data.p_price = JSON.parse(data.p_price);
    if (data.origin) data.origin = JSON.parse(data.origin);

    const newProduct = new Product({
      ...data,
      origin: data.origin || { source: "crm" },
      p_image: req.file ? `/uploads/products/${req.file.filename}` : null,
    });

    const saved = await newProduct.save();

    await syncCreate(saved);

    res.status(201).json(saved);

  } catch (error) {
    console.error("Create Error:", error);
    res.status(500).json({ error: "Internal Server Error" });
  }
});

/* ============================================================
   GET ALL PRODUCTS
============================================================ */
router.get("/products", async (req, res) => {
  try {
    const products = await Product.find().sort({ createdAt: -1 });
    res.json({ products });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to fetch products" });
  }
});

/* ============================================================
   UPDATE PRODUCT + SYNC
============================================================ */
router.post("/products/update", upload.single("p_image"), async (req, res) => {
  try {
    let data = req.body;

    if (data.p_price) data.p_price = JSON.parse(data.p_price);
    if (data.origin) data.origin = JSON.parse(data.origin);

    const existing = await Product.findById(data._id);
    if (!existing) return res.status(404).json({ message: "Product not found" });

    let imagePath = existing.p_image;

    if (req.file) {
      imagePath = `/uploads/products/${req.file.filename}`;

      const oldPath = `.${existing.p_image}`;
      if (fs.existsSync(oldPath)) fs.unlinkSync(oldPath);
    }

    const updated = await Product.findByIdAndUpdate(
      data._id,
      {
        ...data,
        p_image: imagePath,
        origin: data.origin || existing.origin,
        p_price: { ...data.p_price, price_code: existing.p_price.price_code }
      },
      { new: true }
    );

    await syncUpdate(updated);

    res.json(updated);

  } catch (error) {
    console.error("Update Error:", error);
    res.status(500).json({ error: "Internal Server Error" });
  }
});

/* ============================================================
   DELETE PRODUCT + SYNC
============================================================ */
router.delete("/products/delete/:id", async (req, res) => {
  try {
    const existing = await Product.findById(req.params.id);
    if (!existing) return res.status(404).json({ message: "Not Found" });

    await syncDelete(existing);

    if (existing.p_image) {
      const path = `.${existing.p_image}`;
      if (fs.existsSync(path)) fs.unlinkSync(path);
    }

    await Product.findByIdAndDelete(req.params.id);

    res.json({ success: true });

  } catch (err) {
    console.error("Delete Error:", err);
    res.status(500).json({ error: "Internal Server Error" });
  }
});

module.exports = router;
