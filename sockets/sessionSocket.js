const Session = require('../models/Session');
const PC = require('../models/PC');
const { decrementTimers } = require('../models/Session');
const logger = require('../utils/logger');

function initSockets(io) {
  io.on('connection', (socket) => {
    logger.info('Client connected: ' + socket.id);

    // Client (PC) identifies itself
    socket.on('pc:register', (data) => {
      const { pc_id, pc_name } = data;
      socket.pc_id = pc_id;
      socket.pc_name = pc_name;
      socket.join('pcs');
      logger.info('PC registered on socket: ' + pc_name + ' (id: ' + pc_id + ')');

      // Send current active session for this PC
      socket.emit('pc:status', { pc_id, status: 'registered' });
    });

    // Client heartbeat (every 30s)
    socket.on('pc:heartbeat', async (data) => {
      try {
        const { pc_id, status } = data;

        // Update PC status in DB
        await PC.updateStatus(pc_id, status);

        // Broadcast status to admin dashboard
        io.to('admins').emit('pc:status_changed', { pc_id, status });
      } catch (err) {
        logger.error('Heartbeat error: ' + err.message);
      }
    });

    // Client reports session timer update
    socket.on('session:tick', async (data) => {
      const { session_id, remaining_mins } = data;

      // Broadcast to admin dashboard
      io.to('admins').emit('session:tick', { session_id, remaining_mins });
    });

    // PC requests session extension
    socket.on('session:request_extend', async (data) => {
      const { session_id, pc_id } = data;
      io.to('admins').emit('session:extension_request', { session_id, pc_id });
    });

    // PC session ended (time expired or forced)
    socket.on('session:expired', async (data) => {
      const { session_id, pc_id } = data;

      try {
        const result = await Session.stop(session_id);
        io.to('admins').emit('session:ended', { session_id, pc_id, amount_due: result?.finalAmount || 0 });
        io.to('pcs').emit('pc:status_changed', { pc_id, status: 'online' });
      } catch (err) {
        logger.error('Session expired error: ' + err.message);
      }
    });

    // Admin joins admin room
    socket.on('admin:join', () => {
      socket.join('admins');
      logger.info('Admin joined socket room');
    });

    // Admin force stops a session
    socket.on('admin:force_stop', async (data) => {
      const { session_id, pc_id } = data;
      try {
        await Session.stop(session_id);
        io.to('pcs').emit('session:force_stop', { session_id, pc_id });
        io.to('pcs').emit('pc:status_changed', { pc_id, status: 'online' });
        io.to('admins').emit('session:ended', { session_id, pc_id, forced: true });
        logger.info('Admin force stopped session: ' + session_id);
      } catch (err) {
        logger.error('Force stop error: ' + err.message);
      }
    });

    // Admin approves extension
    socket.on('admin:approve_extend', async (data) => {
      const { session_id, extra_mins } = data;
      try {
        const session = await Session.getById(session_id);
        if (session) {
          await Session.extend(session_id, extra_mins, 0); // Amount already paid via wallet
          io.to('pcs').emit('session:extended', { session_id, extra_mins });
          io.to('admins').emit('session:extended', { session_id, extra_mins });
          logger.info('Session extended by admin: ' + session_id + ' +' + extra_mins + ' mins');
        }
      } catch (err) {
        logger.error('Approve extend error: ' + err.message);
      }
    });

    // Broadcast session started to all admins
    socket.on('session:broadcast_started', (data) => {
      io.to('admins').emit('session:started', data);
    });

    socket.on('disconnect', () => {
      logger.info('Client disconnected: ' + socket.id);
    });
  });

  // Timer tick: decrement remaining minutes every 60 seconds
  setInterval(async () => {
    try {
      const expired = await decrementTimers();
      if (expired && expired.length > 0) {
        for (const session of expired) {
          io.to('pcs').emit('session:force_stop', { session_id: session.id, pc_id: session.pc_id });
          io.to('admins').emit('session:ended', { session_id: session.id, pc_id: session.pc_id });
        }
      }
    } catch (err) {
      logger.error('Timer tick error: ' + err.message);
    }
  }, 60000);

  logger.info('WebSocket server initialized');
}

module.exports = { initSockets };