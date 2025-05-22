const express = require('express');
const Category = require('../../models/Category');
const router = express.Router();

router.get("/products/meta", async (req, res) => {
  try {
    const catIds = await Category.distinct("cat_id");
    
    res.json({ catIds });
  } catch (err) {
    console.error("Meta Error:", err);
    res.status(500).json({ error: "Internal Server Error" });
  }
});

module.exports = router;