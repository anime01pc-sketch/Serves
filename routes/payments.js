const express = require('express');
const router = express.Router();
const db = require('../config/database');
const Payment = require('../models/Payment');
const SystemLog = require('../models/SystemLog');
const { authenticate, authorizeAdmin } = require('../middleware/auth');
const { dbGet, dbRun, now } = require('../utils/helpers');
const logger = require('../utils/logger');

router.get('/', authenticate, async (req, res) => {
  try {
    const payments = await Payment.getAll();
    res.json(payments);
  } catch (err) {
    logger.error('Get payments error', err.message);
    res.status(500).json({ error: err.message });
  }
});

router.post('/', authenticate, async (req, res) => {
  try {
    const { session_id, customer_id, amount, method = 'cash', reference, notes } = req.body;
    if (!amount || amount <= 0) return res.status(400).json({ error: 'Valid amount required' });

    const result = await Payment.create({ session_id, customer_id, amount, method, reference, notes });

    // Update session payment status
    const session = await dbGet('SELECT * FROM sessions WHERE id = ?', [session_id]);
    if (session) {
      const totalPaidResult = await dbGet('SELECT COALESCE(SUM(amount), 0) as total FROM payments WHERE session_id = ?', [session_id]);
      const totalPaid = totalPaidResult.total;

      if (totalPaid >= session.amount_due) {
        await dbRun('UPDATE sessions SET payment_status = ? WHERE id = ?', ['paid', session_id]);
      } else {
        await dbRun('UPDATE sessions SET payment_status = ? WHERE id = ?', ['partial', session_id]);
      }
    }

    // Add to customer wallet if method is cash
    if (method === 'cash' && customer_id) {
      await dbRun('UPDATE customers SET total_spent = total_spent + ?, visits = visits + 1 WHERE id = ?', [amount, customer_id]);
    }

    await SystemLog.create({
      user_id: req.user.id,
      action: 'payment_recorded',
      target_table: 'payments',
      target_id: result.lastID,
      details: { session_id, amount, method }
    });

    logger.info('Payment recorded: ' + amount + ' PKR');
    res.status(201).json({ id: result.lastID, message: 'Payment recorded' });
  } catch (err) {
    logger.error('Create payment error', err.message);
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;