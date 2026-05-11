const express = require('express');
const router = express.Router();
const { authenticate } = require('../middleware/auth');
const { dbAll, dbGet } = require('../utils/helpers');
const logger = require('../utils/logger');

router.get('/daily', authenticate, async (req, res) => {
  try {
    const date = req.query.date || new Date().toISOString().split('T')[0];
    const revenue = await dbGet('SELECT COALESCE(SUM(amount), 0) as total FROM payments WHERE DATE(created_at) = ?', [date]);
    const sessions = await dbAll('SELECT COUNT(*) as count FROM sessions WHERE DATE(start_time) = ?', [date]);
    const activeCustomers = await dbAll('SELECT COUNT(DISTINCT customer_id) as count FROM sessions WHERE DATE(start_time) = ?', [date]);
    res.json({ date, revenue: revenue.total, session_count: sessions[0].count, unique_customers: activeCustomers[0].count });
  } catch (err) {
    logger.error('Daily report error', err.message);
    res.status(500).json({ error: err.message });
  }
});

router.get('/weekly', authenticate, async (req, res) => {
  try {
    const now = new Date();
    const dayOfWeek = now.getDay();
    const startOfWeek = new Date(now);
    startOfWeek.setDate(now.getDate() - dayOfWeek);
    startOfWeek.setHours(0, 0, 0, 0);
    const endOfWeek = new Date(startOfWeek);
    endOfWeek.setDate(startOfWeek.getDate() + 7);

    const startStr = startOfWeek.toISOString().split('T')[0];
    const endStr = endOfWeek.toISOString().split('T')[0];

    const revenue = await dbGet('SELECT COALESCE(SUM(amount), 0) as total FROM payments WHERE created_at >= ? AND created_at < ?', [startStr, endStr]);
    const sessions = await dbAll('SELECT COUNT(*) as count FROM sessions WHERE start_time >= ? AND start_time < ?', [startStr, endStr]);
    const payments = await dbAll('SELECT DATE(created_at) as date, COALESCE(SUM(amount), 0) as daily_total FROM payments WHERE created_at >= ? AND created_at < ? GROUP BY DATE(created_at)', [startStr, endStr]);
    res.json({ week_start: startStr, week_end: endStr, revenue: revenue.total, session_count: sessions[0].count, daily_breakdown: payments });
  } catch (err) {
    logger.error('Weekly report error', err.message);
    res.status(500).json({ error: err.message });
  }
});

router.get('/monthly', authenticate, async (req, res) => {
  try {
    const month = parseInt(req.query.month) || new Date().getMonth() + 1;
    const year = parseInt(req.query.year) || new Date().getFullYear();
    const startDate = `${year}-${String(month).padStart(2, '0')}-01`;
    const endMonth = month === 12 ? 1 : month + 1;
    const endYear = month === 12 ? year + 1 : year;
    const endDate = `${endYear}-${String(endMonth).padStart(2, '0')}-01`;

    const revenue = await dbGet('SELECT COALESCE(SUM(amount), 0) as total FROM payments WHERE created_at >= ? AND created_at < ?', [startDate, endDate]);
    const sessions = await dbAll('SELECT COUNT(*) as count FROM sessions WHERE start_time >= ? AND start_time < ?', [startDate, endDate]);
    const dailyPayments = await dbAll('SELECT DATE(created_at) as date, COALESCE(SUM(amount), 0) as daily_total FROM payments WHERE created_at >= ? AND created_at < ? GROUP BY DATE(created_at) ORDER BY date LIMIT 31', [startDate, endDate]);
    res.json({ month, year, revenue: revenue.total, session_count: sessions[0].count, daily_breakdown: dailyPayments });
  } catch (err) {
    logger.error('Monthly report error', err.message);
    res.status(500).json({ error: err.message });
  }
});

router.get('/utilization', authenticate, async (req, res) => {
  try {
    const totalPCs = await dbGet('SELECT COUNT(*) as count FROM pcs');
    const activePCs = await dbGet('SELECT COUNT(*) as count FROM pcs WHERE status = "in-use"');
    const offlinePCs = await dbGet('SELECT COUNT(*) as count FROM pcs WHERE status = "offline"');
    const onlinePCs = await dbGet('SELECT COUNT(*) as count FROM pcs WHERE status = "online"');
    const activeSessions = await dbGet('SELECT COUNT(*) as count FROM sessions WHERE status = "active"');
    const avgDuration = await dbGet('SELECT COALESCE(AVG(duration_mins), 0) as avg FROM sessions WHERE status = "completed" AND DATE(start_time) = DATE("now")');
    res.json({ total: totalPCs.count, in_use: activePCs.count, offline: offlinePCs.count, online: onlinePCs.count, active_sessions: activeSessions.count, avg_session_duration: Math.round(avgDuration.avg) });
  } catch (err) {
    logger.error('Utilization report error', err.message);
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;