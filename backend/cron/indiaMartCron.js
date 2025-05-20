const cron = require("node-cron");
const fetchLeadsFromIndiaMart = require("../scripts/fetchLeadsFromIndiaMart");

// Run every 5 minutes
cron.schedule("*/5 * * * *", async () => {
  console.log("⏰ Running IndiaMART lead fetch job...");
  await fetchLeadsFromIndiaMart();
});
