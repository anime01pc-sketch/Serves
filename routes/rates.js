const express = require('express');
const router = express.Router();
const Rate = require('../models/Rate');
const SystemLog = require('../models/SystemLog');
const { authenticate, authorizeAdmin } = require('../middleware/auth');
const logger = require('../utils/logger');

router.get('/', authenticate, async (req, res) => {
  try {
    const rates = await Rate.getAll();
    res.json(rates);
  } catch (err) {
    logger.error('Get rates error', err.message);
    res.status(500).json({ error: err.message });
  }
});

router.post('/', authenticate, authorizeAdmin, async (req, res) => {
  try {
    const { zone_name, hourly_rate } = req.body;
    if (!zone_name || !hourly_rate) return res.status(400).json({ error: 'zone_name and hourly_rate required' });
    const result = await Rate.create({ zone_name, hourly_rate });
    await SystemLog.create({ user_id: req.user.id, action: 'rate_created', target_table: 'rates', target_id: result.lastID, details: { zone_name, hourly_rate } });
    logger.info('Rate created: ' + zone_name);
    res.status(201).json({ id: result.lastID, zone_name, hourly_rate });
  } catch (err) {
    logger.error('Create rate error', err.message);
    res.status(500).json({ error: err.message });
  }
});

router.put('/:id', authenticate, authorizeAdmin, async (req, res) => {
  try {
    const result = await Rate.update(req.params.id, req.body);
    res.json({ message: 'Rate updated', changes: result.changes });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.delete('/:id', authenticate, authorizeAdmin, async (req, res) => {
  try {
    await Rate.delete(req.params.id);
    res.json({ message: 'Rate deleted' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;