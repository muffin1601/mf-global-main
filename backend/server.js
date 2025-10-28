const express = require("express");
const mongoose = require("mongoose");
const cors = require("cors");
// const fs = require("fs");
// const path = require("path");
require("dotenv").config();

const app = express();

// Middleware
// app.use(cors({
//   origin: 'https://mfglobalservices.com'  // allow requests from your domain
// }));
app.use(cors());
app.use(express.json({ limit: "50mb" }));
app.use(express.urlencoded({ extended: true, limit: "50mb" }));

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
app.use("/api", require("./routes/Products/ProductOverview"));

require("./cron/tradeIndiaCron");
require("./cron/indiaMartCron");

app.use("/api", require("./routes/salesPerformance"))


const PORT = process.env.PORT || 5010;
app.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
});
