const test = require('node:test');
const assert = require('node:assert/strict');
const { start, stop, resetCollections } = require('./helpers/testApp');
const Category = require('../models/Category');
const Product = require('../models/ProductData');
const Counter = require('../models/Counter');

const createProduct = (category, name = 'Test product') => Product.create({
  p_name: name,
  s_code: `STYLE-${Math.random().toString(36).slice(2)}`,
  cat_id: category._id.toString(),
  // Product price-code generation predates this feature and has its own unique
  // index; make it explicit so these tests isolate product-code behaviour.
  p_price: { price_code: `TEST-${Math.random().toString(36).slice(2)}` },
});

test.before(async () => { await start(); });
test.after(async () => { await stop(); });
test.beforeEach(async () => { await resetCollections(); });

test('allocates independent category sequences', async () => {
  const electronics = await Category.create({ name: 'Electronics' });
  const furniture = await Category.create({ name: 'Furniture' });
  assert.equal((await createProduct(electronics, 'E1')).p_code, 'EL-001');
  assert.equal((await createProduct(electronics, 'E2')).p_code, 'EL-002');
  assert.equal((await createProduct(furniture, 'F1')).p_code, 'FU-001');
  assert.equal((await createProduct(electronics, 'E3')).p_code, 'EL-003');
  assert.equal((await createProduct(furniture, 'F2')).p_code, 'FU-002');
});

test('normalizes spaces, lowercase, non-letters, and short category names', async () => {
  const gifts = await Category.create({ name: 'corporate gifts' });
  const special = await Category.create({ name: '7! apparel' });
  const short = await Category.create({ name: 'X' });
  assert.equal((await createProduct(gifts)).p_code, 'CO-001');
  assert.equal((await createProduct(special)).p_code, 'AP-001');
  assert.equal((await createProduct(short)).p_code, 'X-001');
});

test('shares a sequence for categories whose display prefix collides', async () => {
  const electronics = await Category.create({ name: 'Electronics' });
  const electrical = await Category.create({ name: 'Electrical' });
  assert.equal((await createProduct(electronics)).p_code, 'EL-001');
  assert.equal((await createProduct(electrical)).p_code, 'EL-002');
});

test('allocations remain unique during concurrent product creation', async () => {
  const category = await Category.create({ name: 'Concurrent' });
  const products = await Promise.all(Array.from({ length: 20 }, (_, index) => createProduct(category, `P${index}`)));
  const codes = products.map((product) => product.p_code).sort();
  assert.equal(new Set(codes).size, 20);
  assert.deepEqual(codes, Array.from({ length: 20 }, (_, index) => `CO-${String(index + 1).padStart(3, '0')}`));
});

test('keeps the existing code when a product category changes', async () => {
  const electronics = await Category.create({ name: 'Electronics' });
  const furniture = await Category.create({ name: 'Furniture' });
  const product = await createProduct(electronics);
  product.cat_id = furniture._id.toString();
  await product.save();
  assert.equal(product.p_code, 'EL-001');
  assert.equal((await Counter.findOne({ role: 'product-code:FU' })), null);
});

test('starts above matching legacy codes without overwriting them', async () => {
  const category = await Category.create({ name: 'Electronics' });
  await Product.collection.insertOne({ p_name: 'Legacy', s_code: 'L', cat_id: category._id.toString(), p_code: 'EL-007' });
  assert.equal((await createProduct(category)).p_code, 'EL-008');
});
