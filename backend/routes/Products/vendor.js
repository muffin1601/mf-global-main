const express = require('express');
const router  = express.Router();
const Vendor  = require('../../models/VendorData');

// POST /vendors/add  – create a vendor
router.post('/add-vendor', async (req, res) => {
  try {
    console.log('Received vendor payload:', req.body); // <--- Add this

    const data = { ...req.body };

    if (data.products && !Array.isArray(data.products)) {
      data.products = String(data.products)
        .split(',')
        .map(p => p.trim())
        .filter(Boolean);
    }

    const vendor = new Vendor(data);
    await vendor.save();

    return res.status(201).json({ message: 'Vendor Added', vendor });
  } catch (err) {
    console.error('Error while adding vendor:', err); // <--- Add this
    if (err.code === 11000) {
      return res.status(400).json({ error: 'Vendor code already exists.' });
    }
    return res.status(500).json({ error: 'Server error. Could not create vendor.' });
  }
});


// (optional) GET /vendors – list all vendors
router.get('/vendors', async (_req, res) => {
  try {
    const vendors = await Vendor.find().lean();
    res.json({ vendors });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Could not fetch vendors.' });
  }
});

module.exports = router;
