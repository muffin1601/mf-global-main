const express = require('express');
const router = express.Router();
const Product = require('../../models/ProductData');
const Category = require('../../models/Category');

router.post('/add-product', async (req, res) => {
  try {
    const {
      p_name,
      cat_id,
      p_description,
      p_type,
      p_color,
      HSN_code,
      p_price
    } = req.body;

    if (!p_name || !p_price || !p_price.basic_amount || !p_price.GST_rate || !p_price.net_amount) {
      return res.status(400).json({
        error: 'Product name, basic amount, GST rate, and net amount are required.'
      });
    }

    const newProduct = new Product({
      p_name,
      cat_id,
      p_description,
      p_type,
      p_color,
      HSN_code,
      p_price
    });


    const savedProduct = await newProduct.save();

    return res.status(201).json(savedProduct);

  } catch (error) {
    console.error('Error creating product:', error);

    if (error.code === 11000) {
      return res.status(400).json({ error: 'Duplicate product or price code.' });
    }

    return res.status(500).json({ error: 'Internal server error.' });
  }
});

module.exports = router;


router.get("/products", async (req, res) => {
  try {
    const products = await Product.find().lean();
    // const uniqueProductsMap = new Map();

    // clients.forEach(client => {
    //   const phoneKey = client.phone || client.contact; // use whichever field exists
    //   if (phoneKey && !uniqueClientsMap.has(phoneKey)) {
    //     uniqueClientsMap.set(phoneKey, client);
    //   }
    // });

    // const uniqueClients = Array.from(uniqueClientsMap.values());
    res.status(200).json({ products });
  } catch (error) {
    console.error("Error fetching unique clients:", error);
    res.status(500).json({ error: "Failed to fetch clients" });
  }
});

router.post('/categories/add', async (req, res) => {
  try {
    const category = new Category({ name: req.body.name });
    await category.save();
    res.status(201).json({ message: 'Category added', category });
  } catch (err) {
    console.error('Error adding category:', err);
    if (err.code === 11000) {
      return res.status(400).json({ error: 'Category already exists.' });
    }
    res.status(500).json({ error: 'Server error' });
  }
});

router.get('/products/search', async (req, res) => {
  try {
    const { query } = req.query;

    if (!query || query.trim() === '') {
      return res.status(400).json({ message: 'Search query is required' });
    }

    const searchTerm = query.trim();


    const mongoQuery = {
      $or: [
        { product_code: searchTerm },
        { p_name: { $regex: new RegExp(searchTerm, 'i') } },
        { p_type: { $regex: new RegExp(searchTerm, 'i') } },
        { p_color: { $regex: new RegExp(searchTerm, 'i') } },
        { GST_rate: !isNaN(Number(searchTerm)) ? Number(searchTerm) : -1 }
      ]
    };

    const products = await Product.find(mongoQuery);

    if (!products.length) {
      return res.status(404).json({ message: 'No products found' });
    }

    res.json({ products });
  } catch (err) {
    console.error('Error searching product:', err);
    res.status(500).json({ message: 'Internal server error' });
  }
});

router.post('/products/update', async (req, res) => {
  try {
    const { _id, p_name, p_type, p_color, HSN_code, cat_id, p_description, p_price } = req.body;

    if (!_id) {
      return res.status(400).json({ message: "Product ID is required." });
    }
    const updateData = {
      p_name,
      p_type,
      p_color,
      HSN_code,
      cat_id,
      p_description,
      p_price: {
        price_code: Product.price_code || p_price?.price_code, 
        ...p_price
      }
    };

    const updatedProduct = await Product.findByIdAndUpdate(
      _id,
      updateData,
      { new: true, runValidators: true }
    );

    if (!updatedProduct) {
      return res.status(404).json({ message: "Product not found." });
    }

    res.status(200).json(updatedProduct);
  } catch (error) {
    console.error("Error updating product:", error);
    res.status(500).json({ message: "Internal Server Error", error: error.message });
  }
});


router.delete('/products/delete/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const deletedProduct = await Product.findByIdAndDelete(id);
    if (!deletedProduct) {
      return res.status(404).json({ message: 'Product not found.' });
    }
    res.status(200).json({ message: 'Product deleted successfully.', product: deletedProduct });
  } catch (error) {
    console.error('Error deleting product:', error);
    res.status(500).json({ message: 'Internal server error.' });
  }
});
module.exports = router;
