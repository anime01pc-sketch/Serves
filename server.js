require('dotenv').config();
const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');
const helmet = require('helmet');
const connectDB = require('./config/db');

const app = express();
const server = http.createServer(app);
const io = new Server(server, { cors: { origin: '*' } });

app.use(helmet({ contentSecurityPolicy: false, crossOriginEmbedderPolicy: false }));
app.use(cors());
app.use(express.json({ limit: '10kb' }));
app.use(express.urlencoded({ extended: true, limit: '10kb' }));

app.use('/api/auth', require('./routes/auth'));
app.use('/api/pcs', require('./routes/pcs'));
app.use('/api/sessions', require('./routes/sessions'));
app.use('/api/customers', require('./routes/customers'));
app.use('/api/rates', require('./routes/rates'));
app.use('/api/payments', require('./routes/payments'));
app.use('/api/reports', require('./routes/reports'));
app.use('/api/dashboard', require('./routes/dashboard'));

app.set('io', io);

// --------------------------------
// DEBUG / HOME PAGE
// --------------------------------
app.get('/', (req, res) => {
    const html = `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Pleiades Cafe Server - Status</title>
    <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body {
            font-family: 'Segoe UI', system-ui, sans-serif;
            background: #0f1117;
            color: #e4e7f0;
            min-height: 100vh;
            padding: 40px;
        }
        .container { max-width: 800px; margin: 0 auto; }
        .logo {
            text-align: center;
            margin-bottom: 40px;
        }
        .logo h1 {
            font-size: 48px;
            color: #3b82f6;
            letter-spacing: 4px;
        }
        .logo p { color: #8b8fa3; margin-top: 8px; }
        .status-box {
            background: #1a1d27;
            border-radius: 16px;
            padding: 30px;
            margin-bottom: 20px;
        }
        .status-box h2 {
            font-size: 20px;
            margin-bottom: 20px;
            display: flex;
            align-items: center;
            gap: 10px;
        }
        .badge {
            padding: 6px 12px;
            border-radius: 20px;
            font-size: 12px;
            font-weight: 600;
        }
        .badge.success { background: #22c55e22; color: #22c55e; }
        .badge.error { background: #ef444422; color: #ef4444; }
        .badge.warning { background: #f59e0b22; color: #f59e0b; }
        .info-grid {
            display: grid;
            grid-template-columns: repeat(2, 1fr);
            gap: 15px;
        }
        .info-item {
            background: #252836;
            padding: 15px;
            border-radius: 8px;
        }
        .info-item label { color: #8b8fa3; font-size: 12px; display: block; margin-bottom: 5px; }
        .info-item span { font-size: 14px; font-weight: 500; }
        .routes {
            display: grid;
            grid-template-columns: repeat(3, 1fr);
            gap: 10px;
        }
        .route {
            background: #252836;
            padding: 12px;
            border-radius: 8px;
            font-family: monospace;
            font-size: 12px;
            color: #8b8fa3;
        }
        .route span { color: #22c55e; }
        .footer {
            text-align: center;
            margin-top: 40px;
            color: #8b8fa3;
            font-size: 14px;
        }
    </style>
</head>
<body>
    <div class="container">
        <div class="logo">
            <h1>⬡ PLEIADES</h1>
            <p>Cafe Management System</p>
        </div>
        
        <div class="status-box">
            <h2>Server Status <span class="badge success">Running</span></h2>
            <div class="info-grid">
                <div class="info-item">
                    <label>Environment</label>
                    <span>${process.env.NODE_ENV || 'development'}</span>
                </div>
                <div class="info-item">
                    <label>Port</label>
                    <span>${process.env.PORT || '3001'}</span>
                </div>
                <div class="info-item">
                    <label>Uptime</label>
                    <span>${Math.floor(process.uptime() / 60)} minutes</span>
                </div>
                <div class="info-item">
                    <label>Node Version</label>
                    <span>${process.version}</span>
                </div>
            </div>
        </div>
        
        <div class="status-box">
            <h2>API Routes</h2>
            <div class="routes">
                <div class="route"><span>POST</span> /api/auth/register</div>
                <div class="route"><span>POST</span> /api/auth/login</div>
                <div class="route"><span>GET</span> /api/pcs</div>
                <div class="route"><span>GET</span> /api/sessions</div>
                <div class="route"><span>GET</span> /api/customers</div>
                <div class="route"><span>GET</span> /api/dashboard/stats</div>
                <div class="route"><span>GET</span> /api/health</div>
                <div class="route"><span>GET</span> /api/reports/daily</div>
                <div class="route"><span>GET</span> /api/reports/monthly</div>
            </div>
        </div>
        
        <div class="status-box">
            <h2>Test the API</h2>
            <p style="color: #8b8fa3; font-size: 14px;">
                Use these endpoints to test your server. Visit 
                <strong style="color: #3b82f6;">/api/health</strong> for JSON status.
            </p>
        </div>
        
        <div class="footer">
            <p>Pleiades Cafe Server v1.0.0 | Built with Express + MongoDB</p>
        </div>
    </div>
</body>
</html>
    `;
    res.send(html);
});

app.get('/api/health', (req, res) => {
    res.json({ 
        status: 'ok', 
        timestamp: new Date().toISOString(),
        uptime: Math.floor(process.uptime()),
        nodeVersion: process.version,
        environment: process.env.NODE_ENV || 'development'
    });
});

const { initSockets } = require('./sockets/sessionSocket');
const Admin = require('./models/Admin');
const { hashPassword } = require('./utils/helpers');

async function bootstrapSuperAdmin() {
    const adminUsername = process.env.ADMIN_USERNAME;
    const adminPassword = process.env.ADMIN_PASSWORD;

    if (!adminUsername || !adminPassword) {
        console.log('  ⚠️  No ADMIN_USERNAME/ADMIN_PASSWORD in environment');
        return;
    }

    const existingAdmin = await Admin.findOne({ username: adminUsername.toLowerCase() });
    if (existingAdmin) {
        console.log(`  ✅ Super admin "${adminUsername}" already exists`);
        return;
    }

    const superAdmin = await Admin.create({
        username: adminUsername.toLowerCase(),
        password: adminPassword,
        role: 'superadmin',
        isSuperAdmin: true
    });

    console.log(`  ✅ Super admin "${adminUsername}" created from environment`);
}

connectDB().then(async () => {
    await bootstrapSuperAdmin();
    const PORT = process.env.PORT || 3001;
    server.listen(PORT, '0.0.0.0', () => {
        console.log(`\n  🌟 Pleiades Cafe Server`);
        console.log(`  📍 http://localhost:${PORT}`);
        console.log(`  🔌 WebSocket: ws://localhost:${PORT}`);
        console.log(`  ✅ MongoDB Connected\n`);
    });
}).catch(err => {
    console.error('MongoDB connection failed:', err);
    process.exit(1);
});