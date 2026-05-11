const mongoose = require('mongoose');

const sessionSchema = new mongoose.Schema({
    pcId: { type: mongoose.Schema.Types.ObjectId, ref: 'PC', required: true },
    customerId: { type: mongoose.Schema.Types.ObjectId, ref: 'Customer' },
    startTime: { type: Date, default: Date.now },
    endTime: { type: Date },
    status: { type: String, enum: ['active', 'ended', 'cancelled'], default: 'active' },
    totalAmount: { type: Number, default: 0 },
    pausedAt: { type: Date },
    totalPausedMs: { type: Number, default: 0 }
});

sessionSchema.virtual('elapsedMs').get(function () {
    if (this.status !== 'active') return 0;
    const base = (this.endTime || Date.now()) - this.startTime;
    const paused = this.pausedAt ? Date.now() - this.pausedAt : 0;
    return base - this.totalPausedMs - paused;
});

sessionSchema.set('toJSON', { virtuals: true });

module.exports = mongoose.model('Session', sessionSchema);