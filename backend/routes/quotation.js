const express = require('express');
const router = express.Router();
const Quotation = require('../models/Quote');
const authMiddleware= require("../middleware/auth.js");
const User = require('../models/User');

router.post("/create", authMiddleware, async (req, res) => {
  try {
    const {
      party,
      items,
      terms,
      notes,
      bankDetails,
      invoiceDetails,
      summary,
    } = req.body;

    if (!party) return res.status(400).json({ message: "Party details required" });
    if (!items || items.length === 0) return res.status(400).json({ message: "At least one item is required" });

    const newQuotation = new Quotation({
      user: req.user._id, 
      party,
      items,
      terms,
      notes,
      bankDetails,
      invoiceDetails,
      summary,
      createdAt: new Date(),
    });

    const savedQuotation = await newQuotation.save();
    res.status(201).json(savedQuotation);
  } catch (error) {
    console.error("Error creating quotation:", error);
    res.status(500).json({ message: "Server error" });
  }
});



router.get("/data/count", async (req, res) => {
  try {
   
    const quotations = await Quotation.find()
      .sort({ createdAt: -1 })
      .populate('user', 'name username'); 

    const count = await Quotation.countDocuments();

    res.status(200).json({
      success: true,
      count,
      quotations,
    });
  } catch (error) {
    console.error("Error fetching quotations:", error);
    res.status(500).json({
      success: false,
      message: "Server error while fetching quotations",
      error: error.message,
    });
  }
});


router.delete("/delete/:id", async (req, res) => {
  try {
    const deleted = await Quotation.findByIdAndDelete(req.params.id);
    if (!deleted) {
      return res.status(404).json({ success: false, message: "Quotation not found" });
    }
    res.status(200).json({ success: true, message: "Quotation deleted successfully" });
  } catch (error) {
    console.error("Error deleting quotation:", error);
    res.status(500).json({ success: false, message: "Server error" });
  }
});

router.get("/fetch/:id", authMiddleware, async (req, res) => {
  try {
    const { id } = req.params;

    const quotation = await Quotation.findById(id);
    if (!quotation) {
      return res.status(404).json({ message: "Quotation not found" });
    }

    res.status(200).json(quotation);
  } catch (error) {
    console.error("Error fetching quotation:", error);
    res.status(500).json({ message: "Failed to fetch quotation" });
  }
});


module.exports = router;
