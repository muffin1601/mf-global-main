const { printkeeDB } = require("../config/externalDbs");
const PrintkeeSchema = require("../schemas/printkee/categorySchema");

module.exports = printkeeDB.model("Category", PrintkeeSchema);
