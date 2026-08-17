// Test harness for the Vendor Management module.
//
// Boots an isolated in-memory MongoDB and an Express app that mounts ONLY the
// vendor router with the real authenticate / permission middleware. Nothing
// here touches the configured MONGO_URI, so tests can never read or write real
// CRM data.

const express = require('express');
const mongoose = require('mongoose');
const jwt = require('jsonwebtoken');
const qs = require('qs');
const mongoSanitize = require('express-mongo-sanitize');
const { MongoMemoryServer } = require('mongodb-memory-server');

process.env.JWT_SECRET = process.env.JWT_SECRET_TEST || 'vendor-module-test-secret';

let memoryServer;

const start = async () => {
  memoryServer = await MongoMemoryServer.create();
  await mongoose.connect(memoryServer.getUri(), { dbName: 'vendor_module_test' });
  // Build the indexes declared on the schemas so uniqueness is genuinely
  // exercised rather than assumed.
  await Promise.all(mongoose.modelNames().map((n) => mongoose.model(n).init()));
};

const stop = async () => {
  await mongoose.connection.dropDatabase();
  await mongoose.disconnect();
  if (memoryServer) await memoryServer.stop();
};

const resetCollections = async () => {
  const { collections } = mongoose.connection;
  await Promise.all(Object.values(collections).map((c) => c.deleteMany({})));
};

// Mirrors the server's own query-parser + body-sanitiser setup so the tests
// exercise the same request pipeline production uses.
const buildApp = () => {
  const app = express();
  app.set('query parser', (str) => mongoSanitize.sanitize(qs.parse(str)));
  app.use(express.json({ limit: '2mb' }));
  app.use((req, res, next) => {
    if (req.body && typeof req.body === 'object') req.body = mongoSanitize.sanitize(req.body);
    next();
  });
  app.use('/api/vendor-management', require('../../routes/Vendors'));
  // eslint-disable-next-line no-unused-vars
  app.use((err, req, res, next) => {
    res.status(err.status || 500).json({ message: 'Internal server error' });
  });
  return app;
};

const User = require('../../models/User');

const createUser = async ({ role = 'admin', name = 'Test User', username, enabled = true } = {}) => {
  const uniq = username || `${role}-${Math.random().toString(36).slice(2, 9)}`;
  const user = await User.create({
    name,
    username: uniq,
    email: `${uniq}@example.test`,
    password: 'hashed-not-used',
    role,
    enabled,
  });
  const token = jwt.sign({ id: user._id.toString() }, process.env.JWT_SECRET, { expiresIn: '1h' });
  return { user, token, auth: `Bearer ${token}` };
};

module.exports = { start, stop, resetCollections, buildApp, createUser };
