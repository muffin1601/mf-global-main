const express = require('express');
const Category = require('../../models/Category');
const router = express.Router();

router.get("/meta", async (req, res) => {
  try {
    const cat_names = await Category.find().select("_id name");
    
    res.json({ cat_names });
  } catch (err) {
    console.error("Meta Error:", err);
    res.status(500).json({ error: "Internal Server Error" });
  }
});

module.exports = router;
