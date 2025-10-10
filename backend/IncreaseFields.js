const mongoose = require("mongoose");
require("dotenv").config();

mongoose.connect(process.env.MONGO_URI, {
  useNewUrlParser: true,
  useUnifiedTopology: true,
});

const db = mongoose.connection;

const clientSchema = new mongoose.Schema({}, { strict: false });
const ClientData = mongoose.model("ClientData", clientSchema);

db.once("open", async () => {
  console.log("✅ Connected to MongoDB");

  try {
    const clients = await ClientData.find({});
    let updatedCount = 0;

    for (const client of clients) {
      const updateData = {};

      
      if (!client.billingAddress) {
        updateData.billingAddress = client.address || "";
      }

      
      if (!client.shippingAddress) {
        updateData.shippingAddress = "";
      }

      if (Object.keys(updateData).length > 0) {
        await ClientData.updateOne(
          { _id: client._id },
          { $set: updateData }
        );
        updatedCount++;
      }
    }

    console.log(`✅ Added new address fields to ${updatedCount} client documents.`);
  } catch (err) {
    console.error("❌ Error during migration:", err);
  } finally {
    mongoose.disconnect();
  }
});
