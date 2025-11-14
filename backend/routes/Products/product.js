const express = require('express');
const router = express.Router();
const Product = require('../../models/ProductData');
const Category = require('../../models/Category');
const multer = require("multer");
const path = require("path");
const fs = require("fs");

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

const fileFilter = (req, file, cb) => {
  if (file.mimetype.startsWith("image/")) cb(null, true);
  else cb(new Error("Only images allowed"), false);
};

const upload = multer({ storage, fileFilter });

/* ---------------------- ADD PRODUCT ---------------------- */
router.post("/add-product", upload.single("p_image"), async (req, res) => {
  try {
    const {
      p_name,
      s_code,
      cat_id,
      p_description,
      p_type,
      p_color,
      HSN_code,
      p_price,
    } = req.body;

    let priceObj = JSON.parse(p_price);

    if (!p_name || !priceObj.basic_amount || !priceObj.GST_rate || !priceObj.net_amount) {
      return res.status(400).json({
        error: "Product name, basic amount, GST rate & net amount are required.",
      });
    }

    const newProduct = new Product({
      p_name,
      s_code,
      cat_id,
      p_description,
      p_type,
      p_color,
      HSN_code,
      p_price: priceObj,
      p_image: req.file ? `/uploads/products/${req.file.filename}` : null,
    });

    const savedProduct = await newProduct.save();
    return res.status(201).json(savedProduct);

  } catch (error) {
    console.error("Error creating product:", error);
    return res.status(500).json({ error: "Internal server error." });
  }
});

/* ---------------------- GET META CATEGORIES ---------------------- */
router.get("/meta", async (req, res) => {
  try {
    const cat_names = await Category.find().select("_id name");
    res.json({ cat_names });
  } catch (err) {
    console.error("Meta Error:", err);
    res.status(500).json({ error: "Internal Server Error" });
  }
});

/* ---------------------- GET ALL PRODUCTS ---------------------- */
router.get("/products", async (req, res) => {
  try {
    const products = await Product.find().sort({ createdAt: -1 }).lean();
    res.status(200).json({ products });
  } catch (error) {
    console.error("Error fetching products:", error);
    res.status(500).json({ error: "Failed to fetch products" });
  }
});

/* ---------------------- PRODUCT SEARCH ---------------------- */
router.get('/products/search', async (req, res) => {
  try {
    const { query } = req.query;

    const searchTerm = query.trim();

    const mongoQuery = {
      $or: [
        { p_code: { $regex: searchTerm, $options: "i" } },
        { p_name: { $regex: searchTerm, $options: "i" } },
        { s_code: { $regex: searchTerm, $options: "i" } },
        { p_type: { $regex: searchTerm, $options: "i" } },
        { p_color: { $regex: searchTerm, $options: "i" } },
        { GST_rate: !isNaN(Number(searchTerm)) ? Number(searchTerm) : -1 }
      ]
    };

    const products = await Product.find(mongoQuery);

    res.json({ products });

  } catch (err) {
    console.error('Error searching product:', err);
    res.status(500).json({ message: 'Internal server error' });
  }
});

/* ---------------------- UPDATE PRODUCT + IMAGE ---------------------- */
router.post('/products/update', upload.single("p_image"), async (req, res) => {
  try {
    const { _id, p_name, p_type, p_color, HSN_code, cat_id, p_description, p_price } = req.body;

    if (!_id)
      return res.status(400).json({ message: "Product ID is required." });

    const existingProduct = await Product.findById(_id);

    if (!existingProduct)
      return res.status(404).json({ message: "Product not found." });

    const priceObj = JSON.parse(p_price);

    let imagePath = existingProduct.p_image;

    // If new image uploaded → replace old image
    if (req.file) {
      imagePath = `/uploads/products/${req.file.filename}`;

      const oldImagePath = `.${existingProduct.p_image}`;
      if (fs.existsSync(oldImagePath)) fs.unlinkSync(oldImagePath);
    }

    const updatedProduct = await Product.findByIdAndUpdate(
      _id,
      {
        p_name,
        p_type,
        p_color,
        HSN_code,
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
router.delete('/products/delete/:id', async (req, res) => {
  try {
    const existing = await Product.findById(req.params.id);
    if (!existing) return res.status(404).json({ message: "Product not found" });

    if (existing.p_image) {
      const imagePath = `.${existing.p_image}`;
      if (fs.existsSync(imagePath)) fs.unlinkSync(imagePath);
    }

    await Product.findByIdAndDelete(req.params.id);

    res.status(200).json({ message: "Deleted", product: existing });

  } catch (error) {
    res.status(500).json({ message: "Internal error" });
  }
});

module.exports = router;
