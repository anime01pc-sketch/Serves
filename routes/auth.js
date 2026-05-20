const express = require('express');
const jwt = require('jsonwebtoken');
const { body, validationResult } = require('express-validator');
const xss = require('xss');
const Admin = require('../models/Admin');
const { authenticate } = require('../middleware/auth');
const router = express.Router();

// --------------------------------
// VALIDATION MIDDLEWARE
// --------------------------------
const validate = (req, res, next) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        return res.status(400).json({ error: errors.array()[0].msg });
    }
    next();
};

// --------------------------------
// INPUT SANITIZATION MIDDLEWARE
// --------------------------------
const sanitizeInput = (req, res, next) => {
    if (req.body.username) {
        req.body.username = xss(req.body.username.trim());
    }
    if (req.body.password) {
        req.body.password = xss(req.body.password);
    }
    next();
};

// --------------------------------
// VALIDATION RULES
// --------------------------------
const registerValidation = [
    body('username')
        .trim()
        .isLength({ min: 3, max: 30 })
        .withMessage('Username must be 3-30 characters')
        .matches(/^[a-zA-Z0-9_]+$/)
        .withMessage('Username can only contain letters, numbers, and underscores'),
    body('password')
        .isLength({ min: 6, max: 50 })
        .withMessage('Password must be 6-50 characters'),
    sanitizeInput,
    validate,
];

const loginValidation = [
    body('username')
        .trim()
        .notEmpty()
        .withMessage('Username is required')
        .isLength({ max: 30 })
        .withMessage('Username too long'),
    body('password')
        .notEmpty()
        .withMessage('Password is required'),
    sanitizeInput,
    validate,
];

// --------------------------------
// ROUTES
// --------------------------------

router.post('/login', loginValidation, async (req, res) => {
    try {
        const { username, password } = req.body;

        const admin = await Admin.findOne({ username });
        if (!admin) return res.status(401).json({ error: 'Invalid credentials' });

        const match = await admin.comparePassword(password);
        if (!match) return res.status(401).json({ error: 'Invalid credentials' });

        const token = jwt.sign(
            { id: admin._id, username: admin.username },
            process.env.JWT_SECRET,
            { expiresIn: '7d' }
        );
        
        res.json({ token, user: { id: admin._id, username: admin.username } });
    } catch (err) {
        console.error('Auth error:', err);
        res.status(500).json({ error: 'Server error' });
    }
});

router.post('/register', registerValidation, async (req, res) => {
    try {
        const { username, password } = req.body;

        const exists = await Admin.findOne({ username });
        if (exists) return res.status(409).json({ error: 'Username already taken' });

        const admin = await Admin.create({ username, password });
        res.json({ message: 'Admin created successfully', id: admin._id });
    } catch (err) {
        console.error('Register error:', err);
        res.status(500).json({ error: 'Server error' });
    }
});

router.get('/verify', authenticate, async (req, res) => {
    try {
        const admin = await Admin.findById(req.user.id).select('-password');
        if (!admin) return res.status(404).json({ error: 'Admin not found' });
        res.status(200).json({ valid: true, user: { id: admin._id, username: admin.username } });
    } catch (err) {
        console.error('Verify error:', err);
        res.status(500).json({ error: 'Server error' });
    }
});

module.exports = router;