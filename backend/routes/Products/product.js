const express = require('express');
const router = express.Router();
const Product = require('../../models/ProductData');
const Category = require('../../models/Category');
const VendorProduct = require('../../models/VendorProduct');
const multer = require("multer");
const path = require("path");
const fs = require("fs");
const mongoose = require("mongoose");
const authenticate = require("../../middleware/auth");
const requireRole = require("../../middleware/requireRole");
const { getPaging, setPageHeaders } = require("../../utils/paginate");
const { previewProductCode } = require("../../services/productCode");

/* ---------------------- MULTER STORAGE ---------------------- */
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, "uploads/products");
  },
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname);
    const unique = Date.now() + "-" + Math.round(Math.random() * 1e9);
    cb(null, "product-" + unique + ext);
  }
});

// Stricter validation: allowlist both extension AND mimetype, cap size.
const ALLOWED_IMAGE_EXT = /\.(jpe?g|png|webp|gif)$/i;
const ALLOWED_IMAGE_MIME = /^image\/(jpe?g|png|webp|gif)$/i;

const fileFilter = (req, file, cb) => {
  const extOk = ALLOWED_IMAGE_EXT.test(path.extname(file.originalname).toLowerCase());
  const mimeOk = ALLOWED_IMAGE_MIME.test(file.mimetype);
  if (extOk && mimeOk) return cb(null, true);
  return cb(new Error("Only JPG, PNG, WEBP or GIF images are allowed"), false);
};

const upload = multer({
  storage,
  fileFilter,
  limits: { fileSize: 5 * 1024 * 1024, files: 1 }, // 5MB, single file
});

const parseAndValidatePrice = (rawPrice) => {
  let price;
  try { price = typeof rawPrice === "string" ? JSON.parse(rawPrice) : rawPrice; } catch { return { error: "Price details must be valid JSON." }; }
  if (!price || typeof price !== "object") return { error: "Price details are required." };
  const basic = Number(price.basic_amount);
  const gst = Number(price.GST_rate);
  if (!Number.isFinite(basic) || basic < 0 || !Number.isFinite(gst) || gst < 0) return { error: "Basic amount and GST rate must be valid non-negative numbers." };
  const purchase = price.purchase_price === "" || price.purchase_price == null ? undefined : Number(price.purchase_price);
  if (purchase !== undefined && (!Number.isFinite(purchase) || purchase < 0)) return { error: "Purchase amount must be a valid non-negative number." };
  return { price: { ...price, basic_amount: basic, GST_rate: gst, ...(purchase !== undefined ? { purchase_price: purchase } : {}), net_amount: Number((basic + (basic * gst) / 100).toFixed(2)) } };
};
const escapeRegex = (value) => value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

/* ---------------------- ADD PRODUCT ---------------------- */
router.post("/add-product", authenticate, requireRole("admin"), upload.single("p_image"), async (req, res) => {
  try {
    const {
      p_name,
      s_code,
      cat_id,
      p_description,
      p_type,
      p_color,
      HSN_code,
      dimension,          
      p_price,
    } = req.body;

    const parsedPrice = parseAndValidatePrice(p_price);
    if (parsedPrice.error) return res.status(400).json({ error: parsedPrice.error });
    const priceObj = parsedPrice.price;

    if (!p_name?.trim() || !s_code?.trim() || !cat_id) {
      return res.status(400).json({
        error: "Product name, style code, and category are required.",
      });
    }
    if (!mongoose.isValidObjectId(cat_id) || !await Category.exists({ _id: cat_id })) return res.status(400).json({ error: "Please select a valid category." });

    const newProduct = new Product({
      p_name: p_name.trim(),
      s_code: s_code.trim(),
      cat_id,
      p_description,
      p_type,
      p_color,
      HSN_code,
      dimension,          
      p_price: priceObj,
      p_image: req.file ? `/uploads/products/${req.file.filename}` : null,
    });

    const savedProduct = await newProduct.save();
    return res.status(201).json(savedProduct);

  } catch (error) {
    console.error("Error creating product:", error);
    if (error?.code === 11000 && error?.keyPattern?.p_code) {
      return res.status(409).json({ error: "A product code collision was detected. Please submit again." });
    }
    return res.status(500).json({ error: "Internal server error." });
  }
});

/* ---------------------- GET META CATEGORIES ---------------------- */
router.get("/meta", authenticate, async (req, res) => {
  try {
    const cat_names = await Category.find().select("_id name").lean();
    res.json({ cat_names });
  } catch (err) {
    console.error("Meta Error:", err);
    res.status(500).json({ error: "Internal Server Error" });
  }
});

/* ---------------------- GET ALL PRODUCTS ---------------------- */
router.get("/products", authenticate, async (req, res) => {
  try {
    const { page, limit, skip } = getPaging(req);
    const query = String(req.query.query || "").trim();
    const category = String(req.query.category || "").trim();
    const filters = {};
    if (category) filters.cat_id = category;
    if (query) {
      const safeQuery = escapeRegex(query);
      const matchingCategories = await Category.find({ name: { $regex: safeQuery, $options: "i" } }).select("_id").lean();
      filters.$or = [
        { p_name: { $regex: safeQuery, $options: "i" } }, { p_code: { $regex: safeQuery, $options: "i" } },
        { s_code: { $regex: safeQuery, $options: "i" } }, { p_description: { $regex: safeQuery, $options: "i" } },
        { p_type: { $regex: safeQuery, $options: "i" } }, { p_color: { $regex: safeQuery, $options: "i" } },
        { cat_id: { $in: matchingCategories.map((item) => item._id.toString()) } },
      ];
    }
    const sorts = {
      updated_desc: { updatedAt: -1 }, created_desc: { createdAt: -1 }, created_asc: { createdAt: 1 },
      name_asc: { p_name: 1 }, name_desc: { p_name: -1 },
      price_asc: { "p_price.net_amount": 1 }, price_desc: { "p_price.net_amount": -1 },
    };
    const sort = sorts[req.query.sort] || sorts.updated_desc;
    const [products, total] = await Promise.all([
      Product.find(filters).sort(sort).skip(skip).limit(limit).lean(),
      Product.countDocuments(filters),
    ]);
    const pages = setPageHeaders(res, total, page, limit);
    res.status(200).json({ products, total, page, pages });
  } catch (error) {
    console.error("Error fetching products:", error);
    res.status(500).json({ error: "Failed to fetch products" });
  }
});

// Backwards-compatible metadata path used by the deployed Product Management
// frontend. It must be registered before /products/:id; otherwise "meta" is
// interpreted as a product id and category dropdowns receive a 400 response.
router.get("/products/meta", authenticate, async (req, res) => {
  try {
    const cat_names = await Category.find().select("_id name").lean();
    return res.json({ cat_names });
  } catch (err) {
    console.error("Product metadata error:", err);
    return res.status(500).json({ error: "Internal Server Error" });
  }
});

// Informational only: final allocation occurs in the model save hook so this
// endpoint never reserves a code or creates a race condition.
router.get("/product-code-preview", authenticate, async (req, res) => {
  try {
    if (!req.query.categoryId) return res.status(400).json({ error: "Category is required." });
    return res.json({ productCode: await previewProductCode(req.query.categoryId) });
  } catch (error) {
    return res.status(400).json({ error: error.message || "Unable to generate product code preview." });
  }
});

/* ---------------------- GET ONE PRODUCT ---------------------- */
router.get("/products/:id", authenticate, async (req, res, next) => {
  if (req.params.id === "search") return next();
  if (!mongoose.isValidObjectId(req.params.id)) return res.status(400).json({ error: "Invalid product ID." });
  try {
    const product = await Product.findById(req.params.id).lean();
    if (!product) return res.status(404).json({ error: "Product not found." });
    return res.json({ product });
  } catch (error) {
    console.error("Error fetching product:", error);
    return res.status(500).json({ error: "Failed to fetch product." });
  }
});

/* ---------------------- PRODUCT SEARCH ---------------------- */
router.get('/products/search', authenticate, async (req, res) => {
  try {
    const { query } = req.query;

    const searchTerm = String(query || "").trim();
    if (!searchTerm) return res.json({ products: [] });
    const safeSearchTerm = escapeRegex(searchTerm);

    const mongoQuery = {
      $or: [
        { p_code: { $regex: safeSearchTerm, $options: "i" } },
        { p_name: { $regex: safeSearchTerm, $options: "i" } },
        { s_code: { $regex: safeSearchTerm, $options: "i" } },
        { p_type: { $regex: safeSearchTerm, $options: "i" } },
        { p_color: { $regex: safeSearchTerm, $options: "i" } },
        { dimension: { $regex: searchTerm, $options: "i" } },     // ⭐ NEW FIELD SEARCH
        { 'p_price.GST_rate': !isNaN(Number(searchTerm)) ? Number(searchTerm) : -1 }
      ]
    };

    const products = await Product.find(mongoQuery).lean();

    res.json({ products });

  } catch (err) {
    console.error('Error searching product:', err);
    res.status(500).json({ message: 'Internal server error' });
  }
});

/* ---------------------- UPDATE PRODUCT + IMAGE ---------------------- */
router.post('/products/update', authenticate, requireRole("admin"), upload.single("p_image"), async (req, res) => {
  try {
    const {
      _id, s_code,
      p_name,
      p_type,
      p_color,
      HSN_code,
      dimension,       
      cat_id,
      p_description,
      p_price, remove_image
    } = req.body;

    if (!_id)
      return res.status(400).json({ message: "Product ID is required." });
    if (!mongoose.isValidObjectId(_id)) return res.status(400).json({ message: "Invalid product ID." });

    const existingProduct = await Product.findById(_id);

    if (!existingProduct)
      return res.status(404).json({ message: "Product not found." });

    const parsedPrice = parseAndValidatePrice(p_price);
    if (parsedPrice.error) return res.status(400).json({ message: parsedPrice.error });
    const priceObj = parsedPrice.price;
    if (!p_name?.trim() || !s_code?.trim() || !cat_id) return res.status(400).json({ message: "Product name, style code, and category are required." });
    if (!mongoose.isValidObjectId(cat_id) || !await Category.exists({ _id: cat_id })) return res.status(400).json({ message: "Please select a valid category." });

    let imagePath = existingProduct.p_image;

    // If new image uploaded → replace old image
    if (req.file || remove_image === "true") {
      imagePath = req.file ? `/uploads/products/${req.file.filename}` : null;

      if (existingProduct.p_image) {
        const oldImagePath = path.join(process.cwd(), existingProduct.p_image.replace(/^\//, ""));
        if (fs.existsSync(oldImagePath)) fs.unlinkSync(oldImagePath);
      }
    }

    const updatedProduct = await Product.findByIdAndUpdate(
      _id,
      {
        s_code: s_code.trim(),
        p_name: p_name.trim(),
        p_type,
        p_color,
        HSN_code,
        dimension,        
        cat_id,
        p_description,
        p_image: imagePath,
        p_price: {
          ...priceObj,
          price_code: existingProduct.p_price.price_code,
        }
      },
      { new: true }
    );

    res.status(200).json(updatedProduct);

  } catch (error) {
    console.error("Update Error:", error);
    res.status(500).json({ message: "Internal Server Error" });
  }
});

/* ---------------------- DELETE PRODUCT ---------------------- */
router.delete('/products/delete/:id', authenticate, requireRole("admin"), async (req, res) => {
  if (!mongoose.isValidObjectId(req.params.id)) return res.status(400).json({ message: "Invalid product ID." });
  try {
    const existing = await Product.findById(req.params.id);
    if (!existing) return res.status(404).json({ message: "Product not found" });

    // Product master records are referenced by vendor pricing/history. Refuse
    // a destructive delete instead of leaving orphan VendorProduct rows.
    const vendorReferenceCount = await VendorProduct.countDocuments({ product: existing._id });
    if (vendorReferenceCount) {
      return res.status(409).json({
        message: `This product is used by ${vendorReferenceCount} vendor record${vendorReferenceCount === 1 ? "" : "s"} and cannot be deleted.`,
      });
    }

    if (existing.p_image) {
      const imagePath = path.join(process.cwd(), existing.p_image.replace(/^\//, ""));
      if (fs.existsSync(imagePath)) fs.unlinkSync(imagePath);
    }

    await Product.findByIdAndDelete(req.params.id);

    res.status(200).json({ message: "Deleted", product: existing });

  } catch (error) {
    res.status(500).json({ message: "Internal error" });
  }
});

// Keep upload validation errors useful to the product forms instead of leaking
// framework errors through the application's generic error handler.
router.use((error, req, res, next) => {
  if (error instanceof multer.MulterError) {
    const message = error.code === "LIMIT_FILE_SIZE" ? "Product image must be 5 MB or smaller." : "Invalid product image upload.";
    return res.status(400).json({ error: message, message });
  }
  if (error?.message === "Only JPG, PNG, WEBP or GIF images are allowed") {
    return res.status(400).json({ error: error.message, message: error.message });
  }
  return next(error);
});

module.exports = router;
