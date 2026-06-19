const mongoose = require("mongoose");
const Counter = require("./Counter");

const userSchema = new mongoose.Schema({
  name: String,
  userId: { type: String },
  username: { type: String, required: true },
  email: { type: String, required: true },
  password: { type: String, required: true },
  location: String,
  role: { type: String, enum: ["admin", "user"], required: true },
  enabled: { type: Boolean, default: true },
});

userSchema.pre("save", async function (next) {
  if (this.userId) return next(); // already set

  try {
    const prefix = this.name ? this.name.charAt(0).toUpperCase() : "U";

    const counter = await Counter.findOneAndUpdate(
      { role: this.role },
      { $inc: { seq: 1 } },
      { new: true, upsert: true }
    );

    this.userId = `${prefix}${counter.seq.toString().padStart(3, "0")}`;
    next();
  } catch (err) {
    next(err);
  }
});

// --- P0 performance index ---
// Login does User.findOne({ username }); index it. Unique enforces the
// integrity login already assumes. NOTE: if duplicate usernames already
// exist in the collection, the unique build will fail — de-dupe first,
// or change `{ unique: true }` to a plain index.
userSchema.index({ username: 1 }, { unique: true });

module.exports = mongoose.model("User", userSchema);
