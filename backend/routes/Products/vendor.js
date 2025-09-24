const express = require('express');
const router  = express.Router();
const Vendor  = require('../../models/VendorData');


router.post('/add-vendor', async (req, res) => {
  try {
    console.log('Received vendor payload:', req.body); 

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
    console.error('Error while adding vendor:', err); 
    if (err.code === 11000) {
      return res.status(400).json({ error: 'Vendor code already exists.' });
    }
    return res.status(500).json({ error: 'Server error. Could not create vendor.' });
  }
});



router.get('/vendors', async (_req, res) => {
  try {
    const vendors = await Vendor.find().lean();
    res.json({ vendors });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Could not fetch vendors.' });
  }
});

router.delete('/vendors/delete/:id', async (req, res) => {
  const { id } = req.params;

  try {
    const deletedVendor = await Vendor.findByIdAndDelete(id);
    if (!deletedVendor) {
      return res.status(404).json({ message: 'Vendor not found' });
    }
    res.status(200).json({ message: 'Vendor deleted successfully', vendor: deletedVendor });
  } catch (error) {
    console.error('Error deleting vendor:', error);
    res.status(500).json({ message: 'Server error while deleting vendor' });
  }
});

router.post('/vendors/update', async (req, res) => {
  
  const updatedVendor = req.body;
  const vendorId = updatedVendor._id;

  if (!vendorId) {
    return res.status(400).json({ message: "Vendor ID is required for update." });
  }

  try {
    const vendor = await Vendor.findByIdAndUpdate(vendorId, updatedVendor, {
      new: true, 
      runValidators: true, 
    });

    if (!vendor) {
      return res.status(404).json({ message: "Vendor not found." });
    }

    res.status(200).json(vendor);
  } catch (error) {
    console.error("Error updating vendor:", error);
    res.status(500).json({ message: "Server error while updating vendor." });
  }
});


module.exports = router;
