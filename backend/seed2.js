const mongoose = require("mongoose");
const Product = require("./models/ProductData"); // update path if needed

require("dotenv").config();

(async () => {
  try {
    await mongoose.connect(process.env.MONGO_URI, { useNewUrlParser: true, useUnifiedTopology: true });

    console.log("Connected to DB");

    const result = await Product.updateMany(
      { dimension: { $exists: false } },   // only products missing the field
      { $set: { dimension: "" } }         // add default value
    );

    console.log(`Updated ${result.modifiedCount} products.`);
    mongoose.disconnect();
  } catch (err) {
    console.error("Migration failed:", err);
  }
})();
