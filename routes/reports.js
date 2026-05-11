const express = require('express');
const router = express.Router();
const Session = require('../models/Session');
const PC = require('../models/PC');
const Payment = require('../models/Payment');

router.get('/daily', async (req, res) => {
    try {
        const dateStr = req.query.date || new Date().toISOString().split('T')[0];
        const start = new Date(dateStr);
        start.setHours(0, 0, 0, 0);
        const end = new Date(start);
        end.setDate(end.getDate() + 1);

        const [revenue, sessions, uniqueCustomers] = await Promise.all([
            Payment.aggregate([
                { $match: { createdAt: { $gte: start, $lt: end } } },
                { $group: { _id: null, total: { $sum: '$amount' } } }
            ]),
            Session.countDocuments({ startTime: { $gte: start, $lt: end } }),
            Session.distinct('customerId', { startTime: { $gte: start, $lt: end } })
        ]);

        res.json({
            date: dateStr,
            revenue: revenue[0]?.total || 0,
            session_count: sessions,
            unique_customers: uniqueCustomers.length
        });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

router.get('/weekly', async (req, res) => {
    try {
        const now = new Date();
        const dayOfWeek = now.getDay();
        const start = new Date(now);
        start.setDate(now.getDate() - dayOfWeek);
        start.setHours(0, 0, 0, 0);
        const end = new Date(start);
        end.setDate(start.getDate() + 7);

        const [revenue, sessions, dailyBreakdown] = await Promise.all([
            Payment.aggregate([
                { $match: { createdAt: { $gte: start, $lt: end } } },
                { $group: { _id: null, total: { $sum: '$amount' } } }
            ]),
            Session.countDocuments({ startTime: { $gte: start, $lt: end } }),
            Payment.aggregate([
                { $match: { createdAt: { $gte: start, $lt: end } } },
                { $group: { _id: { $dateToString: { format: '%Y-%m-%d', date: '$createdAt' } }, daily_total: { $sum: '$amount' } } },
                { $sort: { _id: 1 } }
            ])
        ]);

        res.json({
            week_start: start.toISOString().split('T')[0],
            week_end: end.toISOString().split('T')[0],
            revenue: revenue[0]?.total || 0,
            session_count: sessions,
            daily_breakdown: dailyBreakdown
        });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

router.get('/monthly', async (req, res) => {
    try {
        const month = parseInt(req.query.month) || new Date().getMonth() + 1;
        const year = parseInt(req.query.year) || new Date().getFullYear();
        const start = new Date(year, month - 1, 1);
        const end = new Date(month === 12 ? year + 1 : year, month === 12 ? 0 : month, 1);

        const [revenue, sessions, dailyBreakdown] = await Promise.all([
            Payment.aggregate([
                { $match: { createdAt: { $gte: start, $lt: end } } },
                { $group: { _id: null, total: { $sum: '$amount' } } }
            ]),
            Session.countDocuments({ startTime: { $gte: start, $lt: end } }),
            Payment.aggregate([
                { $match: { createdAt: { $gte: start, $lt: end } } },
                { $group: { _id: { $dateToString: { format: '%Y-%m-%d', date: '$createdAt' } }, daily_total: { $sum: '$amount' } } },
                { $sort: { _id: 1 } },
                { $limit: 31 }
            ])
        ]);

        res.json({ month, year, revenue: revenue[0]?.total || 0, session_count: sessions, daily_breakdown: dailyBreakdown });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

router.get('/utilization', async (req, res) => {
    try {
        const [total, inUse, offline, activeSessions, avgDuration] = await Promise.all([
            PC.countDocuments(),
            PC.countDocuments({ status: 'in-use' }),
            PC.countDocuments({ status: 'offline' }),
            Session.countDocuments({ status: 'active' }),
            Session.aggregate([
                {
                    $match: {
                        status: 'ended',
                        startTime: { $gte: new Date(new Date().setHours(0, 0, 0, 0)) }
                    }
                },
                {
                    $project: { durationMs: { $subtract: ['$endTime', '$startTime'] } }
                },
                { $group: { _id: null, avg: { $avg: '$durationMs' } } }
            ])
        ]);

        res.json({
            total,
            in_use: inUse,
            offline,
            active_sessions: activeSessions,
            avg_session_duration: Math.round((avgDuration[0]?.avg || 0) / 60000)
        });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

module.exports = router;