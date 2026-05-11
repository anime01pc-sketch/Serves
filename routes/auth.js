const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const db = require('../config/database');
const { dbRun, dbGet, generateToken, hashPassword, comparePassword } = require('../utils/helpers');
const logger = require('../utils/logger');

// Register
router.post('/register', async (req, res) => {
  try {
    const { username, password, full_name, phone, role } = req.body;

    if (!username || !password) {
      return res.status(400).json({ error: 'Username and password required' });
    }

    const existing = await dbGet('SELECT id FROM users WHERE username = ?', [username]);
    if (existing) {
      return res.status(400).json({ error: 'Username already exists' });
    }

    const password_hash = hashPassword(password);
    const result = await dbRun(
      'INSERT INTO users (username, password_hash, role, full_name, phone) VALUES (?, ?, ?, ?, ?)',
      [username, password_hash, role || 'staff', full_name || '', phone || '']
    );

    logger.info(`User registered: ${username} (role: ${role || 'staff'})`);
    res.status(201).json({ id: result.lastID, username, role: role || 'staff' });
  } catch (err) {
    logger.error('Register error', err.message);
    res.status(500).json({ error: err.message });
  }
});

// Login
router.post('/login', async (req, res) => {
  try {
    const { username, password } = req.body;

    if (!username || !password) {
      return res.status(400).json({ error: 'Username and password required' });
    }

    const user = await dbGet('SELECT * FROM users WHERE username = ?', [username]);
    if (!user) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    if (!comparePassword(password, user.password_hash)) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    const token = generateToken(user);
    logger.info(`User logged in: ${username}`);

    res.json({
      token,
      user: {
        id: user.id,
        username: user.username,
        role: user.role,
        full_name: user.full_name,
        phone: user.phone,
      }
    });
  } catch (err) {
    logger.error('Login error', err.message);
    res.status(500).json({ error: err.message });
  }
});

// Get current user profile
router.get('/me', async (req, res) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader?.startsWith('Bearer ')) {
      return res.status(401).json({ error: 'No token' });
    }
    const token = authHeader.split(' ')[1];
    const decoded = jwt.verify(token, process.env.JWT_SECRET || 'pleiades-cafe-secret-key-change-in-production');
    const user = await dbGet('SELECT id, username, role, full_name, phone FROM users WHERE id = ?', [decoded.id]);
    res.json({ user });
  } catch (err) {
    res.status(401).json({ error: 'Invalid token' });
  }
});

module.exports = router;