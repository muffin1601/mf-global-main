const test = require('node:test');
const assert = require('node:assert/strict');
const express = require('express');
const request = require('supertest');

const { start, stop, resetCollections, createUser } = require('./helpers/testApp');
const Category = require('../models/Category');
const Product = require('../models/ProductData');
const { deleteProductImage } = require('../utils/productImages');

let app;
let admin;
let user;
let category;
const createdImages = new Set();

const fields = (overrides = {}) => ({
  p_name: 'Canvas Bag',
  s_code: 'SKU-001',
  cat_id: String(category._id),
  p_description: 'Test product',
  p_type: 'Canvas',
  p_color: 'Blue',
  HSN_code: '4202',
  dimension: '20x20',
  p_price: JSON.stringify({ purchase_price: 80, basic_amount: 100, GST_rate: 18 }),
  ...overrides,
});

const postProduct = (auth, overrides = {}) => {
  let call = request(app).post('/api/add-product').set('Authorization', auth);
  for (const [key, value] of Object.entries(fields(overrides))) call = call.field(key, value);
  return call;
};

test.before(async () => {
  await start();
  app = express();
  app.use('/uploads', express.static(require('path').resolve(__dirname, '../uploads')));
  app.use('/api', require('../routes/Products/product'));
});

test.after(async () => {
  await Promise.all([...createdImages].map((image) => deleteProductImage(image)));
  await stop();
});

test.beforeEach(async () => {
  await resetCollections();
  admin = await createUser({ role: 'admin', name: 'Product Admin' });
  user = await createUser({ role: 'user', name: 'Product Viewer' });
  category = await Category.create({ name: 'Bags' });
});

test('admin creates a product with a signature-verified image and users can retrieve it', async () => {
  const png = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 0]);
  const created = await postProduct(admin.auth).attach('p_image', png, { filename: 'image.png', contentType: 'image/png' });
  assert.equal(created.status, 201);
  assert.equal(created.body.p_price.net_amount, 118);
  assert.match(created.body.p_image, /^\/uploads\/products\/product-[a-f0-9-]+\.png$/);
  createdImages.add(created.body.p_image);

  const image = await request(app).get(created.body.p_image);
  assert.equal(image.status, 200);
  assert.deepEqual(image.body, png);

  const listed = await request(app).get('/api/products?page=1&limit=10').set('Authorization', user.auth);
  assert.equal(listed.status, 200);
  assert.equal(listed.body.total, 1);
});

test('rejects forged images, duplicate SKU/style codes and unauthorized mutations', async () => {
  const forged = await postProduct(admin.auth).attach('p_image', Buffer.from('not an image'), { filename: 'fake.png', contentType: 'image/png' });
  assert.equal(forged.status, 400);

  assert.equal((await postProduct(admin.auth)).status, 201);
  const duplicate = await postProduct(admin.auth, { p_name: 'Duplicate', s_code: 'sku-001' });
  assert.equal(duplicate.status, 409);
  assert.equal((await postProduct(user.auth, { s_code: 'SKU-002' })).status, 403);
});

test('updates are versioned and stale edits are rejected', async () => {
  const created = await postProduct(admin.auth);
  const updateFields = fields({ _id: created.body._id, p_name: 'Canvas Bag Revised', version: String(created.body.__v) });
  let update = request(app).post('/api/products/update').set('Authorization', admin.auth);
  for (const [key, value] of Object.entries(updateFields)) update = update.field(key, value);
  const updated = await update;
  assert.equal(updated.status, 200);
  assert.equal(updated.body.p_name, 'Canvas Bag Revised');

  let stale = request(app).post('/api/products/update').set('Authorization', admin.auth);
  for (const [key, value] of Object.entries(updateFields)) stale = stale.field(key, value);
  assert.equal((await stale).status, 409);
});

test('archive retains the product and image reference but removes it from active lists and search', async () => {
  const created = await postProduct(admin.auth);
  const archived = await request(app).delete(`/api/products/delete/${created.body._id}`).set('Authorization', admin.auth);
  assert.equal(archived.status, 200);
  assert.equal(archived.body.product.status, 'archived');
  assert.equal(await Product.countDocuments({ _id: created.body._id }), 1);

  const active = await request(app).get('/api/products').set('Authorization', user.auth);
  assert.equal(active.body.total, 0);
  const search = await request(app).get('/api/products/search?query=Canvas').set('Authorization', user.auth);
  assert.deepEqual(search.body.products, []);
});
