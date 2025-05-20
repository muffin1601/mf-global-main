const mongoose = require("mongoose");
require("dotenv").config();

mongoose.connect(process.env.MONGO_URI, {
  useNewUrlParser: true,
  useUnifiedTopology: true,
});

const db = mongoose.connection;

const clientSchema = new mongoose.Schema({}, { strict: false });
const ClientData = mongoose.model("ClientData", clientSchema);

const userSchema = new mongoose.Schema({}, { strict: false });
const User = mongoose.model("User", userSchema, "users"); // Adjust collection name if needed

db.once("open", async () => {
  console.log("✅ Connected to MongoDB");

  try {
    const clients = await ClientData.find({ assignedTo: { $exists: true } });

    let updatedCount = 0;

    for (const client of clients) {
      const newAssignedTo = [];

      for (const assignee of client.assignedTo || []) {
        let newUser;

        if (assignee.user && mongoose.Types.ObjectId.isValid(assignee.user)) {
          const userDoc = await User.findById(assignee.user, "_id name");

          newUser = userDoc
            ? { _id: userDoc._id, name: userDoc.name || null }
            : { _id: null, name: null };
        } else {
          // If user is null, undefined, or invalid ObjectId, set both to null
          newUser = { _id: null, name: null };
        }

        newAssignedTo.push({
          user: newUser,
          permissions: assignee.permissions || {
            view: false,
            update: false,
            delete: false,
          },
        });
      }

      await ClientData.updateOne(
        { _id: client._id },
        { $set: { assignedTo: newAssignedTo } }
      );

      updatedCount++;
    }

    console.log(`✅ Updated ${updatedCount} client documents with new assignedTo format.`);
  } catch (err) {
    console.error("❌ Error during migration:", err);
  } finally {
    mongoose.disconnect();
  }
});
