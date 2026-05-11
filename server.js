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
app.get('/api/health', (req, res) => res.json({ status: 'ok', mongodb: 'connected' }));

const { initSockets } = require('./sockets/sessionSocket');
initSockets(io);

connectDB().then(() => {
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