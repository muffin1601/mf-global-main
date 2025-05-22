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
app.use("/api", require("./routes/client"));
app.use("/api", require("./routes/upload"));
app.use("/api", require("./routes/fetch-client"));
app.use("/api", require("./routes/login"));
app.use("/api", require("./routes/dashboard"));
app.use("/api", require("./routes/admin"));
app.use("/api", require("./routes/activitylog"));
app.use("/api", require("./routes/followup"));
app.use("/api", require("./routes/assignment-routes"));
app.use("/api", require("./routes/clientwork"));
app.use("/api", require("./routes/leads"));
app.use("/api", require("./routes/dashboardoverview"));
app.use("/api", require("./routes/Todo-Performance"));
app.use("/api", require("./routes/Products/product"));
app.use("/api", require("./routes/Products/vendor"));
app.use("/api", require("./routes/Products/ProductOverview"));

require("./cron/tradeIndiaCron");
require("./cron/indiaMartCron");
// Start server
const PORT = process.env.PORT || 5010;
app.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
});
