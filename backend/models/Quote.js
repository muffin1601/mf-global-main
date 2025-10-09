const mongoose = require('mongoose');

const productSchema2 = new mongoose.Schema({
    product_code: { type: String },
    p_name: { type: String, required: true },
    p_price: {
        single_price: { type: Number, default: 0 },
    },
    GST_rate: { type: Number, default: 0 },
    quantity: { type: Number, default: 1 },
    totalPrice: { type: Number, default: 0 }
});

const quotationSchema = new mongoose.Schema(
    {
        quotationNumber: { type: String, required: true, unique: true },
        quotationDate: { type: Date, default: Date.now },
        customer: {
            name: { type: String, required: true },
            company: { type: String },
            address: { type: String, required: true },
            phone: { type: String },
            email: { type: String },
            remarks: { type: String },
        },
        deliveryTime: { type: String },
        paymentTerms: { type: String },
        validityPeriod: { type: String },
        notes: { type: String },
        products: [productSchema2],
        grandTotal: { type: Number, default: 0 },
    },
    { timestamps: true }
);

module.exports = mongoose.model('Quotation', quotationSchema);
