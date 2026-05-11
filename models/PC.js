const mongoose = require('mongoose');

const pcSchema = new mongoose.Schema({
    name: { type: String, required: true },
    status: { type: String, enum: ['available', 'in-use', 'maintenance', 'offline'], default: 'available' },
    specs: { type: String },
    hourlyRate: { type: Number, required: true },
    createdAt: { type: Date, default: Date.now },
    updatedAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model('PC', pcSchema);