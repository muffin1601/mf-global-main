// Regression coverage for the lead-creation/dashboard ownership path.
// Uses only mongodb-memory-server; no configured CRM database is touched.

const test = require('node:test');
const assert = require('node:assert/strict');
const express = require('express');
const request = require('supertest');

const { start, stop, resetCollections, createUser } = require('./helpers/testApp');
const Client = require('../models/ClientData');

let app;
let admin;
let staff;
let outsider;

test.before(async () => {
  await start();
  app = express();
  app.use(express.json());
  app.use('/api', require('../routes/client'));
  app.use('/api/overview', require('../routes/dashboardoverview'));
  app.use('/api', require('../routes/clientwork'));
  app.use('/api', require('../routes/salesPerformance'));
  app.use('/api', require('../routes/login'));
});

test.after(stop);

test.beforeEach(async () => {
  await resetCollections();
  admin = await createUser({ role: 'admin', name: 'Admin One' });
  staff = await createUser({ role: 'user', name: 'Staff One' });
  outsider = await createUser({ role: 'user', name: 'Staff Two' });
});

test('a regular user creation is persisted, attributed, and assigned to its creator', async () => {
  const res = await request(app).post('/api/add-client')
    .set('Authorization', staff.auth)
    .send({
      name: 'New Customer',
      phone: '9876543210',
      // A forged assignment must never override server-side ownership.
      assignedTo: [{ user: { _id: outsider.user._id, name: outsider.user.name } }],
    });

  assert.equal(res.status, 201);
  assert.ok(res.body.client?._id, 'the created record is returned to the UI');

  const saved = await Client.findById(res.body.client._id).lean();
  assert.equal(String(saved.createdBy), String(staff.user._id));
  assert.equal(String(saved.assignedTo[0].user._id), String(staff.user._id));
  assert.equal(saved.assignedTo[0].user.name, staff.user.name);
  assert.equal(saved.isAssigned, true);
});

test('a newly-created lead appears in the creator list and statistics, but not another user scope', async () => {
  await request(app).post('/api/add-client')
    .set('Authorization', staff.auth)
    .send({ name: 'Visible Customer', phone: '9876543211', status: 'New Lead' })
    .expect(201);

  const list = await request(app)
    .get(`/api/overview/user-dashboard-stats/${encodeURIComponent(staff.user.name)}`)
    .set('Authorization', staff.auth);
  assert.equal(list.status, 200);
  assert.equal(list.body.myLeads.length, 1);
  assert.equal(list.body.myLeads[0].name, 'Visible Customer');

  const stats = await request(app)
    .get(`/api/overview/user-stats/${encodeURIComponent(staff.user.name)}`)
    .set('Authorization', staff.auth);
  assert.equal(stats.status, 200);
  assert.equal(stats.body.myLeads, 1);

  const otherStats = await request(app)
    .get(`/api/overview/user-stats/${encodeURIComponent(outsider.user.name)}`)
    .set('Authorization', outsider.auth);
  assert.equal(otherStats.status, 200);
  assert.equal(otherStats.body.myLeads, 0);

  const forbidden = await request(app)
    .get(`/api/overview/user-dashboard-stats/${encodeURIComponent(staff.user.name)}`)
    .set('Authorization', outsider.auth);
  assert.equal(forbidden.status, 403);
});

test('admin-created unassigned leads retain the existing unassigned workflow', async () => {
  const res = await request(app).post('/api/add-client')
    .set('Authorization', admin.auth)
    .send({ name: 'Unassigned Customer', phone: '9876543212', assignedTo: [] });

  assert.equal(res.status, 201);
  const saved = await Client.findById(res.body.client._id).lean();
  assert.equal(saved.assignedTo.length, 0);
  assert.equal(saved.isAssigned, false);
  assert.equal(String(saved.createdBy), String(admin.user._id));
});

test('admin client lists paginate safely with more than 100 records', async () => {
  const docs = Array.from({ length: 105 }, (_, i) => ({
    name: `Customer ${i}`,
    phone: `90000${String(i).padStart(5, '0')}`,
  }));
  await Client.insertMany(docs);

  const page1 = await request(app).get('/api/overview/all-clients?page=1&limit=50')
    .set('Authorization', admin.auth);
  const page3 = await request(app).get('/api/overview/all-clients?page=3&limit=50')
    .set('Authorization', admin.auth);

  assert.equal(page1.status, 200);
  assert.equal(page1.body.data.length, 50);
  assert.equal(page1.body.total, 105);
  assert.equal(page1.body.pages, 3);
  assert.equal(page3.body.data.length, 5);
});

test('quotation client search finds client names and preserves user visibility scope', async () => {
  await Client.create([
    {
      name: 'Ananya Sharma',
      company: 'North Star',
      phone: '9876500010',
      assignedTo: [{
        user: { _id: staff.user._id, name: staff.user.name },
        permissions: { view: true, update: true, delete: false },
      }],
    },
    {
      name: 'Ananya Private',
      company: 'Hidden Co',
      phone: '9876500011',
      assignedTo: [{
        user: { _id: outsider.user._id, name: outsider.user.name },
        permissions: { view: true, update: true, delete: false },
      }],
    },
  ]);

  const staffSearch = await request(app)
    .get('/api/overview/quotation-clients?q=Ananya&limit=10')
    .set('Authorization', staff.auth);
  assert.equal(staffSearch.status, 200);
  assert.equal(staffSearch.body.total, 1);
  assert.equal(staffSearch.body.data[0].name, 'Ananya Sharma');

  const adminSearch = await request(app)
    .get('/api/overview/quotation-clients?q=Ananya&limit=10')
    .set('Authorization', admin.auth);
  assert.equal(adminSearch.status, 200);
  assert.equal(adminSearch.body.total, 2);

  const literalRegexSearch = await request(app)
    .get('/api/overview/quotation-clients?q=.*&limit=10')
    .set('Authorization', admin.auth);
  assert.equal(literalRegexSearch.status, 200);
  assert.equal(literalRegexSearch.body.total, 0, 'search input is escaped, not executed as regex');
});

test('concurrent creations remain visible to the creator', async () => {
  const calls = Array.from({ length: 10 }, (_, i) => request(app)
    .post('/api/add-client')
    .set('Authorization', staff.auth)
    .send({ name: `Concurrent ${i}`, phone: `98888${String(i).padStart(5, '0')}` }));
  const results = await Promise.all(calls);
  assert.ok(results.every((res) => res.status === 201));

  const visible = await Client.countDocuments({ 'assignedTo.user._id': staff.user._id });
  assert.equal(visible, 10);
});

test('adjacent client APIs enforce record scope and do not expose the staff directory or team metrics', async () => {
  const created = await request(app).post('/api/add-client')
    .set('Authorization', staff.auth)
    .send({ name: 'Scoped Customer', phone: '9876543220', status: 'Won Lead' });
  const id = created.body.client._id;

  await request(app).put(`/api/clients/${id}`)
    .set('Authorization', outsider.auth)
    .send({ name: 'Stolen' })
    .expect(403);

  const ownUpdate = await request(app).put(`/api/clients/${id}`)
    .set('Authorization', staff.auth)
    .send({ name: 'Owned Update' });
  assert.equal(ownUpdate.status, 200);
  assert.equal(ownUpdate.body.client.name, 'Owned Update');

  await Client.create({
    name: 'Other User Customer',
    phone: '9876543221',
    status: 'Won Lead',
    assignedTo: [{
      user: { _id: outsider.user._id, name: outsider.user.name },
      permissions: { view: true, update: true, delete: false },
    }],
  });

  const metrics = await request(app).get('/api/sales-performance')
    .set('Authorization', staff.auth);
  assert.equal(metrics.status, 200);
  assert.equal(metrics.body.length, 1);
  assert.equal(String(metrics.body[0]._id), String(staff.user._id));

  await request(app).get('/api/users').set('Authorization', staff.auth).expect(403);
  const directory = await request(app).get('/api/users').set('Authorization', admin.auth);
  assert.equal(directory.status, 200);
});
