const mongoose = require("mongoose");

const printkeeDB = mongoose.createConnection(process.env.PRINTKEE_DB_URI, {
  useNewUrlParser: true,
  useUnifiedTopology: true,
});

const coachingpromoDB = mongoose.createConnection(process.env.COACHINGPROMO_DB_URI, {
  useNewUrlParser: true,
  useUnifiedTopology: true,
});

printkeeDB.on("connected", () => console.log("Printkee DB connected (from CRM)"));
coachingpromoDB.on("connected", () => console.log("CoachingPromo DB connected (from CRM)"));

module.exports = { printkeeDB, coachingpromoDB };
