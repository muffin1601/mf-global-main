const { coachingpromoDB } = require("../config/externalDbs");
const CoachingSchema = require("../schemas/coachingpromo/productSchema");

module.exports = coachingpromoDB.model("Product", CoachingSchema);
