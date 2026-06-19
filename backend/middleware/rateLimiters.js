// Rate limiters for abuse-prone public endpoints.
// Uses express-rate-limit (in-memory store; for multi-instance deploys add a shared store).
const rateLimit = require("express-rate-limit");

const json429 = (message) => (req, res) =>
  res.status(429).json({ error: message });

// Login: throttle credential-stuffing / brute force.
const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 min
  max: 10,                  // 10 attempts / IP / window
  standardHeaders: true,
  legacyHeaders: false,
  handler: json429("Too many login attempts. Please try again later."),
});

// Public enquiry email: stop form-spam / mail-relay abuse.
const emailLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 min
  max: 5,
  standardHeaders: true,
  legacyHeaders: false,
  handler: json429("Too many requests. Please wait a moment and try again."),
});

// Web-portal lead-capture webhooks: cap flooding (API key still required).
const webhookLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 min
  max: 60,
  standardHeaders: true,
  legacyHeaders: false,
  handler: json429("Rate limit exceeded."),
});

module.exports = { loginLimiter, emailLimiter, webhookLimiter };
