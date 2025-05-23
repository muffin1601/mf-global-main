const express = require('express');
const Category = require('../../models/Category');
const router = express.Router();

router.get("/products/meta", async (req, res) => {
  try {
    const cat_names = await Category.distinct("name");
    
    res.json({ cat_names });
  } catch (err) {
    console.error("Meta Error:", err);
    res.status(500).json({ error: "Internal Server Error" });
  }
});

module.exports = router;