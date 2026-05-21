const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const xss = require('xss-clean');
const hpp = require('hpp');
const morgan = require('morgan');
const path = require('path');
const db = require('./db');
const { PORT, CORS_ORIGINS, NODE_ENV } = require('./config/constants');
const { initCronScheduler } = require('./jobs/cronScheduler');

const authRoutes = require('./routes/auth.routes');
const adminRoutes = require('./routes/admin.routes');
const groupsRoutes = require('./routes/groups.routes');
const pcsRoutes = require('./routes/pcs.routes');
const setupSocketHandlers = require('./sockets/socketHandlers');
const { auditLogger } = require('./middleware/audit');

const { SessionManager } = require('./services/sessionManager');
const { authMiddleware, accountCheck } = require('./middleware/auth');

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: { origin: CORS_ORIGINS, methods: ['GET', 'POST'] },
});

app.set('io', io);

// ── Security Middleware ────────────────────────────────────────────────────────

app.use(helmet({
  crossOriginEmbedderPolicy: false,
  contentSecurityPolicy: false,
}));

app.use(cors({
  origin: CORS_ORIGINS,
  credentials: true,
  maxAge: 86400,
}));

app.use(express.json({ limit: '10kb' }));
app.use(express.urlencoded({ extended: true, limit: '10kb' }));

app.use(xss());
app.use(hpp());

if (NODE_ENV === 'production') {
  app.use(morgan('combined'));
} else {
  app.use(morgan('dev'));
}

app.use('/api', auditLogger);

// ── Rate Limiting ──────────────────────────────────────────────────────────────

const globalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many requests, please try again later.' },
});
app.use('/api', globalLimiter);

// ── Page Routes (Multi-Page) ──────────────────────────────────────────────────

app.get('/', (_req, res) => res.sendFile(path.join(__dirname, 'public', 'index.html')));
app.get('/app', (_req, res) => res.sendFile(path.join(__dirname, 'public', 'app.html')));
app.get('/app/:view', (_req, res) => res.sendFile(path.join(__dirname, 'public', 'app.html')));
app.get('/settings', (_req, res) => res.sendFile(path.join(__dirname, 'public', 'settings.html')));

// Admin portal fallback
app.get('/connect', (_req, res) => res.sendFile(path.join(__dirname, 'admin.html')));

// ── Static Files ───────────────────────────────────────────────────────────────

app.use(express.static(path.join(__dirname, 'public')));

// ── API Routes ─────────────────────────────────────────────────────────────────

app.use('/api/auth', authRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/groups', groupsRoutes);
app.use('/api', pcsRoutes);

// ── Health Check ───────────────────────────────────────────────────────────────

app.get('/api/health', async (req, res) => {
  try {
    await db._ready;
    res.json({ status: 'ok', database: 'connected', uptime: process.uptime() });
  } catch {
    res.json({ status: 'ok', database: 'disconnected', uptime: process.uptime() });
  }
});

// ── Session Status (for app reconnect) ──────────────────────────────────────────

app.get('/api/pcs/:pcId/session/status', authMiddleware, accountCheck, async (req, res) => {
  try {
    const { pcId } = req.params;
    const pc = await db.get('pcs', p => p.id === pcId);
    if (!pc) return res.status(404).json({ error: 'PC not found' });
    const { canManageGroup } = require('./middleware/permissions');
    if (!await canManageGroup(req.user.id, pc.group_id)) return res.status(403).json({ error: 'Forbidden' });

    const now = Math.floor(Date.now() / 1000);
    let sessionType = null;
    let remainingSeconds = 0;

    if (pc.stopwatch_start > 0) {
      sessionType = 'free';
      remainingSeconds = now - pc.stopwatch_start;
    } else if (pc.session_end > now) {
      sessionType = 'paid';
      remainingSeconds = pc.session_end - now;
    }

    res.json({
      pc_id: pc.id,
      session_type: sessionType,
      remaining_seconds: remainingSeconds,
      session_end: pc.session_end,
      stopwatch_start: pc.stopwatch_start,
      is_online: pc.is_online === 1 || pc.is_online === true,
    });
  } catch(e) {
    res.status(500).json({ error: e.message });
  }
});

// ── 404 Handler ────────────────────────────────────────────────────────────────

app.use((req, res) => {
  res.status(404).json({ error: 'Not found' });
});

// ── Global Error Handler ───────────────────────────────────────────────────────

app.use((err, req, res, _next) => {
  console.error('[UNHANDLED ERROR]', err);
  res.status(err.status || 500).json({
    error: NODE_ENV === 'production' ? 'Internal server error' : err.message,
  });
});

// ── Socket.IO ──────────────────────────────────────────────────────────────────

setupSocketHandlers(io);

// In-memory rate cache for instant reads (no DB queries after load)
global._rateCache = {};

const loadRateCache = async () => {
  const groups = await db.all('groups');
  for (const group of groups) {
    if (group.hourly_rate) {
      global._rateCache[group.id] = group.hourly_rate;
    }
  }
  console.log(`[+] Loaded ${Object.keys(global._rateCache).length} group rates into cache`);
};

const getCachedRate = (groupId) => {
  return global._rateCache[groupId] || 5;
};

const setCachedRate = (groupId, rate) => {
  global._rateCache[groupId] = rate;
};

// ── Start Server ─────────────────────────────────────────────────────────────────

db._ready.then(async () => {
  const existingGroups = await db.filter('groups', g => !g.hourly_rate);
  for (const group of existingGroups) {
    await db.update('groups', g => g.id === group.id, { hourly_rate: 5 });
  }
  if (existingGroups.length > 0) {
    console.log(`Migrated ${existingGroups.length} groups with default hourly rate`);
  }
  const flushTimeGroups = await db.filter('groups', g => !g.flush_time);
  for (const group of flushTimeGroups) {
    await db.update('groups', g => g.id === group.id, { flush_time: '03:30' });
  }
  if (flushTimeGroups.length > 0) {
    console.log(`Migrated ${flushTimeGroups.length} groups with default flush time`);
  }
  const suffixGroups = await db.filter('groups', g => !g.group_suffix);
  for (const group of suffixGroups) {
    const suffix = Math.random().toString(36).substr(2, 5);
    await db.update('groups', g => g.id === group.id, { group_suffix: suffix });
  }
  if (suffixGroups.length > 0) {
    console.log(`Migrated ${suffixGroups.length} groups with unique URL suffixes`);
  }
  await loadRateCache();
  global.getCachedRate = getCachedRate;
  global.setCachedRate = setCachedRate;

  // Start Session Manager
  const sessionManager = new SessionManager(io);
  sessionManager.start();
  global.sessionManager = sessionManager;

  server.listen(PORT, () => {
    console.log(`\nGameZone Server running on port ${PORT}`);
    console.log(`   Mode: ${process.env.MONGODB_URI ? 'MongoDB (cloud)' : 'Local JSON file'}`);
    console.log(`   Environment: ${NODE_ENV}`);
    console.log(`   Pages: / /groups /dashboard /pc-control /settings`);
    console.log(`   Admin panel: /connect\n`);
    initCronScheduler();
    if (global._startStopwatchCheck) global._startStopwatchCheck();
  });
}).catch(err => {
  console.error('Failed to connect to database:', err);
  process.exit(1);
});
