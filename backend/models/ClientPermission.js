const mongoose = require("mongoose");

const clientPermissionSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
  clientId: { type: mongoose.Schema.Types.ObjectId, ref: "ClientData", required: true },
  permissions: {
    view: { type: Boolean, default: false },
    update: { type: Boolean, default: false },
    delete: { type: Boolean, default: false },
  },
});

clientPermissionSchema.index({ userId: 1, clientId: 1 }, { unique: true });

module.exports = mongoose.model("ClientPermission", clientPermissionSchema);
