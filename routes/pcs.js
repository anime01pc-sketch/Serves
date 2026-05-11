const express = require('express');
const PC = require('../models/PC');
const Session = require('../models/Session');
const router = express.Router();

router.get('/', async (req, res) => {
    try {
        const pcs = await PC.find().sort({ name: 1 });
        const sessions = await Session.find({ status: 'active' });
        const pcsWithSession = pcs.map(pc => {
            const session = sessions.find(s => s.pcId.toString() === pc._id.toString());
            return { ...pc.toObject(), session: session || null };
        });
        res.json(pcsWithSession);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

router.post('/', async (req, res) => {
    try {
        const { name, specs, hourlyRate } = req.body;
        if (!name || !hourlyRate) return res.status(400).json({ error: 'Name and rate required' });
        const pc = await PC.create({ name, specs, hourlyRate });
        res.json(pc);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

router.put('/:id', async (req, res) => {
    try {
        const pc = await PC.findByIdAndUpdate(req.params.id, req.body, { new: true });
        if (!pc) return res.status(404).json({ error: 'PC not found' });
        res.json(pc);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

router.delete('/:id', async (req, res) => {
    try {
        const active = await Session.findOne({ pcId: req.params.id, status: 'active' });
        if (active) return res.status(400).json({ error: 'PC has active session' });
        await PC.findByIdAndDelete(req.params.id);
        res.json({ message: 'PC deleted' });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

module.exports = router;