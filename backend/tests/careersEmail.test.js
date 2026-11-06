const test = require('node:test');
const assert = require('node:assert/strict');
const express = require('express');
const request = require('supertest');
const app = express();
app.use(express.json());
app.use('/api', require('../routes/main/careersRoutes'));
test('careers admin endpoints require a session', async () => {
  for (const path of ['/api/careers/admin/jobs', '/api/careers/admin/applications', '/api/careers/admin/stats', '/api/careers/admin/export']) {
    const response = await request(app).get(path);
    assert.equal(response.status, 401);
  }
});
test('invalid public job IDs return not found', async () => {
  assert.equal((await request(app).get('/api/careers/jobs/not-an-id')).status, 404);
});
