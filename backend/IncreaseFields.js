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
      let newCode = "";

      if (client.countryCode && client.countryCode !== "") {
        
        let currentCode = parseInt(client.countryCode.replace("+", ""), 10);
        if (isNaN(currentCode)) {
          currentCode = null; 
        }

        if (currentCode !== null) {
          newCode = String(currentCode + 1); 
        } else {
          newCode = client.countryCode; 
        }
      } else {
      
        newCode = "+91";
      }

      await ClientData.updateOne(
        { _id: client._id },
        { $set: { countryCode: newCode } }
      );

      updatedCount++;
    }

    console.log(`✅ Processed ${updatedCount} client documents, countryCode updated/kept as is.`);
  } catch (err) {
    console.error("❌ Error during migration:", err);
  } finally {
    mongoose.disconnect();
  }
});
