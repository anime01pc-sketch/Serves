const { verifyToken } = require('../utils/helpers');
const logger = require('../utils/logger');

function authenticate(req, res, next) {
  const token = req.headers.authorization?.split(' ')[1];

  if (!token) {
    return res.status(401).json({ error: 'Access denied. No token provided.' });
  }

  try {
    const decoded = verifyToken(token);
    if (!decoded) {
      return res.status(401).json({ error: 'Invalid or expired token.' });
    }
    req.user = decoded;
    next();
  } catch (err) {
    logger.error('Auth middleware error', err.message);
    return res.status(401).json({ error: 'Authentication failed.' });
  }
}

function authorizeAdmin(req, res, next) {
  if (req.user.role !== 'admin') {
    return res.status(403).json({ error: 'Admin access required.' });
  }
  next();
}

module.exports = { authenticate, authorizeAdmin };