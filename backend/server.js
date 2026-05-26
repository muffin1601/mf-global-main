const express = require("express");
const mongoose = require("mongoose");
const cors = require("cors");
// const fs = require("fs");
const path = require("path");
require("dotenv").config();

const app = express();

// Middleware
const allowedOrigins = (process.env.CORS_ORIGINS || process.env.FRONTEND_URL || "http://localhost:5173,http://127.0.0.1:5173")
  .split(",")
  .map((origin) => origin.trim())
  .filter(Boolean);

app.use(cors({
  origin: (origin, callback) => {
    if (!origin || allowedOrigins.includes(origin)) {
      return callback(null, true);
    }
    return callback(new Error("Not allowed by CORS"));
  },
}));
app.use(express.json({ limit: "50mb" }));
app.use(express.urlencoded({ extended: true, limit: "50mb" }));

app.use("/uploads", express.static(path.join(__dirname, "uploads")));

// MongoDB Connection
mongoose.connect(process.env.MONGO_URI, {
  useNewUrlParser: true,
  useUnifiedTopology: true,
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

require("./cron/tradeIndiaCron");
require("./cron/indiaMartCron");


const PORT = process.env.PORT || 5010;
app.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
});
