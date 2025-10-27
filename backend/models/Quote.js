const mongoose = require('mongoose');

// const AddressSchema = new mongoose.Schema({
//   street: { type: String },
//   city: { type: String },
//   state: { type: String },
//   postalCode: { type: String },
//   country: { type: String },
// });

const ShippingAddressSchema = new mongoose.Schema({
  name: { type: String },
  address: { type: String },
  state: { type: String },
});

const PartySchema = new mongoose.Schema({
  name: { type: String, required: true },
  company: { type: String },
  phone: { type: String },
  billToAddress:  { type: String },
  state: { type: String },
  pan: { type: String },
  shippingAddresses: [ShippingAddressSchema],
  selectedShippingAddress: ShippingAddressSchema,
});

const ItemSchema = new mongoose.Schema({
  name: { type: String, required: true },
  description: { type: String },
  hsn: { type: String },
  qty: { type: Number, required: true },
  price: { type: Number, required: true },
  discount: { type: Number, default: 0 },
  tax: { type: Number, default: 0 },
});

const BankDetailsSchema = new mongoose.Schema({
  accountHolder: { type: String },
  accountNumber: { type: String },
  ifscCode: { type: String },
  bankName: { type: String },
  upiId: { type: String },
});

const InvoiceDetailsSchema = new mongoose.Schema({
  prefix: { type: String },
  number: { type: String },
  date: { type: Date },
  validityDays: { type: Number },
  validityDate: { type: Date },
  poNo: { type: String },
  placeOfSupply: { type: String },
});

const SummarySchema = new mongoose.Schema({
  discount: { type: Number, default: 0 },
  discountType: { type: String, enum: ["%", "₹"], default: "%" },
  additionalCharges: { type: Number, default: 0 },
  applyTCS: { type: Boolean, default: false },
  autoRoundOff: { type: Boolean, default: false },
  roundOffSign: { type: String, enum: ["+", "-"], default: "+" },
  roundOffAmount: { type: Number, default: 0 },
  amountReceived: { type: Number, default: 0 },
  paymentMethod: { type: String, default: "Cash" },
});

const QuotationSchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true }, 
    party: PartySchema,
    items: [ItemSchema],
    terms: { type: String },
    notes: { type: String },
    bankDetails: BankDetailsSchema,
    invoiceDetails: InvoiceDetailsSchema,
    summary: SummarySchema,
  },
  { timestamps: true } 
);

module.exports = mongoose.model("Quotation", QuotationSchema);


