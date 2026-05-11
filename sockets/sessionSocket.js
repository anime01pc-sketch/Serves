const Session = require('../models/Session');
const PC = require('../models/PC');

function initSockets(io) {
    io.on('connection', (socket) => {
        console.log('Client connected:', socket.id);

        socket.on('pc:register', (data) => {
            const { pc_id, pc_name } = data;
            socket.pc_id = pc_id;
            socket.pc_name = pc_name;
            socket.join('pcs');
            console.log('PC registered:', pc_name, pc_id);
            socket.emit('pc:status', { pc_id, status: 'registered' });
        });

        socket.on('pc:heartbeat', async (data) => {
            try {
                const { pc_id, status } = data;
                await PC.findByIdAndUpdate(pc_id, { status: status || 'available' });
                io.to('admins').emit('pc:status_changed', { pc_id, status });
            } catch (err) {
                console.error('Heartbeat error:', err.message);
            }
        });

        socket.on('session:tick', (data) => {
            const { session_id, remaining_mins } = data;
            io.to('admins').emit('session:tick', { session_id, remaining_mins });
        });

        socket.on('session:request_extend', (data) => {
            io.to('admins').emit('session:extension_request', data);
        });

        socket.on('session:expired', async (data) => {
            try {
                const { session_id, pc_id } = data;
                await Session.findByIdAndUpdate(session_id, { status: 'ended', endTime: new Date() });
                await PC.findByIdAndUpdate(pc_id, { status: 'available' });
                io.to('admins').emit('session:ended', { session_id, pc_id });
                io.to('pcs').emit('pc:status_changed', { pc_id, status: 'available' });
            } catch (err) {
                console.error('Session expired error:', err.message);
            }
        });

        socket.on('admin:join', () => {
            socket.join('admins');
            console.log('Admin joined');
        });

        socket.on('admin:force_stop', async (data) => {
            try {
                const { session_id, pc_id } = data;
                await Session.findByIdAndUpdate(session_id, { status: 'ended', endTime: new Date() });
                await PC.findByIdAndUpdate(pc_id, { status: 'available' });
                io.to('pcs').emit('session:force_stop', { session_id, pc_id });
                io.to('admins').emit('session:ended', { session_id, pc_id, forced: true });
                console.log('Admin force stopped session:', session_id);
            } catch (err) {
                console.error('Force stop error:', err.message);
            }
        });

        socket.on('admin:approve_extend', (data) => {
            const { session_id, extra_mins } = data;
            io.to('pcs').emit('session:extended', { session_id, extra_mins });
            io.to('admins').emit('session:extended', { session_id, extra_mins });
            console.log('Session extended:', session_id, '+' + extra_mins + ' mins');
        });

        socket.on('session:broadcast_started', (data) => {
            io.to('admins').emit('session:started', data);
        });

        socket.on('disconnect', () => {
            console.log('Client disconnected:', socket.id);
        });
    });

    console.log('WebSocket server initialized');
}

module.exports = { initSockets };