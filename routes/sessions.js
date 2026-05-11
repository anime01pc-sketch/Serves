const express = require('express');
const Session = require('../models/Session');
const PC = require('../models/PC');
const Customer = require('../models/Customer');
const Payment = require('../models/Payment');
const router = express.Router();

router.get('/', async (req, res) => {
    try {
        const sessions = await Session.find().populate('pcId').populate('customerId').sort({ startTime: -1 });
        res.json(sessions);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

router.post('/start', async (req, res) => {
    try {
        const { pcId, customerId, startTime } = req.body;
        if (!pcId) return res.status(400).json({ error: 'PC ID required' });

        const pc = await PC.findById(pcId);
        if (!pc) return res.status(404).json({ error: 'PC not found' });

        const active = await Session.findOne({ pcId, status: 'active' });
        if (active) return res.status(400).json({ error: 'PC already in use' });

        const session = await Session.create({ pcId, customerId, startTime: startTime ? new Date(startTime) : undefined });
        await PC.findByIdAndUpdate(pcId, { status: 'in-use' });
        const full = await Session.findById(session._id).populate('pcId').populate('customerId');
        res.json(full);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

router.post('/end/:id', async (req, res) => {
    try {
        const session = await Session.findById(req.params.id);
        if (!session) return res.status(404).json({ error: 'Session not found' });
        if (session.status !== 'active') return res.status(400).json({ error: 'Session not active' });

        const endTime = new Date();
        let totalAmount = 0;

        if (session.startTime) {
            let elapsedMs = endTime - session.startTime - session.totalPausedMs;
            if (session.pausedAt) elapsedMs -= (endTime - session.pausedAt);
            const elapsedHr = elapsedMs / 3600000;
            const pc = await PC.findById(session.pcId);
            if (pc) totalAmount = Math.ceil(elapsedHr * pc.hourlyRate * 100) / 100;
        }

        session.endTime = endTime;
        session.status = 'ended';
        session.totalAmount = totalAmount;
        await session.save();

        await PC.findByIdAndUpdate(session.pcId, { status: 'available' });

        const full = await Session.findById(session._id).populate('pcId').populate('customerId');
        res.json(full);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

router.post('/pause/:id', async (req, res) => {
    try {
        const session = await Session.findById(req.params.id);
        if (!session || session.status !== 'active') return res.status(400).json({ error: 'Session not active' });
        if (!session.pausedAt) {
            session.pausedAt = new Date();
            await session.save();
        }
        const full = await Session.findById(session._id).populate('pcId').populate('customerId');
        res.json(full);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

router.post('/resume/:id', async (req, res) => {
    try {
        const session = await Session.findById(req.params.id);
        if (!session || session.status !== 'active') return res.status(400).json({ error: 'Session not active' });
        if (session.pausedAt) {
            session.totalPausedMs += Date.now() - session.pausedAt;
            session.pausedAt = null;
            await session.save();
        }
        const full = await Session.findById(session._id).populate('pcId').populate('customerId');
        res.json(full);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

module.exports = router;