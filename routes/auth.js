const express = require('express');
const jwt = require('jsonwebtoken');
const Admin = require('../models/Admin');
const router = express.Router();

router.post('/login', async (req, res) => {
    try {
        const { username, password } = req.body;
        if (!username || !password) return res.status(400).json({ error: 'Missing credentials' });

        const admin = await Admin.findOne({ username });
        if (!admin) return res.status(401).json({ error: 'Invalid credentials' });

        const match = await admin.comparePassword(password);
        if (!match) return res.status(401).json({ error: 'Invalid credentials' });

        const token = jwt.sign({ id: admin._id, username: admin.username }, process.env.JWT_SECRET, { expiresIn: '7d' });
        res.json({ token });
    } catch (err) {
        console.error('Auth error:', err);
        res.status(500).json({ error: 'Server error' });
    }
});

router.post('/register', async (req, res) => {
    try {
        const { username, password } = req.body;
        if (!username || !password) return res.status(400).json({ error: 'Missing fields' });
        if (password.length < 6) return res.status(400).json({ error: 'Password too short' });

        const exists = await Admin.findOne({ username });
        if (exists) return res.status(409).json({ error: 'Username taken' });

        const admin = await Admin.create({ username, password });
        res.json({ message: 'Admin created', id: admin._id });
    } catch (err) {
        console.error('Register error:', err);
        res.status(500).json({ error: 'Server error' });
    }
});

module.exports = router;