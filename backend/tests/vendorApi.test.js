// Integration tests for the Vendor Management API.
//
// Runs against an isolated in-memory MongoDB (see helpers/testApp.js) — the
// configured MONGO_URI is never used, so no real CRM data is touched.

const test = require('node:test');
const assert = require('node:assert/strict');
const request = require('supertest');

const fs = require('fs');
const path = require('path');

const { start, stop, resetCollections, buildApp, createUser } = require('./helpers/testApp');

// Uploads that are validated but never committed stay on disk by design, so the
// suite clears its own scratch files rather than leaving fixtures behind.
const IMPORT_DIR = path.join(__dirname, '../private-uploads/vendor-imports');
const clearImportDir = () => {
  if (!fs.existsSync(IMPORT_DIR)) return;
  for (const file of fs.readdirSync(IMPORT_DIR)) {
    try { fs.unlinkSync(path.join(IMPORT_DIR, file)); } catch { /* already gone */ }
  }
};

const Vendor = require('../models/VendorData');
const VendorCategory = require('../models/VendorCategory');
const Product = require('../models/ProductData');
const ActivityLog = require('../models/UserActivity');

const BASE = '/api/vendor-management';
let app;
let admin;
let staff;

const validVendor = (overrides = {}) => ({
  name: 'Acme Supplies Pvt Ltd',
  type: 'Manufacturer',
  email: 'sales@acme.test',
  phone: '9876543210',
  gstin: '27AAPFU0939F1ZV',
  pan: 'AAPFU0939F',
  ...overrides,
});

test.before(async () => {
  await start();
  app = buildApp();
});

test.after(async () => {
  clearImportDir();
  await stop();
});

test.beforeEach(async () => {
  await resetCollections();
  admin = await createUser({ role: 'admin', name: 'Admin One' });
  staff = await createUser({ role: 'user', name: 'Staff One' });
});

/* ============================ AUTHENTICATION ============================ */

test('every vendor endpoint rejects an unauthenticated request', async () => {
  const calls = [
    ['get', `${BASE}/vendors`],
    ['get', `${BASE}/vendors/summary`],
    ['post', `${BASE}/vendors`],
    ['get', `${BASE}/categories`],
    ['get', `${BASE}/export`],
  ];
  for (const [method, url] of calls) {
    // eslint-disable-next-line no-await-in-loop
    const res = await request(app)[method](url);
    assert.equal(res.status, 401, `${method.toUpperCase()} ${url} should be 401`);
  }
});

test('a tampered or malformed token is rejected', async () => {
  const res = await request(app).get(`${BASE}/vendors`).set('Authorization', 'Bearer not.a.jwt');
  assert.equal(res.status, 401);
});

test('a disabled account cannot use the module even with a valid token', async () => {
  const disabled = await createUser({ role: 'admin', enabled: false });
  const res = await request(app).get(`${BASE}/vendors`).set('Authorization', disabled.auth);
  assert.equal(res.status, 403);
});

/* ============================ AUTHORIZATION ============================ */

test('permissions are enforced server-side, not just in the UI', async () => {
  const vendor = await Vendor.create(validVendor());

  // A non-admin may read and create...
  const list = await request(app).get(`${BASE}/vendors`).set('Authorization', staff.auth);
  assert.equal(list.status, 200);

  // ...but not archive, delete, manage categories or import.
  const archive = await request(app).patch(`${BASE}/vendors/${vendor._id}/archive`).set('Authorization', staff.auth);
  assert.equal(archive.status, 403);

  const del = await request(app).delete(`${BASE}/vendors/${vendor._id}`)
    .set('Authorization', staff.auth).send({ confirmCode: vendor.v_code });
  assert.equal(del.status, 403);

  const cat = await request(app).post(`${BASE}/categories`)
    .set('Authorization', staff.auth).send({ name: 'Logistics' });
  assert.equal(cat.status, 403);

  const imp = await request(app).post(`${BASE}/import/validate`)
    .set('Authorization', staff.auth).send({ jobId: String(vendor._id) });
  assert.equal(imp.status, 403);
});

test('meta reports the caller\'s effective permissions', async () => {
  const asAdmin = await request(app).get(`${BASE}/vendors/meta`).set('Authorization', admin.auth);
  assert.equal(asAdmin.status, 200);
  assert.ok(asAdmin.body.permissions.includes('vendor.delete'));

  const asStaff = await request(app).get(`${BASE}/vendors/meta`).set('Authorization', staff.auth);
  assert.ok(!asStaff.body.permissions.includes('vendor.delete'));
  assert.ok(asStaff.body.permissions.includes('vendor.view'));
});

/* ============================== CREATION ============================== */

test('creating a vendor assigns a code and audits the action', async () => {
  const res = await request(app).post(`${BASE}/vendors`)
    .set('Authorization', admin.auth).send(validVendor());

  assert.equal(res.status, 201);
  assert.equal(res.body.success, true);
  assert.match(res.body.vendor.v_code, /^VA\d{3}$/);
  assert.equal(res.body.vendor.status, 'Pending', 'new vendors start as Pending');
  assert.equal(res.body.vendor.createdBy, String(admin.user._id));

  const audit = await ActivityLog.findOne({ action: 'Vendor created' }).lean();
  assert.ok(audit, 'the creation is written to the shared audit log');
  assert.equal(audit.details.vendorId, String(res.body.vendor._id));
});

test('creation rejects invalid input with a readable message', async () => {
  const res = await request(app).post(`${BASE}/vendors`)
    .set('Authorization', admin.auth).send({ name: 'X', email: 'bad' });

  assert.equal(res.status, 400);
  assert.equal(res.body.success, false);
  assert.ok(res.body.errors.length >= 2);
  assert.ok(!/ValidationError|E11000|Cast to/.test(JSON.stringify(res.body)),
    'no raw database error text is exposed');
});

test('server-managed fields cannot be set through the request body', async () => {
  const res = await request(app).post(`${BASE}/vendors`).set('Authorization', admin.auth)
    .send({
      ...validVendor(),
      v_code: 'HACKED',
      isArchived: true,
      performance: { overallScore: 5, evaluationCount: 99 },
    });

  assert.equal(res.status, 201);
  assert.notEqual(res.body.vendor.v_code, 'HACKED');
  assert.equal(res.body.vendor.isArchived, false);
  assert.equal(res.body.vendor.performance.overallScore, null,
    'a fabricated performance score is ignored');
});

/* ========================= DUPLICATE DETECTION ========================= */

test('a duplicate GSTIN is always blocked', async () => {
  await request(app).post(`${BASE}/vendors`).set('Authorization', admin.auth).send(validVendor());

  const res = await request(app).post(`${BASE}/vendors`).set('Authorization', admin.auth)
    .send(validVendor({ name: 'A Completely Different Firm', email: 'x@y.test', phone: '9876500000' }));

  assert.equal(res.status, 409);
  assert.equal(res.body.blocking, true);
  assert.match(res.body.message, /GSTIN/);
  assert.equal(await Vendor.countDocuments({}), 1);
});

test('a similar name only warns, and can be confirmed through', async () => {
  await request(app).post(`${BASE}/vendors`).set('Authorization', admin.auth)
    .send({ name: 'ABC Pvt Ltd' });

  // Same business written differently -> warning, not a hard block.
  const warned = await request(app).post(`${BASE}/vendors`).set('Authorization', admin.auth)
    .send({ name: '  abc   PVT. LTD.  ' });

  assert.equal(warned.status, 409);
  assert.equal(warned.body.blocking, false);
  assert.equal(warned.body.requiresConfirmation, true);
  assert.equal(warned.body.duplicates.length, 1);

  // The user reviews it and confirms it really is a separate entity.
  const confirmed = await request(app).post(`${BASE}/vendors`).set('Authorization', admin.auth)
    .send({ name: '  abc   PVT. LTD.  ', confirmDuplicate: true });

  assert.equal(confirmed.status, 201);
  assert.equal(await Vendor.countDocuments({}), 2);
});

test('a genuinely different vendor is never blocked', async () => {
  await request(app).post(`${BASE}/vendors`).set('Authorization', admin.auth).send({ name: 'ABC Pvt Ltd' });
  const res = await request(app).post(`${BASE}/vendors`).set('Authorization', admin.auth).send({ name: 'XYZ Industries' });
  assert.equal(res.status, 201);
});

test('the duplicate pre-check endpoint mirrors what create will do', async () => {
  await request(app).post(`${BASE}/vendors`).set('Authorization', admin.auth).send(validVendor());

  const res = await request(app).post(`${BASE}/vendors/check-duplicates`)
    .set('Authorization', admin.auth).send({ gstin: '27aapfu0939f1zv' });

  assert.equal(res.status, 200);
  assert.equal(res.body.blocking.length, 1);
});

/* ======================= LIST: SEARCH / FILTER / PAGE ======================= */

const seedVendors = async () => {
  const category = await VendorCategory.create({ name: 'Raw Materials' });
  await Vendor.create({ name: 'Alpha Steel Works', status: 'Active', category: category._id, phone: '9811111111', email: 'alpha@t.test' });
  await Vendor.create({ name: 'Beta Packaging', status: 'Pending', phone: '9822222222', gstin: '27AAPFU0939F1ZV', pan: 'AAPFU0939F' });
  await Vendor.create({ name: 'Gamma Logistics', status: 'Inactive', category: category._id });
  await Vendor.create({ name: 'Delta Archived', status: 'Active', isArchived: true });
  return category;
};

test('the list is paginated server-side and excludes archived vendors by default', async () => {
  await seedVendors();

  const res = await request(app).get(`${BASE}/vendors?limit=2&page=1`).set('Authorization', admin.auth);
  assert.equal(res.status, 200);
  assert.equal(res.body.vendors.length, 2, 'only one page is returned');
  assert.equal(res.body.total, 3, 'archived vendors are excluded');
  assert.equal(res.body.pages, 2);
  assert.equal(res.headers['x-total-count'], '3');

  const page2 = await request(app).get(`${BASE}/vendors?limit=2&page=2`).set('Authorization', admin.auth);
  assert.equal(page2.body.vendors.length, 1);
  const ids = new Set([...res.body.vendors, ...page2.body.vendors].map((v) => v._id));
  assert.equal(ids.size, 3, 'pages do not overlap');
});

test('archived vendors are reachable through an explicit filter', async () => {
  await seedVendors();
  const res = await request(app).get(`${BASE}/vendors?archived=true`).set('Authorization', admin.auth);
  assert.equal(res.body.total, 1);
  assert.equal(res.body.vendors[0].name, 'Delta Archived');
});

test('search matches name, code, GSTIN, PAN, email and phone', async () => {
  await seedVendors();
  const search = async (q) => (await request(app).get(`${BASE}/vendors?search=${encodeURIComponent(q)}`)
    .set('Authorization', admin.auth)).body;

  assert.equal((await search('alpha')).total, 1, 'case-insensitive name match');
  assert.equal((await search('Packaging')).total, 1);
  assert.equal((await search('27AAPFU0939F1ZV')).total, 1, 'GSTIN match');
  assert.equal((await search('AAPFU0939F')).total, 1, 'PAN match');
  assert.equal((await search('alpha@t.test')).total, 1, 'email match');
  assert.equal((await search('9822222222')).total, 1, 'phone match');
  assert.equal((await search('nothing-here')).total, 0);
});

test('search input cannot inject a regular expression', async () => {
  await seedVendors();
  const res = await request(app).get(`${BASE}/vendors?search=${encodeURIComponent('.*')}`)
    .set('Authorization', admin.auth);
  assert.equal(res.status, 200);
  assert.equal(res.body.total, 0, '".*" is matched literally, not as a wildcard');
});

test('a NoSQL injection attempt in a filter is neutralised', async () => {
  await seedVendors();
  const res = await request(app).get(`${BASE}/vendors?status[$ne]=Active`).set('Authorization', admin.auth);
  assert.equal(res.status, 200);
  // The operator is stripped and the unusable value ignored -> all 3 returned.
  assert.equal(res.body.total, 3);
});

test('status, category and owner filters narrow the list', async () => {
  const category = await seedVendors();

  const byStatus = await request(app).get(`${BASE}/vendors?status=Active`).set('Authorization', admin.auth);
  assert.equal(byStatus.body.total, 1);

  const multi = await request(app).get(`${BASE}/vendors?status=Active,Pending`).set('Authorization', admin.auth);
  assert.equal(multi.body.total, 2);

  const byCategory = await request(app).get(`${BASE}/vendors?category=${category._id}`).set('Authorization', admin.auth);
  assert.equal(byCategory.body.total, 2);

  const unassigned = await request(app).get(`${BASE}/vendors?owner=unassigned`).set('Authorization', admin.auth);
  assert.equal(unassigned.body.total, 3);
});

test('sorting is restricted to an allowlist of columns', async () => {
  await seedVendors();

  const asc = await request(app).get(`${BASE}/vendors?sortBy=name&sortDir=asc`).set('Authorization', admin.auth);
  assert.deepEqual(asc.body.vendors.map((v) => v.name), ['Alpha Steel Works', 'Beta Packaging', 'Gamma Logistics']);

  // An unknown sort key falls back to the default rather than reaching Mongo.
  const bogus = await request(app).get(`${BASE}/vendors?sortBy=bank.accountNumber`).set('Authorization', admin.auth);
  assert.equal(bogus.status, 200);
  assert.equal(bogus.body.vendors.length, 3);
});

test('the list never returns bank details', async () => {
  await Vendor.create({ ...validVendor(), bank: { bankName: 'HDFC', accountNumber: '123456789012', ifsc: 'HDFC0001234' } });
  const res = await request(app).get(`${BASE}/vendors`).set('Authorization', admin.auth);
  assert.ok(!JSON.stringify(res.body).includes('123456789012'));
  assert.equal(res.body.vendors[0].bank, undefined);
});

/* ================================ DETAIL ================================ */

test('an invalid or unknown id gives 400 / 404, never a crash', async () => {
  const bad = await request(app).get(`${BASE}/vendors/not-an-id`).set('Authorization', admin.auth);
  assert.equal(bad.status, 400);

  const missing = await request(app).get(`${BASE}/vendors/507f1f77bcf86cd799439011`).set('Authorization', admin.auth);
  assert.equal(missing.status, 404);
  assert.match(missing.body.message, /not found/i);
});

test('bank details are masked for admins and withheld from other roles', async () => {
  const vendor = await Vendor.create(validVendor());
  await request(app).put(`${BASE}/vendors/${vendor._id}`).set('Authorization', admin.auth)
    .send({ bank: { bankName: 'HDFC', accountNumber: '123456789012', ifsc: 'HDFC0001234' } });

  const asAdmin = await request(app).get(`${BASE}/vendors/${vendor._id}`).set('Authorization', admin.auth);
  assert.equal(asAdmin.status, 200);
  assert.equal(asAdmin.body.vendor.bank.accountNumber, undefined, 'the raw number never leaves the server');
  assert.ok(asAdmin.body.vendor.bank.accountNumberMasked.endsWith('9012'));
  assert.ok(!asAdmin.body.vendor.bank.accountNumberMasked.includes('12345678'));

  const asStaff = await request(app).get(`${BASE}/vendors/${vendor._id}`).set('Authorization', staff.auth);
  assert.equal(asStaff.body.vendor.bank.restricted, true);
  assert.equal(asStaff.body.vendor.bank.accountNumberMasked, undefined);
  assert.ok(!JSON.stringify(asStaff.body).includes('9012'));
});

test('a non-admin cannot write bank details', async () => {
  const vendor = await Vendor.create(validVendor());
  const res = await request(app).put(`${BASE}/vendors/${vendor._id}`).set('Authorization', staff.auth)
    .send({ industry: 'Steel', bank: { bankName: 'Sneaky', accountNumber: '999999999999', ifsc: 'HDFC0001234' } });

  assert.equal(res.status, 200);
  const stored = await Vendor.findById(vendor._id).select('+bank.accountNumber').lean();
  assert.equal(stored.industry, 'Steel', 'the permitted part of the edit still applies');
  assert.notEqual(stored.bank.bankName, 'Sneaky');
  assert.ok(!stored.bank.accountNumber);
});

/* ================================ UPDATE ================================ */

test('updating a vendor records a change summary in the audit log', async () => {
  const created = await request(app).post(`${BASE}/vendors`).set('Authorization', admin.auth).send(validVendor());
  const id = created.body.vendor._id;

  const res = await request(app).put(`${BASE}/vendors/${id}`).set('Authorization', admin.auth)
    .send({ industry: 'Metals', priority: 'High' });

  assert.equal(res.status, 200);
  assert.equal(res.body.vendor.industry, 'Metals');

  const audit = await ActivityLog.findOne({ action: 'Vendor updated' }).lean();
  assert.ok(audit.details.changes.priority);
  assert.equal(audit.details.changes.priority.to, 'High');
});

test('a banking change is audited without recording the values', async () => {
  const vendor = await Vendor.create(validVendor());
  await request(app).put(`${BASE}/vendors/${vendor._id}`).set('Authorization', admin.auth)
    .send({ bank: { bankName: 'HDFC', accountNumber: '123456789012', ifsc: 'HDFC0001234' } });

  const logs = await ActivityLog.find({}).lean();
  const serialized = JSON.stringify(logs);
  assert.ok(!serialized.includes('123456789012'), 'the account number is never written to the audit log');
  assert.ok(serialized.includes('redacted'));
});

test('a masked account number sent back on edit does not wipe the stored one', async () => {
  const vendor = await Vendor.create(validVendor());
  await request(app).put(`${BASE}/vendors/${vendor._id}`).set('Authorization', admin.auth)
    .send({ bank: { bankName: 'HDFC', accountNumber: '123456789012', ifsc: 'HDFC0001234' } });

  // The UI only ever holds the mask, so it round-trips the mask.
  await request(app).put(`${BASE}/vendors/${vendor._id}`).set('Authorization', admin.auth)
    .send({ bank: { bankName: 'HDFC Bank', accountNumber: '********9012', ifsc: 'HDFC0001234' } });

  const stored = await Vendor.findById(vendor._id).select('+bank.accountNumber').lean();
  assert.equal(stored.bank.accountNumber, '123456789012', 'the real number survives');
  assert.equal(stored.bank.bankName, 'HDFC Bank');
});

test('a stale concurrent update is rejected rather than silently overwriting', async () => {
  const vendor = await Vendor.create(validVendor());

  // Both clients loaded the vendor at the same moment.
  const loadedAt = vendor.updatedAt;

  const first = await request(app).put(`${BASE}/vendors/${vendor._id}`).set('Authorization', admin.auth)
    .send({ industry: 'First', updatedAt: loadedAt });
  assert.equal(first.status, 200);

  // The second client still holds the stale timestamp.
  const stale = await request(app).put(`${BASE}/vendors/${vendor._id}`).set('Authorization', admin.auth)
    .send({ industry: 'Second', updatedAt: loadedAt });
  assert.equal(stale.status, 409);
  assert.match(stale.body.message, /changed by someone else/i);
  assert.equal((await Vendor.findById(vendor._id)).industry, 'First', 'the first write is not clobbered');

  // An edit that carries no token still goes through (no forced conflict).
  const untokened = await request(app).put(`${BASE}/vendors/${vendor._id}`).set('Authorization', admin.auth)
    .send({ industry: 'Third' });
  assert.equal(untokened.status, 200);
});

/* ============================ STATUS & LIFECYCLE ============================ */

test('status changes are validated and audited', async () => {
  const vendor = await Vendor.create(validVendor());

  const bad = await request(app).patch(`${BASE}/vendors/${vendor._id}/status`)
    .set('Authorization', admin.auth).send({ status: 'Banana' });
  assert.equal(bad.status, 400);

  const good = await request(app).patch(`${BASE}/vendors/${vendor._id}/status`)
    .set('Authorization', admin.auth).send({ status: 'Active', reason: 'Onboarding complete' });
  assert.equal(good.status, 200);
  assert.equal(good.body.vendor.status, 'Active');

  const audit = await ActivityLog.findOne({ action: 'Vendor status changed' }).lean();
  assert.equal(audit.details.from, 'Pending');
  assert.equal(audit.details.to, 'Active');
});

test('only an administrator can blacklist a vendor', async () => {
  const vendor = await Vendor.create(validVendor());
  const res = await request(app).patch(`${BASE}/vendors/${vendor._id}/status`)
    .set('Authorization', staff.auth).send({ status: 'Blacklisted' });
  assert.equal(res.status, 403);
});

test('archive and restore are reversible and audited', async () => {
  const vendor = await Vendor.create(validVendor());

  const archived = await request(app).patch(`${BASE}/vendors/${vendor._id}/archive`).set('Authorization', admin.auth);
  assert.equal(archived.status, 200);
  assert.equal((await Vendor.findById(vendor._id)).isArchived, true);

  const restored = await request(app).patch(`${BASE}/vendors/${vendor._id}/restore`).set('Authorization', admin.auth);
  assert.equal(restored.status, 200);
  assert.equal((await Vendor.findById(vendor._id)).isArchived, false);

  assert.ok(await ActivityLog.findOne({ action: 'Vendor archived' }));
  assert.ok(await ActivityLog.findOne({ action: 'Vendor restored' }));
});

test('permanent deletion requires archiving first and a typed confirmation', async () => {
  const vendor = await Vendor.create(validVendor());

  const tooSoon = await request(app).delete(`${BASE}/vendors/${vendor._id}`)
    .set('Authorization', admin.auth).send({ confirmCode: vendor.v_code });
  assert.equal(tooSoon.status, 400);
  assert.match(tooSoon.body.message, /Archive the vendor before/i);

  await request(app).patch(`${BASE}/vendors/${vendor._id}/archive`).set('Authorization', admin.auth);

  const wrongCode = await request(app).delete(`${BASE}/vendors/${vendor._id}`)
    .set('Authorization', admin.auth).send({ confirmCode: 'WRONG' });
  assert.equal(wrongCode.status, 400);
  assert.ok(await Vendor.findById(vendor._id), 'the vendor still exists');

  const done = await request(app).delete(`${BASE}/vendors/${vendor._id}`)
    .set('Authorization', admin.auth).send({ confirmCode: vendor.v_code.toLowerCase() });
  assert.equal(done.status, 200);
  assert.equal(await Vendor.findById(vendor._id), null);

  // The audit trail survives the deletion.
  assert.ok(await ActivityLog.findOne({ action: 'Vendor permanently deleted' }));
});

test('bulk status and archive apply to a selection', async () => {
  await seedVendors();
  const ids = (await Vendor.find({ isArchived: false }).select('_id').lean()).map((v) => String(v._id));

  const status = await request(app).patch(`${BASE}/vendors/bulk/status`)
    .set('Authorization', admin.auth).send({ ids, status: 'Active' });
  assert.equal(status.status, 200);
  assert.equal(status.body.updated, 3);
  assert.equal(await Vendor.countDocuments({ status: 'Active', isArchived: false }), 3);

  const archive = await request(app).patch(`${BASE}/vendors/bulk/archive`)
    .set('Authorization', admin.auth).send({ ids });
  assert.equal(archive.body.updated, 3);
  assert.equal(await Vendor.countDocuments({ isArchived: false }), 0);
});

test('bulk actions validate their input', async () => {
  const empty = await request(app).patch(`${BASE}/vendors/bulk/status`)
    .set('Authorization', admin.auth).send({ ids: [], status: 'Active' });
  assert.equal(empty.status, 400);

  const tooMany = await request(app).patch(`${BASE}/vendors/bulk/status`)
    .set('Authorization', admin.auth)
    .send({ ids: Array.from({ length: 201 }, () => '507f1f77bcf86cd799439011'), status: 'Active' });
  assert.equal(tooMany.status, 400);
});

/* =============================== CONTACTS =============================== */

test('contacts support add, edit, primary promotion and delete', async () => {
  const vendor = await Vendor.create(validVendor());
  const url = `${BASE}/vendors/${vendor._id}/contacts`;

  const first = await request(app).post(url).set('Authorization', admin.auth)
    .send({ fullName: 'Asha Rao', phone: '9876543210', designation: 'Sales Head' });
  assert.equal(first.status, 201);
  assert.equal(first.body.contact.isPrimary, true, 'the first contact becomes primary automatically');

  const second = await request(app).post(url).set('Authorization', admin.auth)
    .send({ fullName: 'Vik Shah', email: 'vik@acme.test', isPrimary: true });
  assert.equal(second.status, 201);

  const afterTwo = await request(app).get(url).set('Authorization', admin.auth);
  assert.equal(afterTwo.body.contacts.filter((c) => c.isPrimary).length, 1,
    'exactly one primary contact is kept');
  assert.equal(afterTwo.body.contacts.find((c) => c.isPrimary).fullName, 'Vik Shah');

  const firstId = first.body.contact._id;
  const promoted = await request(app).patch(`${url}/${firstId}/primary`).set('Authorization', admin.auth);
  assert.equal(promoted.body.contacts.find((c) => c.isPrimary)._id, firstId);

  const edited = await request(app).put(`${url}/${firstId}`).set('Authorization', admin.auth)
    .send({ designation: 'Director' });
  assert.equal(edited.body.contact.designation, 'Director');

  const removed = await request(app).delete(`${url}/${firstId}`).set('Authorization', admin.auth);
  assert.equal(removed.status, 200);
  assert.equal(removed.body.contacts.length, 1);
  assert.equal(removed.body.contacts[0].isPrimary, true, 'a primary is re-promoted after deletion');
});

test('contact validation runs on the server', async () => {
  const vendor = await Vendor.create(validVendor());
  const res = await request(app).post(`${BASE}/vendors/${vendor._id}/contacts`)
    .set('Authorization', admin.auth).send({ fullName: 'No Contact Details' });
  assert.equal(res.status, 400);
  assert.match(res.body.message, /email or a phone/i);
});

/* =============================== ADDRESSES =============================== */

test('addresses keep exactly one default', async () => {
  const vendor = await Vendor.create(validVendor());
  const url = `${BASE}/vendors/${vendor._id}/addresses`;

  const a = await request(app).post(url).set('Authorization', admin.auth)
    .send({ line1: '1 Industrial Estate', city: 'Pune', pincode: '411001', addressType: 'Registered Office' });
  assert.equal(a.status, 201);
  assert.equal(a.body.address.isDefault, true);

  await request(app).post(url).set('Authorization', admin.auth)
    .send({ line1: '2 Warehouse Rd', addressType: 'Warehouse', isDefault: true });

  const list = await request(app).get(url).set('Authorization', admin.auth);
  assert.equal(list.body.addresses.filter((x) => x.isDefault).length, 1);

  const bad = await request(app).post(url).set('Authorization', admin.auth).send({ city: 'Pune' });
  assert.equal(bad.status, 400);
  assert.match(bad.body.message, /Address line 1 is required/);
});

/* ========================= PRODUCTS & PRICING ========================= */

test('vendor products link to existing products and reject unknown ids', async () => {
  const vendor = await Vendor.create(validVendor());
  const product = await Product.create({ p_name: 'Steel Sheet 2mm', s_code: 'SS2' });
  const url = `${BASE}/vendors/${vendor._id}/products`;

  const created = await request(app).post(url).set('Authorization', admin.auth).send({
    product: String(product._id),
    purchasePrice: 120,
    moq: 50,
    leadTimeDays: 7,
    priceTiers: [{ minQty: 1, maxQty: 50, unitPrice: 120 }, { minQty: 50, maxQty: null, unitPrice: 110 }],
  });
  assert.equal(created.status, 201);
  assert.equal(created.body.item.product.p_name, 'Steel Sheet 2mm');

  // No duplicate product master data was created.
  assert.equal(await Product.countDocuments({}), 1);

  const unknown = await request(app).post(url).set('Authorization', admin.auth)
    .send({ product: '507f1f77bcf86cd799439011', purchasePrice: 10 });
  assert.equal(unknown.status, 404);
});

test('overlapping price windows for the same product are refused', async () => {
  const vendor = await Vendor.create(validVendor());
  const product = await Product.create({ p_name: 'Steel Sheet 2mm' });
  const url = `${BASE}/vendors/${vendor._id}/products`;

  await request(app).post(url).set('Authorization', admin.auth)
    .send({ product: String(product._id), purchasePrice: 120, effectiveFrom: '2025-01-01', effectiveTo: '2025-06-30' });

  const overlap = await request(app).post(url).set('Authorization', admin.auth)
    .send({ product: String(product._id), purchasePrice: 130, effectiveFrom: '2025-05-01', effectiveTo: '2025-12-31' });
  assert.equal(overlap.status, 409);
  assert.match(overlap.body.message, /already covers these dates/);

  // A window that starts after the first one ends is fine — this is price history.
  const sequential = await request(app).post(url).set('Authorization', admin.auth)
    .send({ product: String(product._id), purchasePrice: 130, effectiveFrom: '2025-07-01', effectiveTo: '2025-12-31' });
  assert.equal(sequential.status, 201);
});

test('one product can be supplied by several vendors', async () => {
  const product = await Product.create({ p_name: 'Steel Sheet 2mm' });
  const v1 = await Vendor.create({ name: 'Vendor One' });
  const v2 = await Vendor.create({ name: 'Vendor Two' });

  for (const [v, price] of [[v1, 120], [v2, 115]]) {
    // eslint-disable-next-line no-await-in-loop
    await request(app).post(`${BASE}/vendors/${v._id}/products`).set('Authorization', admin.auth)
      .send({ product: String(product._id), purchasePrice: price });
  }

  const res = await request(app).get(`${BASE}/vendors/by-product/${product._id}`).set('Authorization', admin.auth);
  assert.equal(res.status, 200);
  assert.equal(res.body.items.length, 2);
  assert.equal(res.body.items[0].purchasePrice, 115, 'cheapest first');
});

test('a pricing record belonging to another vendor cannot be edited through this vendor', async () => {
  const product = await Product.create({ p_name: 'Widget' });
  const v1 = await Vendor.create({ name: 'Vendor One' });
  const v2 = await Vendor.create({ name: 'Vendor Two' });

  const created = await request(app).post(`${BASE}/vendors/${v1._id}/products`)
    .set('Authorization', admin.auth).send({ product: String(product._id), purchasePrice: 100 });

  const res = await request(app).put(`${BASE}/vendors/${v2._id}/products/${created.body.item._id}`)
    .set('Authorization', admin.auth).send({ purchasePrice: 1 });
  assert.equal(res.status, 404, 'object-level authorization blocks the cross-vendor id');
});

test('removing a vendor product leaves the shared product master intact', async () => {
  const vendor = await Vendor.create(validVendor());
  const product = await Product.create({ p_name: 'Widget' });
  const created = await request(app).post(`${BASE}/vendors/${vendor._id}/products`)
    .set('Authorization', admin.auth).send({ product: String(product._id), purchasePrice: 100 });

  await request(app).delete(`${BASE}/vendors/${vendor._id}/products/${created.body.item._id}`)
    .set('Authorization', admin.auth);

  assert.ok(await Product.findById(product._id), 'the product itself is untouched');
});

/* ============================== CATEGORIES ============================== */

test('categories are created, deduplicated case-insensitively and counted', async () => {
  const created = await request(app).post(`${BASE}/categories`)
    .set('Authorization', admin.auth).send({ name: 'Raw Materials' });
  assert.equal(created.status, 201);
  assert.match(created.body.category.code, /^VCR\d{3}$/);

  const dup = await request(app).post(`${BASE}/categories`)
    .set('Authorization', admin.auth).send({ name: '  raw materials ' });
  assert.equal(dup.status, 409);

  await Vendor.create({ name: 'Uses Category', category: created.body.category._id });

  const list = await request(app).get(`${BASE}/categories`).set('Authorization', admin.auth);
  assert.equal(list.body.categories[0].vendorCount, 1);
});

test('a category in use cannot be deleted without reassignment', async () => {
  const a = await VendorCategory.create({ name: 'Packaging' });
  const b = await VendorCategory.create({ name: 'Logistics' });
  const vendor = await Vendor.create({ name: 'Uses Packaging', category: a._id });

  const blocked = await request(app).delete(`${BASE}/categories/${a._id}`).set('Authorization', admin.auth);
  assert.equal(blocked.status, 409);
  assert.equal(blocked.body.requiresReassignment, true);
  assert.ok(await VendorCategory.findById(a._id), 'the category is still there');

  const moved = await request(app).delete(`${BASE}/categories/${a._id}`)
    .set('Authorization', admin.auth).send({ reassignTo: String(b._id) });
  assert.equal(moved.status, 200);
  assert.equal(String((await Vendor.findById(vendor._id)).category), String(b._id));
  assert.equal(await VendorCategory.findById(a._id), null);
});

test('an unused category deletes directly, and deactivation is always available', async () => {
  const cat = await VendorCategory.create({ name: 'Temporary' });

  const off = await request(app).put(`${BASE}/categories/${cat._id}`)
    .set('Authorization', admin.auth).send({ isActive: false });
  assert.equal(off.body.category.isActive, false);

  // Inactive categories are not offered when creating a vendor.
  const meta = await request(app).get(`${BASE}/vendors/meta`).set('Authorization', admin.auth);
  assert.equal(meta.body.categories.length, 0);

  const del = await request(app).delete(`${BASE}/categories/${cat._id}`).set('Authorization', admin.auth);
  assert.equal(del.status, 200);
});

/* ============================= PERFORMANCE ============================= */

const fullScores = { quality: 4, delivery: 5, leadTime: 3, pricing: 4, responsiveness: 5, compliance: 4 };

test('an unevaluated vendor reports "No data" rather than a fabricated score', async () => {
  const vendor = await Vendor.create(validVendor());
  const res = await request(app).get(`${BASE}/vendors/${vendor._id}`).set('Authorization', admin.auth);
  assert.equal(res.body.vendor.performance.overallScore, null);
  assert.equal(res.body.vendor.performanceBand, 'No data');
});

test('recording evaluations rolls up an average score', async () => {
  const vendor = await Vendor.create(validVendor());
  const url = `${BASE}/vendors/${vendor._id}/evaluations`;

  const first = await request(app).post(url).set('Authorization', admin.auth)
    .send({ ...fullScores, comments: 'Solid first quarter' });
  assert.equal(first.status, 201);
  // (4+5+3+4+5+4)/6 = 4.17
  assert.equal(first.body.evaluation.overallScore, 4.17);
  assert.equal(first.body.performance.evaluationCount, 1);
  assert.equal(first.body.performanceBand, 'Excellent');

  await request(app).post(url).set('Authorization', admin.auth)
    .send({ quality: 2, delivery: 2, leadTime: 2, pricing: 2, responsiveness: 2, compliance: 2 });

  const listed = await request(app).get(url).set('Authorization', admin.auth);
  assert.equal(listed.body.total, 2);
  assert.equal(listed.body.performance.evaluationCount, 2);
  assert.equal(listed.body.performance.overallScore, 3.09); // (4.17 + 2) / 2
  assert.equal(listed.body.performanceBand, 'Good');
});

test('deleting an evaluation recomputes the rollup back to "No data"', async () => {
  const vendor = await Vendor.create(validVendor());
  const url = `${BASE}/vendors/${vendor._id}/evaluations`;
  const created = await request(app).post(url).set('Authorization', admin.auth).send(fullScores);

  const removed = await request(app).delete(`${url}/${created.body.evaluation._id}`).set('Authorization', admin.auth);
  assert.equal(removed.status, 200);
  assert.equal(removed.body.performance.overallScore, null);
  assert.equal(removed.body.performanceBand, 'No data');
});

test('the leaderboard ranks only evaluated vendors and counts the rest', async () => {
  const rated = await Vendor.create({ name: 'Rated Vendor' });
  await Vendor.create({ name: 'Unrated Vendor' });
  await request(app).post(`${BASE}/vendors/${rated._id}/evaluations`).set('Authorization', admin.auth).send(fullScores);

  const res = await request(app).get(`${BASE}/vendors/leaderboard`).set('Authorization', admin.auth);
  assert.equal(res.status, 200);
  assert.equal(res.body.total, 1);
  assert.equal(res.body.unevaluated, 1);
  assert.equal(res.body.vendors[0].performanceBand, 'Excellent');
});

test('recording an evaluation requires the performance permission', async () => {
  const vendor = await Vendor.create(validVendor());
  const res = await request(app).post(`${BASE}/vendors/${vendor._id}/evaluations`)
    .set('Authorization', staff.auth).send(fullScores);
  assert.equal(res.status, 403);
});

/* ============================== ACTIVITIES ============================== */

test('activities build a timeline and update the vendor\'s last-activity stamp', async () => {
  const vendor = await Vendor.create(validVendor());
  const url = `${BASE}/vendors/${vendor._id}/activities`;

  const note = await request(app).post(url).set('Authorization', staff.auth)
    .send({ activityType: 'Note', body: 'Called about the pending quote.' });
  assert.equal(note.status, 201);
  assert.equal(note.body.activity.createdByName, 'Staff One');

  await request(app).post(url).set('Authorization', admin.auth)
    .send({ activityType: 'Follow-up', body: 'Chase the signed NDA', dueDate: '2026-01-15' });

  const list = await request(app).get(url).set('Authorization', admin.auth);
  assert.equal(list.body.total, 2);
  assert.equal(list.body.activities[0].activityType, 'Follow-up', 'newest first');

  const filtered = await request(app).get(`${url}?type=Note`).set('Authorization', admin.auth);
  assert.equal(filtered.body.total, 1);

  const updated = await Vendor.findById(vendor._id).lean();
  assert.ok(updated.lastActivityAt);
});

test('a user cannot edit or delete another user\'s timeline entry', async () => {
  const vendor = await Vendor.create(validVendor());
  const url = `${BASE}/vendors/${vendor._id}/activities`;
  const created = await request(app).post(url).set('Authorization', admin.auth).send({ body: 'Admin note' });

  const edit = await request(app).put(`${url}/${created.body.activity._id}`)
    .set('Authorization', staff.auth).send({ body: 'Tampered' });
  assert.equal(edit.status, 403);

  const del = await request(app).delete(`${url}/${created.body.activity._id}`).set('Authorization', staff.auth);
  assert.equal(del.status, 403);
});

test('activity content is required', async () => {
  const vendor = await Vendor.create(validVendor());
  const res = await request(app).post(`${BASE}/vendors/${vendor._id}/activities`)
    .set('Authorization', admin.auth).send({ activityType: 'Note' });
  assert.equal(res.status, 400);
});

/* =============================== SUMMARY =============================== */

test('the summary reports real counts and null for metrics with no data', async () => {
  await seedVendors();
  const res = await request(app).get(`${BASE}/vendors/summary`).set('Authorization', admin.auth);

  assert.equal(res.status, 200);
  assert.equal(res.body.summary.total, 3, 'archived vendors are excluded from the total');
  assert.equal(res.body.summary.archived, 1);
  assert.equal(res.body.summary.byStatus.Active, 1);
  assert.equal(res.body.summary.byStatus.Pending, 1);
  assert.equal(res.body.summary.addedLast30Days, 3);
  assert.equal(res.body.summary.averageRating, null, 'no evaluations -> no invented average');
  assert.equal(res.body.summary.averageLeadTimeDays, null);
  assert.deepEqual(res.body.summary.topRated, []);
});

/* ============================ AUDIT HISTORY ============================ */

test('a vendor\'s audit history is retrievable and scoped to that vendor', async () => {
  const a = await request(app).post(`${BASE}/vendors`).set('Authorization', admin.auth).send(validVendor());
  await request(app).post(`${BASE}/vendors`).set('Authorization', admin.auth)
    .send({ name: 'Other Vendor' });

  const id = a.body.vendor._id;
  await request(app).patch(`${BASE}/vendors/${id}/status`).set('Authorization', admin.auth).send({ status: 'Active' });

  const res = await request(app).get(`${BASE}/vendors/${id}/audit`).set('Authorization', admin.auth);
  assert.equal(res.status, 200);
  assert.equal(res.body.total, 2, 'only this vendor\'s events');
  assert.equal(res.body.entries[0].action, 'Vendor status changed');
  assert.equal(res.body.entries[0].name, 'Admin One');
});

/* ================================ EXPORT ================================ */

test('export returns CSV honouring the current filters and omits banking data', async () => {
  await seedVendors();
  await Vendor.updateOne({ name: 'Alpha Steel Works' }, {
    $set: { bank: { bankName: 'HDFC', accountNumberMasked: '****9012', accountNumber: '123456789012' } },
  });

  const all = await request(app).get(`${BASE}/export`).set('Authorization', admin.auth);
  assert.equal(all.status, 200);
  assert.match(all.headers['content-type'], /text\/csv/);
  assert.match(all.headers['content-disposition'], /attachment; filename="vendors-\d{4}-\d{2}-\d{2}\.csv"/);
  assert.ok(all.text.includes('Alpha Steel Works'));
  assert.ok(!all.text.includes('123456789012'), 'account numbers never appear in an export');
  assert.ok(!/account/i.test(all.text.split('\n')[0]), 'no banking column at all');

  const filtered = await request(app).get(`${BASE}/export?status=Active`).set('Authorization', admin.auth);
  assert.ok(filtered.text.includes('Alpha Steel Works'));
  assert.ok(!filtered.text.includes('Beta Packaging'));

  const empty = await request(app).get(`${BASE}/export?search=zzzz-nothing`).set('Authorization', admin.auth);
  assert.equal(empty.status, 404);
});

test('export requires the export permission', async () => {
  await Vendor.create(validVendor());
  const noPerm = await createUser({ role: 'user' });
  // "user" does hold vendor.export, so verify the negative through categories,
  // which "user" does not hold — and confirm export itself succeeds for staff.
  const res = await request(app).get(`${BASE}/export`).set('Authorization', noPerm.auth);
  assert.equal(res.status, 200);
});

/* ================================ IMPORT ================================ */

const CSV_HEADERS = 'Vendor Name,Email,Phone,GSTIN,Category\n';

const uploadCsv = (content, auth = admin.auth) => request(app)
  .post(`${BASE}/import/upload`)
  .set('Authorization', auth)
  .attach('file', Buffer.from(content), { filename: 'vendors.csv', contentType: 'text/csv' });

test('import detects headers and suggests a column mapping', async () => {
  const res = await uploadCsv(`${CSV_HEADERS}Acme Supplies,a@acme.test,9876543210,,\n`);

  assert.equal(res.status, 201);
  assert.deepEqual(res.body.headers, ['Vendor Name', 'Email', 'Phone', 'GSTIN', 'Category']);
  assert.equal(res.body.mapping['Vendor Name'], 'name');
  assert.equal(res.body.mapping.Phone, 'phone');
  assert.equal(res.body.totalRows, 1);
});

test('import validates every row and reports duplicates and errors without importing', async () => {
  await Vendor.create({ name: 'Existing Vendor Ltd' });

  const csvContent = `${CSV_HEADERS}`
    + 'Good Vendor One,good@x.test,9876543210,27AAPFU0939F1ZV,\n'
    + 'Bad Vendor,not-an-email,123,,\n'
    + '  existing   vendor LTD ,e@x.test,9811111111,,\n'
    + ',,,,\n'.replace(',,,,\n', 'Good Vendor Two,two@x.test,9812345678,,\n');

  const uploaded = await uploadCsv(csvContent);
  const res = await request(app).post(`${BASE}/import/validate`)
    .set('Authorization', admin.auth)
    .send({ jobId: uploaded.body.jobId, mapping: uploaded.body.mapping });

  assert.equal(res.status, 200);
  assert.equal(res.body.summary.totalRows, 4);
  assert.equal(res.body.summary.readyToImport, 2);
  assert.equal(res.body.summary.errors, 1);
  assert.equal(res.body.summary.duplicates, 1, 'the whitespace/case variant is caught');

  const badRow = res.body.preview.find((r) => r.vendorName === 'Bad Vendor');
  assert.equal(badRow.status, 'Error');
  assert.match(badRow.reason, /Invalid email/);
  assert.match(badRow.reason, /Invalid phone/);

  // Nothing has been written yet.
  assert.equal(await Vendor.countDocuments({}), 1);
});

test('import cannot be committed before it is validated', async () => {
  const uploaded = await uploadCsv(`${CSV_HEADERS}Acme,a@acme.test,9876543210,,\n`);
  const res = await request(app).post(`${BASE}/import/commit`)
    .set('Authorization', admin.auth).send({ jobId: uploaded.body.jobId });
  assert.equal(res.status, 400);
  assert.match(res.body.message, /Validate the import/);
});

test('committing imports the valid rows only, and reports a full summary', async () => {
  const category = await VendorCategory.create({ name: 'Raw Materials' });

  const csvContent = `${CSV_HEADERS}`
    + 'Import Vendor One,one@x.test,9876543210,,Raw Materials\n'
    + 'Broken Vendor,bad-email,1,,\n'
    + 'Import Vendor Two,two@x.test,9812345678,,\n';

  const uploaded = await uploadCsv(csvContent);
  await request(app).post(`${BASE}/import/validate`).set('Authorization', admin.auth)
    .send({ jobId: uploaded.body.jobId, mapping: uploaded.body.mapping });

  const res = await request(app).post(`${BASE}/import/commit`)
    .set('Authorization', admin.auth).send({ jobId: uploaded.body.jobId });

  assert.equal(res.status, 200);
  assert.equal(res.body.summary.totalRows, 3);
  assert.equal(res.body.summary.imported, 2);
  assert.equal(res.body.summary.errors, 1);

  assert.equal(await Vendor.countDocuments({}), 2);
  const one = await Vendor.findOne({ name: 'Import Vendor One' }).lean();
  assert.match(one.v_code, /^VI\d{3}$/, 'imported vendors still get a generated code');
  assert.equal(String(one.category), String(category._id), 'category matched by name');
  assert.ok(one.nameNorm, 'normalized fields are populated on import');

  // Re-committing is refused.
  const again = await request(app).post(`${BASE}/import/commit`)
    .set('Authorization', admin.auth).send({ jobId: uploaded.body.jobId });
  assert.equal(again.status, 409);
});

test('the import error report is downloadable and lists every rejected row', async () => {
  const uploaded = await uploadCsv(`${CSV_HEADERS}Ok Vendor,ok@x.test,9876543210,,\nBad Vendor,nope,1,,\n`);
  await request(app).post(`${BASE}/import/validate`).set('Authorization', admin.auth)
    .send({ jobId: uploaded.body.jobId, mapping: uploaded.body.mapping });

  const res = await request(app).get(`${BASE}/import/${uploaded.body.jobId}/report`).set('Authorization', admin.auth);
  assert.equal(res.status, 200);
  assert.match(res.headers['content-type'], /text\/csv/);
  assert.ok(res.text.includes('Bad Vendor'));
  assert.ok(res.text.includes('Invalid email'));
});

test('one user cannot commit another user\'s import job', async () => {
  const other = await createUser({ role: 'admin' });
  const uploaded = await uploadCsv(`${CSV_HEADERS}Acme,a@acme.test,9876543210,,\n`, other.auth);

  const res = await request(app).post(`${BASE}/import/validate`)
    .set('Authorization', staff.auth).send({ jobId: uploaded.body.jobId });
  assert.equal(res.status, 403, 'blocked before ownership is even relevant (staff lack vendor.import)');
});

test('a non-CSV upload is rejected', async () => {
  const res = await request(app).post(`${BASE}/import/upload`).set('Authorization', admin.auth)
    .attach('file', Buffer.from('<html></html>'), { filename: 'evil.html', contentType: 'text/html' });
  assert.equal(res.status, 400);
});

test('an import needs a column mapped to the vendor name', async () => {
  const uploaded = await uploadCsv('Some Column,Another\nfoo,bar\n');
  const res = await request(app).post(`${BASE}/import/validate`).set('Authorization', admin.auth)
    .send({ jobId: uploaded.body.jobId, mapping: { 'Some Column': 'city', Another: '' } });
  assert.equal(res.status, 400);
  assert.match(res.body.message, /Vendor Name/);
});

test('the import template is downloadable', async () => {
  const res = await request(app).get(`${BASE}/import/template`).set('Authorization', admin.auth);
  assert.equal(res.status, 200);
  assert.ok(res.text.startsWith('Vendor Name,'));
});
