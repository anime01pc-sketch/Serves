require('dotenv').config();
const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');
const helmet = require('helmet');
const path = require('path');
const xss = require('xss');
const { globalLimiter, authLimiter } = require('./middleware/rateLimiter');
const authRoutes = require('./routes/auth');
const pcRoutes = require('./routes/pcs');
const sessionRoutes = require('./routes/sessions');
const customerRoutes = require('./routes/customers');
const rateRoutes = require('./routes/rates');
const paymentRoutes = require('./routes/payments');
const reportRoutes = require('./routes/reports');
const dashboardRoutes = require('./routes/dashboard');
const { initSockets } = require('./sockets/sessionSocket');

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: { origin: '*' }
});

// ========== SECURITY MIDDLEWARE ==========
app.use(helmet({
  contentSecurityPolicy: false, // Allow WebSocket connections
  crossOriginEmbedderPolicy: false,
}));
app.use(cors());
app.use(express.json({ limit: '10kb' }));
app.use(express.urlencoded({ extended: true, limit: '10kb' }));
app.use(express.static(path.join(__dirname, 'uploads')));

// Rate limiting
app.use('/api/auth', authLimiter);
app.use(globalLimiter);

// XSS sanitization middleware
app.use((req, res, next) => {
  if (req.body) {
    for (const key of Object.keys(req.body)) {
      if (typeof req.body[key] === 'string') {
        req.body[key] = xss(req.body[key], {
          whiteList: {},
          stripIgnoreTag: true,
          stripIgnoreTagBody: ['script', 'style'],
        });
      }
    }
  }
  if (req.query) {
    for (const key of Object.keys(req.query)) {
      if (typeof req.query[key] === 'string') {
        req.query[key] = xss(req.query[key]);
      }
    }
  }
  next();
});

// Field whitelist middleware — strip unknown fields from req.body
app.use((req, res, next) => {
  if (req.body && typeof req.body === 'object') {
    const allowedFields = {
      '/api/auth/register': ['username', 'password', 'role', 'full_name', 'phone'],
      '/api/auth/login': ['username', 'password'],
      '/api/pcs': ['pc_name', 'zone'],
      '/api/pcs/update': ['pc_name', 'zone', 'is_active', 'status'],
      '/api/sessions/start': ['pc_id', 'customer_id', 'duration_mins'],
      '/api/sessions/extend': ['extra_mins'],
      '/api/customers': ['name', 'phone', 'cnic'],
      '/api/customers/topup': ['amount', 'method', 'reference', 'notes'],
      '/api/rates': ['zone_name', 'hourly_rate', 'currency'],
      '/api/payments': ['session_id', 'customer_id', 'amount', 'method', 'reference', 'notes'],
    };

    const path = req.baseUrl + req.path;
    const allowed = allowedFields[path];
    if (allowed) {
      Object.keys(req.body).forEach(key => {
        if (!allowed.includes(key)) {
          delete req.body[key];
        }
      });
    }
  }
  next();
});

// Attach io to app for route access
app.set('io', io);

// API Routes
app.use('/api/auth', authRoutes);
app.use('/api/pcs', pcRoutes);
app.use('/api/sessions', sessionRoutes);
app.use('/api/customers', customerRoutes);
app.use('/api/rates', rateRoutes);
app.use('/api/payments', paymentRoutes);
app.use('/api/reports', reportRoutes);
app.use('/api/dashboard', dashboardRoutes);

// Health check
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Init WebSocket
initSockets(io);

// Start
const PORT = process.env.PORT || 3001;
server.listen(PORT, '0.0.0.0', () => {
  console.log(`\n`);
  console.log(`  ==========================================`);
  console.log(`  🌟 Pleiades Cafe Server Running!`);
  console.log(`  📍 http://localhost:${PORT}`);
  console.log(`  🔌 WebSocket: ws://localhost:${PORT}`);
  console.log(`  ==========================================\n`);
});