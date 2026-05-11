const express = require('express');
const router = express.Router();
const Customer = require('../models/Customer');
const SystemLog = require('../models/SystemLog');
const { authenticate } = require('../middleware/auth');
const { dbGet } = require('../utils/helpers');
const logger = require('../utils/logger');

// Get all customers
router.get('/', authenticate, async (req, res) => {
  try {
    const { search } = req.query;
    let customers;
    if (search) {
      customers = await Customer.search(search);
    } else {
      customers = await Customer.getAll();
    }
    res.json(customers);
  } catch (err) {
    logger.error('Get customers error', err.message);
    res.status(500).json({ error: err.message });
  }
});

// Add customer
router.post('/', authenticate, async (req, res) => {
  try {
    const { name, phone, cnic } = req.body;
    if (!name) return res.status(400).json({ error: 'Name required' });

    const result = await Customer.create({ name, phone, cnic });
    await SystemLog.create({
      user_id: req.user.id,
      action: 'customer_created',
      target_table: 'customers',
      target_id: result.lastID,
      details: { name, phone }
    });
    logger.info(`Customer created: ${name}`);
    res.status(201).json({ id: result.lastID, name, phone, wallet_balance: 0 });
  } catch (err) {
    logger.error('Create customer error', err.message);
    res.status(500).json({ error: err.message });
  }
});

// Get customer by ID
router.get('/:id', authenticate, async (req, res) => {
  try {
    const customer = await Customer.getById(req.params.id);
    if (!customer) return res.status(404).json({ error: 'Customer not found' });
    res.json(customer);
  } catch (err) {
    logger.error('Get customer error', err.message);
    res.status(500).json({ error: err.message });
  }
});

// Get customer session history
router.get('/:id/history', authenticate, async (req, res) => {
  try {
    const history = await Customer.getHistory(req.params.id);
    res.json(history);
  } catch (err) {
    logger.error('Get customer history error', err.message);
    res.status(500).json({ error: err.message });
  }
});

// Top up wallet
router.post('/:id/topup', authenticate, async (req, res) => {
  try {
    const { id } = req.params;
    const { amount, method = 'cash', reference, notes } = req.body;

    if (!amount || amount <= 0) return res.status(400).json({ error: 'Invalid amount' });

    await Customer.addBalance(id, amount);

    const result = await dbGet('SELECT wallet_balance FROM customers WHERE id = ?', [id]);
    const wallet_balance = result ? result.wallet_balance : 0;

    await SystemLog.create({
      user_id: req.user.id,
      action: 'wallet_topup',
      target_table: 'customers',
      target_id: id,
      details: { amount, method, reference, wallet_balance }
    });

    logger.info(`Wallet topped up: Customer ${id} +${amount} PKR`);
    res.json({ message: 'Balance added', wallet_balance });
  } catch (err) {
    logger.error('Top up error', err.message);
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;