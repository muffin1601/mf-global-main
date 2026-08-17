// The legacy /api/vendors routes (routes/Products/vendor.js) share the Vendor
// model with the new module. Tightening that model therefore risks breaking the
// OLD vendor screen, which is still in production. These tests pin that
// behaviour down so the existing app keeps working.

const test = require('node:test');
const assert = require('node:assert/strict');
const request = require('supertest');
const express = require('express');
const mongoose = require('mongoose');
const qs = require('qs');
const mongoSanitize = require('express-mongo-sanitize');

const { start, stop, resetCollections, createUser } = require('./helpers/testApp');

let app;
let admin;

const buildLegacyApp = () => {
  const a = express();
  a.set('query parser', (str) => mongoSanitize.sanitize(qs.parse(str)));
  a.use(express.json());
  a.use('/api', require('../routes/Products/vendor'));
  return a;
};

// A vendor as the old schema stored it, inserted raw so no defaults apply.
const insertLegacy = async (overrides = {}) => {
  const doc = {
    v_code: 'VL001',
    name: 'Legacy Supplier Pvt Ltd',
    contact_name: 'Old Contact',
    phone: '9811100011',
    type: 'Trader',
    products: ['Bolts'],
    ...overrides,
  };
  const res = await mongoose.connection.collection('vendors').insertOne(doc);
  return { ...doc, _id: res.insertedId };
};

test.before(async () => {
  await start();
  app = buildLegacyApp();
});

test.after(async () => { await stop(); });

test.beforeEach(async () => {
  await resetCollections();
  admin = await createUser({ role: 'admin' });
});

test('the legacy vendor list still returns existing vendors', async () => {
  await insertLegacy();
  const res = await request(app).get('/api/vendors').set('Authorization', admin.auth);
  assert.equal(res.status, 200);
  assert.equal(res.body.vendors.length, 1);
});

test('the legacy add-vendor form still works', async () => {
  const res = await request(app).post('/api/add-vendor')
    .set('Authorization', admin.auth)
    .send({ name: 'Old Form Vendor', contact_name: 'Someone', phone: '9812345678', type: 'Trader', products: 'Bolts, Nuts' });

  assert.equal(res.status, 201);
  assert.match(res.body.vendor.v_code, /^VO\d{3}$/);
  assert.deepEqual(res.body.vendor.products, ['Bolts', 'Nuts']);
});

test('the legacy edit form can still save a vendor whose type predates the enum', async () => {
  // The old schema stored `type` as a free string, so production may hold
  // values the new enum does not list. Editing such a vendor through the old
  // screen must not fail.
  const legacy = await insertLegacy({ type: 'Wholesaler' });

  const res = await request(app).post('/api/vendors/update')
    .set('Authorization', admin.auth)
    .send({ _id: String(legacy._id), name: 'Legacy Supplier Pvt Ltd', contact_name: 'New Contact', type: 'Wholesaler' });

  assert.equal(res.status, 200, 'an unrecognised legacy vendor type must not break the old screen');
  assert.equal(res.body.contact_name, 'New Contact');
});

test('the legacy edit form can still save a vendor that has no name', async () => {
  const legacy = await insertLegacy({ name: undefined, v_code: 'VL002' });

  const res = await request(app).post('/api/vendors/update')
    .set('Authorization', admin.auth)
    .send({ _id: String(legacy._id), contact_name: 'Filled In' });

  assert.equal(res.status, 200, 'a nameless legacy vendor must still be editable on the old screen');
});

test('the legacy delete still works', async () => {
  const legacy = await insertLegacy();
  const res = await request(app).delete(`/api/vendors/delete/${legacy._id}`)
    .set('Authorization', admin.auth);
  assert.equal(res.status, 200);
});

test('the NEW module also preserves a legacy vendor type instead of rejecting it', async () => {
  // Same record, edited through the new module: the unrecognised type must be
  // accepted when carried over unchanged...
  const { buildApp } = require('./helpers/testApp');
  const newApp = buildApp();
  const legacy = await insertLegacy({ type: 'Wholesaler', v_code: 'VL009' });

  const keep = await request(newApp)
    .put(`/api/vendor-management/vendors/${legacy._id}`)
    .set('Authorization', admin.auth)
    .send({ industry: 'Hardware', type: 'Wholesaler' });
  assert.equal(keep.status, 200, 'carrying the existing type over must be allowed');

  // ...but a brand-new made-up type is still rejected.
  const reject = await request(newApp)
    .put(`/api/vendor-management/vendors/${legacy._id}`)
    .set('Authorization', admin.auth)
    .send({ type: 'Something Invented' });
  assert.equal(reject.status, 400, 'an arbitrary new type must still be rejected');
});

test('creating a vendor with an unrecognised type is still rejected', async () => {
  const { buildApp } = require('./helpers/testApp');
  const newApp = buildApp();

  const res = await request(newApp).post('/api/vendor-management/vendors')
    .set('Authorization', admin.auth)
    .send({ name: 'Brand New Vendor', type: 'Wholesaler' });

  assert.equal(res.status, 400, 'new records must use the current vocabulary');
});
