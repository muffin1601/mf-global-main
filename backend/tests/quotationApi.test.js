// Quotation lifecycle integration tests. Uses an isolated in-memory database.

const test = require('node:test');
const assert = require('node:assert/strict');
const express = require('express');
const request = require('supertest');

const { start, stop, resetCollections, createUser } = require('./helpers/testApp');
const Quotation = require('../models/Quote');

let app;
let admin;
let owner;
let outsider;

const payload = (overrides = {}) => ({
  party: { name: 'Buyer One', company: 'Buyer Co' },
  items: [
    { name: 'Service A', qty: 2, price: 100.10, discount: 10, tax: 18 },
    { name: 'Service B', qty: 1, price: 50, discount: 0, tax: 5 },
  ],
  invoiceDetails: { prefix: 'MF/Q/', number: 'FORGED', date: '2026-10-16' },
  summary: {
    discount: 5,
    discountType: '%',
    additionalCharges: 10,
    autoRoundOff: true,
    roundOffSign: '+',
    roundOffAmount: 0.25,
    amountReceived: 100,
  },
  terms: 'Test terms',
  ...overrides,
});

test.before(async () => {
  await start();
  app = express();
  app.use(express.json());
  app.use('/api/quotations', require('../routes/quotation'));
});

test.after(stop);

test.beforeEach(async () => {
  await resetCollections();
  admin = await createUser({ role: 'admin', name: 'Quote Admin' });
  owner = await createUser({ role: 'user', name: 'Quote Owner' });
  outsider = await createUser({ role: 'user', name: 'Quote Outsider' });
});

test('create validates content, assigns the owner and computes authoritative decimal-safe totals', async () => {
  const res = await request(app).post('/api/quotations/create')
    .set('Authorization', owner.auth)
    .send(payload());

  assert.equal(res.status, 201);
  assert.equal(String(res.body.user), String(owner.user._id));
  assert.notEqual(res.body.invoiceDetails.number, 'FORGED');
  assert.deepEqual(res.body.totals, {
    subtotal: 230.18,
    totalTax: 34.93,
    totalDiscount: 11.51,
    additionalCharges: 10,
    roundOff: 0.25,
    grandTotal: 263.85,
    amountReceived: 100,
    balanceAmount: 163.85,
  });
});

test('invalid and negative quotation values are rejected or normalized safely', async () => {
  const missing = await request(app).post('/api/quotations/create')
    .set('Authorization', owner.auth).send(payload({ items: [] }));
  assert.equal(missing.status, 400);

  const negative = await request(app).post('/api/quotations/create')
    .set('Authorization', owner.auth)
    .send(payload({ items: [{ name: 'Bad', qty: -1, price: 2 }] }));
  assert.equal(negative.status, 400);
});

test('edit updates in place, keeps number and owner, and blocks another user', async () => {
  const created = await request(app).post('/api/quotations/create')
    .set('Authorization', owner.auth).send(payload());
  const id = created.body._id;
  const issuedNumber = created.body.invoiceDetails.number;

  const forbidden = await request(app).put(`/api/quotations/update/${id}`)
    .set('Authorization', outsider.auth).send(payload());
  assert.equal(forbidden.status, 403);

  const updated = await request(app).put(`/api/quotations/update/${id}`)
    .set('Authorization', owner.auth)
    .send(payload({
      items: [{ name: 'Revised', qty: 3, price: 20, discount: 0, tax: 0 }],
      invoiceDetails: { prefix: 'HACK/', number: '999' },
      summary: { discount: 0, discountType: '%', additionalCharges: 0 },
    }));
  assert.equal(updated.status, 200);
  assert.equal(await Quotation.countDocuments(), 1);
  assert.equal(updated.body.invoiceDetails.number, issuedNumber);
  assert.equal(updated.body.invoiceDetails.prefix, 'MF/Q/');
  assert.equal(updated.body.totals.grandTotal, 60);
});

test('fetch and list enforce ownership, while admins can paginate all quotations', async () => {
  const created = await request(app).post('/api/quotations/create')
    .set('Authorization', owner.auth).send(payload());

  await request(app).get(`/api/quotations/fetch/${created.body._id}`)
    .set('Authorization', outsider.auth).expect(403);
  await request(app).get('/api/quotations/fetch/not-an-id')
    .set('Authorization', owner.auth).expect(400);
  await request(app).get(`/api/quotations/data/user/${owner.user._id}`)
    .set('Authorization', outsider.auth).expect(403);
  await request(app).get('/api/quotations/data/count')
    .set('Authorization', owner.auth).expect(403);

  const all = await request(app).get('/api/quotations/data/count?page=1&limit=1')
    .set('Authorization', admin.auth);
  assert.equal(all.status, 200);
  assert.equal(all.body.count, 1);
  assert.equal(all.body.quotations.length, 1);
});

test('concurrent quotation creation issues unique numbers', async () => {
  const results = await Promise.all(Array.from({ length: 12 }, () => request(app)
    .post('/api/quotations/create')
    .set('Authorization', owner.auth)
    .send(payload())));
  assert.ok(results.every((res) => res.status === 201));
  const numbers = results.map((res) => res.body.invoiceDetails.number);
  assert.equal(new Set(numbers).size, numbers.length);
  assert.equal(await Quotation.countDocuments(), 12);
});
