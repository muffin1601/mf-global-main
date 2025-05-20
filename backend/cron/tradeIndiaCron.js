const cron = require("node-cron");
const fetchAndStoreLeads = require("../scripts/fetchTradeIndiaLeadsToCRM");

// Every 5 minutes: "*/5 * * * *"
cron.schedule("*/5 * * * *", async () => {
  console.log("⏰ Running TradeIndia lead fetch job...");
  await fetchAndStoreLeads();
});
