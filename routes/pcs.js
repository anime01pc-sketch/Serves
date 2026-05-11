const express = require('express');
const router = express.Router();
const PC = require('../models/PC');
const SystemLog = require('../models/SystemLog');
const { authenticate, authorizeAdmin } = require('../middleware/auth');
const logger = require('../utils/logger');

// Get all PCs
router.get('/', authenticate, async (req, res) => {
  try {
    const pcs = await PC.getAll();
    res.json(pcs);
  } catch (err) {
    logger.error('Get PCs error', err.message);
    res.status(500).json({ error: err.message });
  }
});

// Add PC
router.post('/', authenticate, authorizeAdmin, async (req, res) => {
  try {
    const { pc_name, zone } = req.body;
    if (!pc_name) return res.status(400).json({ error: 'PC name required' });

    const result = await PC.create({ pc_name, zone: zone || 'General' });
    await SystemLog.create({
      user_id: req.user.id,
      action: 'pc_created',
      target_table: 'pcs',
      target_id: result.lastID,
      details: { pc_name, zone }
    });
    logger.info(`PC created: ${pc_name}`);
    res.status(201).json({ id: result.lastID, pc_name, zone });
  } catch (err) {
    logger.error('Create PC error', err.message);
    res.status(500).json({ error: err.message });
  }
});

// Update PC
router.put('/:id', authenticate, authorizeAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    const result = await PC.update(id, req.body);
    await SystemLog.create({
      user_id: req.user.id,
      action: 'pc_updated',
      target_table: 'pcs',
      target_id: id,
      details: req.body
    });
    res.json({ message: 'PC updated', changes: result.changes });
  } catch (err) {
    logger.error('Update PC error', err.message);
    res.status(500).json({ error: err.message });
  }
});

// Delete PC
router.delete('/:id', authenticate, authorizeAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    await PC.delete(id);
    await SystemLog.create({
      user_id: req.user.id,
      action: 'pc_deleted',
      target_table: 'pcs',
      target_id: id,
      details: {}
    });
    res.json({ message: 'PC deleted' });
  } catch (err) {
    logger.error('Delete PC error', err.message);
    res.status(500).json({ error: err.message });
  }
});

// Update PC status (from client heartbeat)
router.post('/:id/status', authenticate, async (req, res) => {
  try {
    const { id } = req.params;
    const { status } = req.body;
    await PC.updateStatus(id, status);
    res.json({ message: 'Status updated' });
  } catch (err) {
    logger.error('Update PC status error', err.message);
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;