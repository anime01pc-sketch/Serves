const express = require('express');
const Session = require('../models/Session');
const PC = require('../models/PC');
const Customer = require('../models/Customer');
const Payment = require('../models/Payment');
const router = express.Router();

router.get('/stats', async (req, res) => {
    try {
        const [activeSessions, totalPCs, totalCustomers, todayRevenue] = await Promise.all([
            Session.countDocuments({ status: 'active' }),
            PC.countDocuments(),
            Customer.countDocuments(),
            Payment.aggregate([
                {
                    $match: {
                        createdAt: { $gte: new Date(new Date().setHours(0, 0, 0, 0)) }
                    }
                },
                { $group: { _id: null, total: { $sum: '$amount' } } }
            ])
        ]);
        res.json({
            activeSessions,
            totalPCs,
            totalCustomers,
            todayRevenue: todayRevenue[0]?.total || 0
        });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

router.get('/reports/daily', async (req, res) => {
    try {
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const tomorrow = new Date(today);
        tomorrow.setDate(tomorrow.getDate() + 1);

        const [revenue, sessionCount, avgDuration] = await Promise.all([
            Payment.aggregate([
                { $match: { createdAt: { $gte: today, $lt: tomorrow } } },
                { $group: { _id: null, total: { $sum: '$amount' } } }
            ]),
            Session.countDocuments({ startTime: { $gte: today, $lt: tomorrow } }),
            Session.aggregate([
                {
                    $match: {
                        startTime: { $gte: today, $lt: tomorrow },
                        status: 'ended'
                    }
                },
                {
                    $project: { duration: { $subtract: ['$endTime', '$startTime'] } }
                },
                { $group: { _id: null, avg: { $avg: '$duration' } } }
            ])
        ]);

        res.json({
            date: today.toDateString(),
            revenue: revenue[0]?.total || 0,
            sessions: sessionCount,
            avgDurationMs: avgDuration[0]?.avg || 0
        });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

router.get('/reports/monthly', async (req, res) => {
    try {
        const start = new Date();
        start.setDate(1);
        start.setHours(0, 0, 0, 0);

        const revenue = await Payment.aggregate([
            { $match: { createdAt: { $gte: start } } },
            { $group: { _id: null, total: { $sum: '$amount' } } }
        ]);

        const sessions = await Session.countDocuments({ startTime: { $gte: start } });

        res.json({
            month: start.toLocaleString('default', { month: 'long', year: 'numeric' }),
            revenue: revenue[0]?.total || 0,
            totalSessions: sessions
        });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

module.exports = router;