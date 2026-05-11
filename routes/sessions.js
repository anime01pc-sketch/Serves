const express = require('express');
const router = express.Router();
const Session = require('../models/Session');
const SystemLog = require('../models/SystemLog');
const { authenticate, authorizeAdmin } = require('../middleware/auth');
const { dbGet, dbAll } = require('../utils/helpers');
const logger = require('../utils/logger');

// Get all sessions with filters
router.get('/', authenticate, async (req, res) => {
  try {
    const { status, date } = req.query;
    let query = `
      SELECT s.*, p.pc_name, c.name as customer_name, c.phone as customer_phone
      FROM sessions s 
      JOIN pcs p ON s.pc_id = p.id 
      LEFT JOIN customers c ON s.customer_id = c.id 
      WHERE 1=1
    `;
    const params = [];

    if (status) {
      query += ' AND s.status = ?';
      params.push(status);
    }
    if (date) {
      query += ' AND DATE(s.start_time) = ?';
      params.push(date);
    }
    query += ' ORDER BY s.start_time DESC';

    const sessions = await dbAll(query, params);
    res.json(sessions);
  } catch (err) {
    logger.error('Get sessions error', err.message);
    res.status(500).json({ error: err.message });
  }
});

// Get active sessions
router.get('/active', authenticate, async (req, res) => {
  try {
    const sessions = await Session.getActive();
    res.json(sessions);
  } catch (err) {
    logger.error('Get active sessions error', err.message);
    res.status(500).json({ error: err.message });
  }
});

// Start session
router.post('/start', authenticate, async (req, res) => {
  try {
    const { pc_id, customer_id, duration_mins } = req.body;

    if (!pc_id || !customer_id || !duration_mins) {
      return res.status(400).json({ error: 'pc_id, customer_id, and duration_mins required' });
    }

    // Check PC exists and is available
    const pc = await dbGet('SELECT * FROM pcs WHERE id = ?', [pc_id]);
    if (!pc) return res.status(404).json({ error: 'PC not found' });
    if (pc.status === 'in-use') return res.status(400).json({ error: 'PC already in use' });

    // Get rate for zone
    const rate = await dbGet('SELECT hourly_rate FROM rates WHERE zone_name = ? AND is_active = 1', [pc.zone]);
    if (!rate) return res.status(400).json({ error: 'No active rate for this zone' });

    const amount_due = Math.ceil(duration_mins / 60) * rate.hourly_rate;

    const result = await Session.create({ pc_id, customer_id, duration_mins, amount_due });

    // Log to system
    await SystemLog.create({
      user_id: req.user.id,
      action: 'session_started',
      target_table: 'sessions',
      target_id: result.lastID,
      details: { pc_id, customer_id, duration_mins, amount_due }
    });

    // Emit socket event
    const io = req.app.get('io');
    io.emit('session:started', { session_id: result.lastID, pc_id, pc_name: pc.pc_name, duration_mins, amount_due });
    io.emit('pc:status_changed', { pc_id, status: 'in-use' });

    logger.info(`Session started: PC=${pc_id} Customer=${customer_id} Duration=${duration_mins}m`);
    res.status(201).json({ id: result.lastID, pc_id, customer_id, duration_mins, amount_due, status: 'active' });
  } catch (err) {
    logger.error('Start session error', err.message);
    res.status(500).json({ error: err.message });
  }
});

// Extend session
router.post('/:id/extend', authenticate, async (req, res) => {
  try {
    const { id } = req.params;
    const { extra_mins } = req.body;

    if (!extra_mins || extra_mins <= 0) return res.status(400).json({ error: 'Invalid extra minutes' });

    const session = await dbGet('SELECT * FROM sessions WHERE id = ?', [id]);
    if (!session) return res.status(404).json({ error: 'Session not found' });

    const rate = await dbGet('SELECT hourly_rate FROM rates WHERE zone_name = (SELECT zone FROM pcs WHERE id = ?) AND is_active = 1', [session.pc_id]);
    const extraAmount = Math.ceil(extra_mins / 60) * (rate?.hourly_rate || 0);

    const updated = await Session.extend(id, extra_mins, extraAmount);

    const io = req.app.get('io');
    io.emit('session:extended', { session_id: id, extra_mins, extra_amount: extraAmount });

    logger.info(`Session extended: ${id} by ${extra_mins} mins (+${extraAmount} PKR)`);
    res.json({ message: 'Session extended', session: updated, extra_amount: extraAmount });
  } catch (err) {
    logger.error('Extend session error', err.message);
    res.status(500).json({ error: err.message });
  }
});

// Pause session
router.post('/:id/pause', authenticate, async (req, res) => {
  try {
    const { id } = req.params;
    await Session.pause(id);

    const io = req.app.get('io');
    io.emit('session:paused', { session_id: id });

    logger.info(`Session paused: ${id}`);
    res.json({ message: 'Session paused' });
  } catch (err) {
    logger.error('Pause session error', err.message);
    res.status(500).json({ error: err.message });
  }
});

// Resume session
router.post('/:id/resume', authenticate, async (req, res) => {
  try {
    const { id } = req.params;
    await Session.resume(id);

    const io = req.app.get('io');
    io.emit('session:resumed', { session_id: id });

    logger.info(`Session resumed: ${id}`);
    res.json({ message: 'Session resumed' });
  } catch (err) {
    logger.error('Resume session error', err.message);
    res.status(500).json({ error: err.message });
  }
});

// Stop session
router.post('/:id/stop', authenticate, async (req, res) => {
  try {
    const { id } = req.params;
    const result = await Session.stop(id);

    if (!result) return res.status(404).json({ error: 'Session not found' });

    const io = req.app.get('io');
    const pcId = result.session.pc_id;
    io.emit('session:ended', { session_id: id, pc_id: pcId, amount_due: result.finalAmount });
    io.emit('pc:status_changed', { pc_id: pcId, status: 'online' });

    logger.info(`Session stopped: ${id} Final: ${result.finalAmount} PKR`);
    res.json({ message: 'Session stopped', final_amount: result.finalAmount });
  } catch (err) {
    logger.error('Stop session error', err.message);
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;