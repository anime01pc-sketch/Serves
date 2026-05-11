const express = require('express');
const Rate = require('../models/Rate');
const router = express.Router();

router.get('/', async (req, res) => {
    try {
        const rates = await Rate.find().sort({ name: 1 });
        res.json(rates);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

router.post('/', async (req, res) => {
    try {
        const { name, hourlyRate, currency } = req.body;
        if (!name || !hourlyRate) return res.status(400).json({ error: 'Name and rate required' });
        const rate = await Rate.create({ name, hourlyRate, currency: currency || 'PKR' });
        res.status(201).json(rate);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

router.put('/:id', async (req, res) => {
    try {
        const rate = await Rate.findByIdAndUpdate(req.params.id, req.body, { new: true });
        if (!rate) return res.status(404).json({ error: 'Rate not found' });
        res.json(rate);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

router.delete('/:id', async (req, res) => {
    try {
        await Rate.findByIdAndDelete(req.params.id);
        res.json({ message: 'Rate deleted' });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

module.exports = router;