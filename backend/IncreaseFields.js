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
      let newState = "";

      if (client.state && client.state !== "") {
        let currentState = parseInt(client.state, 10);
        if (isNaN(currentState)) currentState = 0;
        newState = String(currentState + 1);
      } else {
        // keep empty if originally empty
        newState = "";
      }

      await ClientData.updateOne(
        { _id: client._id },
        { $set: { state: newState } }
      );

      updatedCount++;
    }

    console.log(`✅ Processed ${updatedCount} client documents, state updated/kept empty.`);
  } catch (err) {
    console.error("❌ Error during migration:", err);
  } finally {
    mongoose.disconnect();
  }
});
