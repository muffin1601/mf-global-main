const mongoose = require("mongoose");

const additionalContactSchema = new mongoose.Schema({
  name: { type: String },
  contact: { type: String },
  details: { type: String }
}, { _id: false });

const clientSchema = new mongoose.Schema(
  {
    name: { type: String },
    company: { type: String },
    email: { type: String },
    phone: { type: String },
    contact: { type: String },
    location: { type: String },
    category: { type: String },
    quantity: { type: Number },
    requirements: { type: String },
    remarks: { type: String },
    datatype: { type: String },
    callStatus: { type: String, default: "Not Called" },
    followUpDate: { type: Date, default: null },
    assignedTo: [
      {
        user: {
          _id: { type: mongoose.Schema.Types.ObjectId, required: true },
          name: { type: String, required: true },
        },
        permissions: {
          view: { type: Boolean, default: false },
          update: { type: Boolean, default: false },
          delete: { type: Boolean, default: false },
        },
      },
    ],
    status: { type: String, default: "New Lead" },
    followUpDateOne: { type: Date, default: null },
    followUpDateTwo: { type: Date, default: null },
    followUpDateThree: { type: Date, default: null },
    inquiryDate: { type: String },
    address: { type: String },
    fileName: { type: String, default: null },
    // New Field
    additionalContacts: [additionalContactSchema]
  },
  { timestamps: true }
);

module.exports = mongoose.model("ClientData", clientSchema);
