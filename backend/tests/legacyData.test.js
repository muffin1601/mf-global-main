// Does the new module correctly handle vendors that already exist in the
// production database — i.e. documents written by the OLD schema, which have
// no isArchived flag, no status, and none of the normalized shadow fields?
//
// These are inserted through the raw driver so no Mongoose default is applied,
// which is exactly how the existing rows look on disk.

const test = require('node:test');
const assert = require('node:assert/strict');
const request = require('supertest');
const mongoose = require('mongoose');

const { start, stop, resetCollections, buildApp, createUser } = require('./helpers/testApp');
const Vendor = require('../models/VendorData');

const BASE = '/api/vendor-management';
let app;
let admin;

// A vendor exactly as the previous schema stored it.
const insertLegacyVendor = async (overrides = {}) => {
  const raw = {
    v_code: 'VL001',
    name: 'Legacy Supplier Pvt Ltd',
    contact_name: 'Old Contact',
    phone: '9811100011',
    email: 'legacy@supplier.test',
    type: 'Trader',
    cat_id: 'CT001',
    products: ['Bolts'],
    addr1: '12 Old Road',
    city: 'Pune',
    state: 'Maharashtra',
    pin_code: '411001',
    ...overrides,
  };
  await mongoose.connection.collection('vendors').insertOne(raw);
  return raw;
};

test.before(async () => {
  await start();
  app = buildApp();
});

test.after(async () => { await stop(); });

test.beforeEach(async () => {
  await resetCollections();
  admin = await createUser({ role: 'admin' });
});

test('legacy vendors are still returned by the list endpoint', async () => {
  await insertLegacyVendor();

  const res = await request(app).get(`${BASE}/vendors`).set('Authorization', admin.auth);

  assert.equal(res.status, 200);
  assert.equal(res.body.total, 1, 'a pre-existing vendor must not vanish from the list');
  assert.equal(res.body.vendors[0].name, 'Legacy Supplier Pvt Ltd');
});

test('legacy vendors are counted in the dashboard summary', async () => {
  await insertLegacyVendor();

  const res = await request(app).get(`${BASE}/vendors/summary`).set('Authorization', admin.auth);
  assert.equal(res.body.summary.total, 1);
});

// Duplicate detection matches on the normalized shadow fields, which legacy
// documents do not have. That is what scripts/migrateVendors.js backfills, so
// these tests run the migration's logic first — proving the script closes the
// gap rather than assuming it.
const backfillNormalizedFields = async () => {
  const {
    normalizeCompanyName, normalizeCode, normalizeEmail, normalizePhone,
  } = require('../utils/vendorFields');
  const col = mongoose.connection.collection('vendors');
  const docs = await col.find({}).toArray();
  for (const doc of docs) {
    // eslint-disable-next-line no-await-in-loop
    await col.updateOne({ _id: doc._id }, {
      $set: {
        isArchived: doc.isArchived ?? false,
        status: doc.status || 'Pending',
        priority: doc.priority || 'Medium',
        nameNorm: normalizeCompanyName(doc.name),
        gstinNorm: normalizeCode(doc.gstin),
        panNorm: normalizeCode(doc.pan),
        emailNorm: normalizeEmail(doc.email),
        phoneNorm: normalizePhone(doc.phone),
      },
    });
  }
};

test('BEFORE migration, duplicate detection cannot see legacy vendors', async () => {
  await insertLegacyVendor();

  const res = await request(app).post(`${BASE}/vendors/check-duplicates`)
    .set('Authorization', admin.auth)
    .send({ name: '  legacy   SUPPLIER pvt. ltd.  ' });

  // Documents the gap the migration exists to close.
  assert.equal([...res.body.blocking, ...res.body.warnings].length, 0);
});

test('AFTER migration, duplicate detection sees legacy vendors', async () => {
  await insertLegacyVendor();
  await backfillNormalizedFields();

  const res = await request(app).post(`${BASE}/vendors/check-duplicates`)
    .set('Authorization', admin.auth)
    .send({ name: '  legacy   SUPPLIER pvt. ltd.  ' });

  assert.equal(res.status, 200);
  assert.equal(
    [...res.body.blocking, ...res.body.warnings].length, 1,
    'a pre-existing vendor must be matched once the migration has run'
  );
});

test('AFTER migration, a duplicate GSTIN on a legacy vendor is blocked', async () => {
  await insertLegacyVendor({ gstin: '27AAPFU0939F1ZV' });
  await backfillNormalizedFields();

  const res = await request(app).post(`${BASE}/vendors`).set('Authorization', admin.auth)
    .send({ name: 'Totally Different Name', gstin: '27AAPFU0939F1ZV' });

  assert.equal(res.status, 409, 'a duplicate GSTIN on a legacy vendor must block');
});

test('AFTER migration, legacy vendors carry a status the dashboard can count', async () => {
  await insertLegacyVendor();
  await backfillNormalizedFields();

  const res = await request(app).get(`${BASE}/vendors/summary`).set('Authorization', admin.auth);
  assert.equal(res.body.summary.total, 1);
  assert.equal(res.body.summary.byStatus.Pending, 1);
});

test('a legacy vendor can be opened and edited', async () => {
  await insertLegacyVendor();
  const doc = await mongoose.connection.collection('vendors').findOne({ v_code: 'VL001' });

  const detail = await request(app).get(`${BASE}/vendors/${doc._id}`).set('Authorization', admin.auth);
  assert.equal(detail.status, 200);

  const update = await request(app).put(`${BASE}/vendors/${doc._id}`)
    .set('Authorization', admin.auth).send({ industry: 'Hardware' });
  assert.equal(update.status, 200, 'editing an existing vendor must not fail validation');
});

test('a legacy vendor with no name can still be listed and repaired', async () => {
  // The old schema did not require a name, so blank ones may exist.
  await insertLegacyVendor({ name: undefined, v_code: 'VL002' });

  const res = await request(app).get(`${BASE}/vendors`).set('Authorization', admin.auth);
  assert.equal(res.status, 200);
  assert.equal(res.body.total, 1);
});

test('the vendor code counter does not reissue a code an existing vendor holds', async () => {
  await insertLegacyVendor({ v_code: 'VL001' });
  await insertLegacyVendor({ v_code: 'VL002', name: 'Legacy Two' });
  await insertLegacyVendor({ v_code: 'VL003', name: 'Legacy Three' });

  const created = await Vendor.create({ name: 'Lima New Vendor' });
  assert.equal(created.v_code, 'VL004', 'must continue the existing sequence, not collide with it');
});
