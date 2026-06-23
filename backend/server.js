const express = require("express");
const mongoose = require("mongoose");
const cors = require("cors");
const helmet = require("helmet");
const hpp = require("hpp");
const qs = require("qs");
const mongoSanitize = require("express-mongo-sanitize");
const morgan = require("morgan");
const compression = require("compression");
// const fs = require("fs");
const path = require("path");
require("dotenv").config();

// --- Environment validation (fail fast on misconfiguration) ---
const REQUIRED_ENV = ["MONGO_URI", "JWT_SECRET"];
const missingEnv = REQUIRED_ENV.filter((k) => !process.env[k] || !String(process.env[k]).trim());
if (missingEnv.length) {
  console.error(`❌ Missing required environment variables: ${missingEnv.join(", ")}`);
  console.error("   Set them in your environment / .env before starting the server.");
  process.exit(1);
}

const app = express();

// Trust the first proxy hop so express-rate-limit keys on the real client IP
// (when deployed behind nginx / a load balancer). Safe single-hop value.
app.set("trust proxy", 1);

// Weak ETags are enabled by default; keep them so conditional GETs return 304
// (no body re-sent) when the client already has a current copy.
app.set("etag", "weak");

// Response compression (gzip/deflate, content-negotiated via Accept-Encoding).
// Skips already-compressed types and respects a per-request `x-no-compression`
// header. Brotli is best terminated at the nginx/reverse-proxy layer.
app.use(compression({
  threshold: 1024, // don't bother compressing tiny (<1KB) responses
  filter: (req, res) => {
    if (req.headers["x-no-compression"]) return false;
    return compression.filter(req, res);
  },
}));

// NoSQL-injection protection for the query string. Express 5 makes req.query a
// read-only getter, so express-mongo-sanitize's default middleware crashes.
// Sanitizing at PARSE time avoids any reassignment: $-prefixed / dotted keys
// (Mongo operators) are stripped before the query object is ever built.
app.set("query parser", (str) => mongoSanitize.sanitize(qs.parse(str)));

// --- Request logging ---
// "combined" (Apache-style) in production, concise "dev" otherwise.
app.use(morgan(process.env.NODE_ENV === "production" ? "combined" : "dev"));

// --- Health & readiness probes (before security/CORS so load balancers and
// orchestrators can always reach them; they expose no sensitive data) ---
const MONGO_STATES = { 0: "disconnected", 1: "connected", 2: "connecting", 3: "disconnecting" };

// Liveness: the process is up and the event loop is responsive.
app.get("/health", (req, res) => {
  res.status(200).json({ status: "ok", uptime: process.uptime(), pid: process.pid });
});

// Readiness: the process can serve traffic (DB connected).
app.get("/ready", (req, res) => {
  const state = mongoose.connection.readyState;
  const ready = state === 1;
  res.status(ready ? 200 : 503).json({
    status: ready ? "ready" : "not-ready",
    mongo: MONGO_STATES[state] || "unknown",
  });
});

// --- Security headers (helmet) ---
// crossOriginResourcePolicy is relaxed to "cross-origin" so the separate
// frontend origin can still load uploaded images from /uploads.
app.use(helmet({
  crossOriginResourcePolicy: { policy: "cross-origin" },
}));

// CORS
const allowedOrigins = (process.env.CORS_ORIGINS || process.env.FRONTEND_URL || "http://localhost:5173,http://127.0.0.1:5173")
  .split(",")
  .map((origin) => origin.trim())
  .filter(Boolean);

// Visible at startup so a misconfigured origin is obvious in the logs.
console.log("🌐 CORS allowed origins:", allowedOrigins.join(", "));

app.use(cors({
  origin: (origin, callback) => {
    if (!origin || allowedOrigins.includes(origin)) {
      return callback(null, true);
    }
    // Log the exact rejected origin so it can be added to CORS_ORIGINS verbatim.
    console.warn(`⛔ CORS blocked origin: "${origin}" (allowed: ${allowedOrigins.join(", ") || "none"})`);
    const err = new Error("Not allowed by CORS");
    err.status = 403;
    return callback(err);
  },
}));

// Body parsers — reduced from 50mb to 2mb (DoS hardening). File uploads use
// multipart/form-data via multer and are unaffected by these JSON/urlencoded limits.
app.use(express.json({ limit: "2mb" }));
app.use(express.urlencoded({ extended: true, limit: "2mb" }));

// NoSQL-injection protection for the request BODY (writable in Express 5).
app.use((req, res, next) => {
  if (req.body && typeof req.body === "object") {
    req.body = mongoSanitize.sanitize(req.body);
  }
  next();
});

// HTTP Parameter Pollution protection (de-duplicates repeated body params).
app.use(hpp());

// Static uploads: long-lived caching with revalidation. Browsers cache for 7
// days and serve from cache; ETag/Last-Modified allow cheap 304 revalidation.
app.use("/uploads", express.static(path.join(__dirname, "uploads"), {
  maxAge: "7d",
  etag: true,
  lastModified: true,
  setHeaders: (res) => {
    res.set("Cache-Control", "public, max-age=604800");
  },
}));

// MongoDB Connection (tuned for production / clustered workers)
// Pool sizes are PER WORKER — keep modest so N workers don't exhaust the
// Atlas/server connection limit (effective pool ≈ maxPoolSize × instances).
mongoose.connect(process.env.MONGO_URI, {
  maxPoolSize: parseInt(process.env.MONGO_MAX_POOL, 10) || 10,
  minPoolSize: parseInt(process.env.MONGO_MIN_POOL, 10) || 1,
  serverSelectionTimeoutMS: 10000, // fail fast if no primary is reachable
  socketTimeoutMS: 45000,
  family: 4, // prefer IPv4 (avoids slow DNS in some hosts)
  compressors: ["zlib"], // wire compression between Node and MongoDB (less network traffic)
})
.then(() => console.log("✅ MongoDB connected"))
.catch(err => console.error("❌ MongoDB connection error:", err));

// API Routes
app.use('/api/quotations', require('./routes/quotation'));
app.use("/api/overview", require("./routes/dashboardoverview"));
app.use("/api", require("./routes/main/emailRoutes"));
app.use ("/api/visitors", require("./routes/main/visitor"));
app.use("/api/blogs", require("./routes/main/blogRoutes"));
app.use("/api", require("./routes/client"));
app.use("/api", require("./routes/upload"));
app.use("/api", require("./routes/leadImport"));
app.use("/api", require("./routes/filterRoutes"));
app.use("/api", require("./routes/login"));
app.use("/api", require("./routes/dashboard"));
app.use("/api", require("./routes/admin"));
app.use("/api", require("./routes/activitylog"));
app.use("/api", require("./routes/followup"));
app.use("/api", require("./routes/assignment-routes"));
app.use("/api", require("./routes/clientwork"));
app.use("/api", require("./routes/leads"));
app.use("/api", require("./routes/salesPerformance"))
app.use("/api", require("./routes/Products/product"));
app.use("/api/categories", require("./routes/Products/Category"));
app.use("/api", require("./routes/Products/vendor"));
app.use("/api/products", require("./routes/Products/ProductOverview"));

// JSON error handler (must be last). Ensures clients always get JSON — e.g. a
// CORS rejection returns {message:"Not allowed by CORS"} with the right status
// instead of Express's default HTML page (which broke the frontend's res.json()).
// eslint-disable-next-line no-unused-vars
app.use((err, req, res, next) => {
  const status = err.status || 500;
  if (err && err.message === "Not allowed by CORS") {
    return res.status(403).json({ message: "Origin not allowed by CORS" });
  }
  console.error("Unhandled error:", err);
  res.status(status).json({ message: status === 500 ? "Internal server error" : err.message });
});

// Cron jobs must run on exactly ONE worker, else every clustered instance fires
// the same IndiaMart/TradeIndia pull. PM2 sets NODE_APP_INSTANCE per worker;
// run crons only on instance 0 (or when not clustered / NODE_APP_INSTANCE unset).
const isPrimaryWorker = !process.env.NODE_APP_INSTANCE || process.env.NODE_APP_INSTANCE === "0";
if (isPrimaryWorker) {
  require("./cron/tradeIndiaCron");
  require("./cron/indiaMartCron");
} else {
  console.log(`ℹ️  Worker ${process.env.NODE_APP_INSTANCE}: crons skipped (run on instance 0 only)`);
}

const PORT = process.env.PORT || 5010;
const server = app.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT} (pid ${process.pid})`);
});

// --- Graceful shutdown ---
// Stop accepting new connections, drain in-flight requests, close Mongo, exit.
let shuttingDown = false;
const shutdown = (signal) => {
  if (shuttingDown) return;
  shuttingDown = true;
  console.log(`\n${signal} received — shutting down gracefully…`);

  // Force-exit safety net if draining hangs.
  const forceTimer = setTimeout(() => {
    console.error("⏱️  Graceful shutdown timed out — forcing exit.");
    process.exit(1);
  }, 10000);
  forceTimer.unref();

  server.close(async () => {
    try {
      await mongoose.connection.close(false);
      console.log("✅ HTTP server closed and MongoDB connection drained.");
      clearTimeout(forceTimer);
      process.exit(0);
    } catch (err) {
      console.error("Error during shutdown:", err);
      process.exit(1);
    }
  });
};

["SIGTERM", "SIGINT"].forEach((sig) => process.on(sig, () => shutdown(sig)));
// PM2 sends "shutdown" via IPC on Windows / when wait_ready is used.
process.on("message", (msg) => { if (msg === "shutdown") shutdown("shutdown"); });
