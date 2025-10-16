const mongoose = require('mongoose');

const categorySchema = new mongoose.Schema({
  cat_id: {
    type: String,
    unique: true
  },
  name: {
    type: String,
    required: true,
    unique: true
  }
});

categorySchema.pre('save', async function (next) {
  if (this.cat_id || !this.name) return next();

  const firstLetter = this.name[0].toUpperCase();
  const regex = new RegExp(`^C${firstLetter}(\\d+)$`);

  const lastCategory = await this.constructor.findOne({ cat_id: regex })
    .sort({ cat_id: -1 });

  let nextNumber = 1;
  if (lastCategory && lastCategory.cat_id) {
    const match = lastCategory.cat_id.match(/\d+$/);
    if (match) {
      nextNumber = parseInt(match[0], 10) + 1;
    }
  }

  const paddedNumber = String(nextNumber).padStart(3, '0');
  this.cat_id = `C${firstLetter}${paddedNumber}`;

  next();
});

const Category = mongoose.model('Category', categorySchema);
module.exports = Category;
