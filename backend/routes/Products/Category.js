const express = require('express');
const router = express.Router();
const Category = require('../../models/Category'); 
const authenticate = require("../../middleware/auth");
const requireRole = require("../../middleware/requireRole");

router.use(authenticate);

router.post('/add', requireRole("admin"), async (req, res) => {
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


router.get('/', async (req, res) => {
  try {
    const categories = await Category.find().sort({ name: 1 }).lean(); // sort alphabetically
    res.status(200).json(categories);
  } catch (err) {
    console.error('Error fetching categories:', err);
    res.status(500).json({ error: 'Server error' });
  }
});


router.get('/:id', async (req, res) => {
  try {
    const category = await Category.findById(req.params.id);
    if (!category) return res.status(404).json({ error: 'Category not found' });
    res.status(200).json(category);
  } catch (err) {
    console.error('Error fetching category:', err);
    res.status(500).json({ error: 'Server error' });
  }
});


router.put('/update/:id', requireRole("admin"), async (req, res) => {
  try {
    const { name } = req.body;

    if (!name) return res.status(400).json({ error: 'Category name is required' });

    const existing = await Category.findOne({ name, _id: { $ne: req.params.id } });
    if (existing) return res.status(400).json({ error: 'Category already exists.' });

    const category = await Category.findByIdAndUpdate(
      req.params.id,
      { name },
      { new: true }
    );

    if (!category) return res.status(404).json({ error: 'Category not found' });

    res.status(200).json({ message: 'Category updated', category });
  } catch (err) {
    console.error('Error updating category:', err);
    res.status(500).json({ error: 'Server error' });
  }
});


router.delete('/delete/:id', requireRole("admin"), async (req, res) => {
  try {
    const category = await Category.findByIdAndDelete(req.params.id);
    if (!category) return res.status(404).json({ error: 'Category not found' });

    res.status(200).json({ message: 'Category deleted successfully' });
  } catch (err) {
    console.error('Error deleting category:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

module.exports = router;
