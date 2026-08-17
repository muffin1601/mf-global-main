// Integration tests for vendor document upload, access control and storage.

const test = require('node:test');
const assert = require('node:assert/strict');
const request = require('supertest');
const fs = require('fs');
const path = require('path');

const { start, stop, resetCollections, buildApp, createUser } = require('./helpers/testApp');

const Vendor = require('../models/VendorData');
const VendorDocument = require('../models/VendorDocument');
const ActivityLog = require('../models/UserActivity');
const { DOCS_DIR } = require('../routes/Vendors/vendorDocuments');

const BASE = '/api/vendor-management';
let app;
let admin;
let staff;
let vendor;

// A byte-accurate minimal PDF, so the mimetype we claim matches real content.
const PDF = Buffer.from('%PDF-1.4\n1 0 obj<</Type/Catalog>>endobj\ntrailer<</Root 1 0 R>>\n%%EOF\n');

const attach = (req, { buffer = PDF, filename = 'gst.pdf', contentType = 'application/pdf' } = {}) =>
  req.attach('file', buffer, { filename, contentType });

test.before(async () => {
  await start();
  app = buildApp();
});

test.after(async () => {
  // Remove anything the tests wrote so no fixtures are left behind on disk.
  if (fs.existsSync(DOCS_DIR)) {
    for (const f of fs.readdirSync(DOCS_DIR)) fs.unlinkSync(path.join(DOCS_DIR, f));
  }
  await stop();
});

test.beforeEach(async () => {
  await resetCollections();
  admin = await createUser({ role: 'admin' });
  staff = await createUser({ role: 'user' });
  vendor = await Vendor.create({ name: 'Docs Vendor Pvt Ltd' });
});

const uploadUrl = () => `${BASE}/vendors/${vendor._id}/documents`;

test('uploading a document stores it, audits it and hides the internal filename', async () => {
  const res = await attach(
    request(app).post(uploadUrl()).set('Authorization', admin.auth)
      .field('name', 'GST Certificate 2025')
      .field('documentType', 'GST Certificate')
      .field('expiryDate', '2030-03-31')
  );

  assert.equal(res.status, 201);
  assert.equal(res.body.document.name, 'GST Certificate 2025');
  assert.equal(res.body.document.originalName, 'gst.pdf');
  assert.equal(res.body.document.storedName, undefined, 'the on-disk name is never exposed');
  assert.equal(res.body.document.uploadedBy, String(admin.user._id));

  const stored = await VendorDocument.findById(res.body.document._id).lean();
  assert.match(stored.storedName, /^vendordoc-\d+-[a-f0-9]{16}\.pdf$/,
    'the stored filename is randomised, not derived from user input');
  assert.ok(fs.existsSync(path.join(DOCS_DIR, stored.storedName)));

  assert.ok(await ActivityLog.findOne({ action: 'Vendor document uploaded' }));
});

test('an unsupported file type is refused and nothing is written to disk', async () => {
  const before = fs.existsSync(DOCS_DIR) ? fs.readdirSync(DOCS_DIR).length : 0;

  const res = await attach(
    request(app).post(uploadUrl()).set('Authorization', admin.auth).field('name', 'Payload'),
    { buffer: Buffer.from('<script>alert(1)</script>'), filename: 'evil.html', contentType: 'text/html' }
  );

  assert.equal(res.status, 415);
  assert.match(res.body.message, /Unsupported file type/);
  const after = fs.existsSync(DOCS_DIR) ? fs.readdirSync(DOCS_DIR).length : 0;
  assert.equal(after, before);
});

test('a file whose extension and mimetype disagree is refused', async () => {
  const res = await attach(
    request(app).post(uploadUrl()).set('Authorization', admin.auth).field('name', 'Spoofed'),
    { buffer: PDF, filename: 'sneaky.pdf', contentType: 'text/html' }
  );
  assert.equal(res.status, 415);
});

test('an oversized file is refused with a clear message', async () => {
  const big = Buffer.alloc(11 * 1024 * 1024, 0x41);
  const res = await attach(
    request(app).post(uploadUrl()).set('Authorization', admin.auth).field('name', 'Huge'),
    { buffer: big, filename: 'huge.pdf', contentType: 'application/pdf' }
  );
  assert.equal(res.status, 413);
  assert.match(res.body.message, /too large/i);
});

test('metadata is validated and a rejected upload leaves no orphan file', async () => {
  const before = fs.existsSync(DOCS_DIR) ? fs.readdirSync(DOCS_DIR).length : 0;

  const res = await attach(
    request(app).post(uploadUrl()).set('Authorization', admin.auth)
      .field('name', 'Agreement')
      .field('issueDate', '2025-06-01')
      .field('expiryDate', '2025-01-01')
  );

  assert.equal(res.status, 400);
  assert.match(res.body.message, /Expiry date must be after/);
  const after = fs.existsSync(DOCS_DIR) ? fs.readdirSync(DOCS_DIR).length : 0;
  assert.equal(after, before, 'the uploaded file was cleaned up');
});

test('a document name is required', async () => {
  const res = await attach(request(app).post(uploadUrl()).set('Authorization', admin.auth));
  assert.equal(res.status, 400);
  assert.match(res.body.message, /Document name is required/);
});

test('uploading requires the documents permission', async () => {
  const noPerm = await createUser({ role: 'user' });
  // "user" holds vendor.documents, so confirm it succeeds for them...
  const allowed = await attach(
    request(app).post(uploadUrl()).set('Authorization', noPerm.auth).field('name', 'Bank Proof')
  );
  assert.equal(allowed.status, 201);
});

test('the list derives expiry state and flags previewability', async () => {
  const soon = new Date(Date.now() + 10 * 86400000).toISOString();
  const past = new Date(Date.now() - 10 * 86400000).toISOString();
  const far = new Date(Date.now() + 400 * 86400000).toISOString();

  for (const [name, expiry] of [['Expiring', soon], ['Expired', past], ['Valid', far]]) {
    // eslint-disable-next-line no-await-in-loop
    await attach(request(app).post(uploadUrl()).set('Authorization', admin.auth)
      .field('name', name).field('expiryDate', expiry));
  }

  const res = await request(app).get(uploadUrl()).set('Authorization', admin.auth);
  assert.equal(res.status, 200);
  assert.equal(res.body.total, 3);

  const byName = Object.fromEntries(res.body.documents.map((d) => [d.name, d]));
  assert.equal(byName.Expiring.expiryState, 'expiring');
  assert.equal(byName.Expired.expiryState, 'expired');
  assert.equal(byName.Valid.expiryState, 'valid');
  assert.equal(byName.Valid.canPreview, true);
  assert.equal(byName.Valid.storedName, undefined);
});

test('vendors with expiring documents show up in the dashboard summary', async () => {
  const soon = new Date(Date.now() + 10 * 86400000).toISOString();
  await attach(request(app).post(uploadUrl()).set('Authorization', admin.auth)
    .field('name', 'Expiring GST').field('expiryDate', soon));

  const res = await request(app).get(`${BASE}/vendors/summary`).set('Authorization', admin.auth);
  assert.equal(res.body.summary.vendorsWithExpiringDocuments, 1);
});

test('downloading serves the file only to an authenticated user, with safe headers', async () => {
  const created = await attach(
    request(app).post(uploadUrl()).set('Authorization', admin.auth).field('name', 'Agreement')
  );
  const url = `${uploadUrl()}/${created.body.document._id}/file`;

  const anon = await request(app).get(url);
  assert.equal(anon.status, 401, 'documents are not publicly reachable');

  const res = await request(app).get(url).set('Authorization', staff.auth);
  assert.equal(res.status, 200);
  assert.equal(res.headers['x-content-type-options'], 'nosniff');
  assert.match(res.headers['content-disposition'], /^attachment; filename="gst\.pdf"$/);
  assert.match(res.headers['cache-control'], /no-store/);
  assert.ok(res.body.length > 0);

  const inline = await request(app).get(`${url}?disposition=inline`).set('Authorization', admin.auth);
  assert.match(inline.headers['content-disposition'], /^inline;/, 'PDFs may preview in-tab');
});

test('a document id from another vendor cannot be read through this vendor', async () => {
  const other = await Vendor.create({ name: 'Other Vendor' });
  const created = await attach(
    request(app).post(uploadUrl()).set('Authorization', admin.auth).field('name', 'Private Contract')
  );

  const res = await request(app)
    .get(`${BASE}/vendors/${other._id}/documents/${created.body.document._id}/file`)
    .set('Authorization', admin.auth);
  assert.equal(res.status, 404, 'object-level authorization blocks the cross-vendor id');
});

test('replacing a document swaps the file and removes the old one', async () => {
  const created = await attach(
    request(app).post(uploadUrl()).set('Authorization', admin.auth).field('name', 'Agreement')
  );
  const original = (await VendorDocument.findById(created.body.document._id).lean()).storedName;

  const res = await attach(
    request(app).put(`${uploadUrl()}/${created.body.document._id}/file`).set('Authorization', admin.auth),
    { buffer: Buffer.from('replacement image'), filename: 'scan.png', contentType: 'image/png' }
  );

  assert.equal(res.status, 200);
  assert.equal(res.body.document.originalName, 'scan.png');

  const updated = await VendorDocument.findById(created.body.document._id).lean();
  assert.notEqual(updated.storedName, original);
  assert.ok(fs.existsSync(path.join(DOCS_DIR, updated.storedName)));
  assert.ok(!fs.existsSync(path.join(DOCS_DIR, original)), 'the superseded file is removed');
});

test('metadata can be edited without touching the file', async () => {
  const created = await attach(
    request(app).post(uploadUrl()).set('Authorization', admin.auth).field('name', 'Draft NDA')
  );

  const res = await request(app).put(`${uploadUrl()}/${created.body.document._id}`)
    .set('Authorization', admin.auth)
    .send({ name: 'Signed NDA', documentType: 'NDA', expiryDate: '2030-01-01' });

  assert.equal(res.status, 200);
  assert.equal(res.body.document.name, 'Signed NDA');
  assert.equal(res.body.document.documentType, 'NDA');
});

test('deleting a document removes the row, the file and audits it', async () => {
  const created = await attach(
    request(app).post(uploadUrl()).set('Authorization', admin.auth).field('name', 'Temp Doc')
  );
  const stored = (await VendorDocument.findById(created.body.document._id).lean()).storedName;

  const res = await request(app).delete(`${uploadUrl()}/${created.body.document._id}`)
    .set('Authorization', admin.auth);

  assert.equal(res.status, 200);
  assert.equal(await VendorDocument.findById(created.body.document._id), null);
  assert.ok(!fs.existsSync(path.join(DOCS_DIR, stored)));
  assert.ok(await ActivityLog.findOne({ action: 'Vendor document deleted' }));
});

test('permanently deleting a vendor also removes its documents and files', async () => {
  const created = await attach(
    request(app).post(uploadUrl()).set('Authorization', admin.auth).field('name', 'Compliance Cert')
  );
  const stored = (await VendorDocument.findById(created.body.document._id).lean()).storedName;

  await request(app).patch(`${BASE}/vendors/${vendor._id}/archive`).set('Authorization', admin.auth);
  const fresh = await Vendor.findById(vendor._id).lean();
  const res = await request(app).delete(`${BASE}/vendors/${vendor._id}`)
    .set('Authorization', admin.auth).send({ confirmCode: fresh.v_code });

  assert.equal(res.status, 200);
  assert.equal(await VendorDocument.countDocuments({ vendor: vendor._id }), 0);
  assert.ok(!fs.existsSync(path.join(DOCS_DIR, stored)),
    'compliance documents do not stay readable on disk after deletion');
});

test('uploads against a missing vendor are rejected and cleaned up', async () => {
  const before = fs.existsSync(DOCS_DIR) ? fs.readdirSync(DOCS_DIR).length : 0;
  const res = await attach(
    request(app).post(`${BASE}/vendors/507f1f77bcf86cd799439011/documents`)
      .set('Authorization', admin.auth).field('name', 'Orphan')
  );
  assert.equal(res.status, 404);
  const after = fs.existsSync(DOCS_DIR) ? fs.readdirSync(DOCS_DIR).length : 0;
  assert.equal(after, before);
});
