const mongoose = require('mongoose');

const paymentSchema = new mongoose.Schema({
    sessionId: { type: mongoose.Schema.Types.ObjectId, ref: 'Session' },
    customerId: { type: mongoose.Schema.Types.ObjectId, ref: 'Customer' },
    amount: { type: Number, required: true },
    method: { type: String, enum: ['cash', 'jazzcash', 'easypaisa', 'wallet'], required: true },
    reference: { type: String },
    status: { type: String, enum: ['completed', 'pending', 'failed', 'refunded'], default: 'completed' },
    createdAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model('Payment', paymentSchema);