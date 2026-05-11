const express = require('express');
const router = express.Router();
const { authenticate } = require('../middleware/auth');
const { dbGet, dbAll, dbRun } = require('../utils/helpers');
const logger = require('../utils/logger');

router.get('/stats', authenticate, async (req, res) => {
  try {
    const today = new Date().toISOString().split('T')[0];

    const [totalRevenue, todayRevenue, totalPCs, activeSessions, todaySessions, customers, todayPayments] = await Promise.all([
      dbGet('SELECT COALESCE(SUM(amount), 0) as total FROM payments'),
      dbGet('SELECT COALESCE(SUM(amount), 0) as total FROM payments WHERE DATE(created_at) = ?', [today]),
      dbGet('SELECT COUNT(*) as count FROM pcs'),
      dbGet('SELECT COUNT(*) as count FROM sessions WHERE status = "active"'),
      dbGet('SELECT COUNT(*) as count FROM sessions WHERE DATE(start_time) = ?', [today]),
      dbGet('SELECT COUNT(*) as count FROM customers'),
      dbGet('SELECT COUNT(*) as count FROM payments WHERE DATE(created_at) = ?', [today]),
    ]);

    const totalSpent = await dbGet('SELECT COALESCE(SUM(wallet_balance), 0) as total FROM customers');

    res.json({
      revenue: {
        total: totalRevenue.total,
        today: todayRevenue.total,
        today_count: todayPayments.count,
      },
      pcs: {
        total: totalPCs.count,
      },
      sessions: {
        active: activeSessions.count,
        today: todaySessions.count,
      },
      customers: {
        total: customers.count,
        total_wallet_balance: totalSpent.total,
      },
    });
  } catch (err) {
    logger.error('Dashboard stats error', err.message);
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;