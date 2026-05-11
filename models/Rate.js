const mongoose = require('mongoose');

const rateSchema = new mongoose.Schema({
    name: { type: String, required: true },
    hourlyRate: { type: Number, required: true },
    currency: { type: String, default: 'PKR' },
    createdAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model('Rate', rateSchema);