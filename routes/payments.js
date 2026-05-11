const express = require('express');
const Payment = require('../models/Payment');
const Session = require('../models/Session');
const router = express.Router();

router.get('/', async (req, res) => {
    try {
        const payments = await Payment.find().populate('sessionId').populate('customerId').sort({ createdAt: -1 });
        res.json(payments);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

router.post('/', async (req, res) => {
    try {
        const { sessionId, customerId, amount, method, reference } = req.body;
        if (!amount || !method) return res.status(400).json({ error: 'Amount and method required' });
        const payment = await Payment.create({ sessionId, customerId, amount, method, reference });
        const full = await Payment.findById(payment._id).populate('sessionId').populate('customerId');
        res.json(full);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

module.exports = router;