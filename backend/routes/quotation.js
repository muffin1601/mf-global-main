const express = require('express');
const router = express.Router();
const Quotation = require('../models/Quote');


router.post('/create', async (req, res) => {
    try {
        const {
            quotationNumber,
            quotationDate,
            customerName,
            customerAddress,
            deliveryTime = "Within 7 business days",
            paymentTerms = "Advance 50%, Balance on Delivery",
            validityPeriod = "Valid for 30 days",
            notes,
            products,
            grandTotal,
        } = req.body;

        if (!quotationNumber || !customerName || !customerAddress) {
            return res.status(400).json({ message: 'Quotation number, customer name, and address are required.' });
        }

        const quotation = new Quotation({
            quotationNumber,
            quotationDate,
            customer: {
                name: customerName,
                address: customerAddress,
            },
            deliveryTime,
            paymentTerms,
            validityPeriod,
            notes,
            products,
            grandTotal,
        });

        await quotation.save();
        res.status(201).json({ success: true, message: 'Quotation saved successfully', data: quotation });
    } catch (err) {
        console.error('Quotation API error:', err);
        res.status(500).json({ success: false, message: 'Server error. Could not save quotation.' });
    }
});

router.get("/data/count", async (req, res) => {
  try {
    const quotations = await Quotation.find().sort({ createdAt: -1 }); 
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

router.delete("/:id", async (req, res) => {
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


module.exports = router;
