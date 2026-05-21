const db = require('../db');

const MAX_FREE_TIME_MINUTES = 600;

class SessionManager {
  constructor(io) {
    this.io = io;
    this._interval = null;
    this._isRunning = false;
  }

  start() {
    if (this._isRunning) return;
    this._isRunning = true;

    console.log('[SessionManager] Starting session timer service...');

    // Check every 5 seconds
    this._interval = setInterval(() => this._tick(), 5000);

    // Run initial check immediately
    this._tick();
  }

  stop() {
    if (this._interval) {
      clearInterval(this._interval);
      this._interval = null;
    }
    this._isRunning = false;
    console.log('[SessionManager] Stopped');
  }

  async _tick() {
    try {
      const now = Math.floor(Date.now() / 1000);
      const pcs = await db.filter('pcs', p => p.session_end > 0 || p.stopwatch_start > 0);

      for (const pc of pcs) {
        // Check paid sessions
        if (pc.session_end > 0 && pc.session_end <= now) {
          await this._endPaidSession(pc);
        }

        // Check free stopwatch sessions
        if (pc.stopwatch_start > 0) {
          const elapsed = Math.floor((now - pc.stopwatch_start) / 60);
          if (elapsed >= MAX_FREE_TIME_MINUTES) {
            await this._endFreeSession(pc, elapsed);
          }
        }
      }
    } catch (e) {
      console.error('[SessionManager] Tick error:', e.message);
    }
  }

  async _endPaidSession(pc) {
    try {
      // Update history
      const history = await this._getHistory(pc.id);
      const activeSession = history.find(h => h.type === 'session' && h.mode === 'paid' && h.status === 'active');
      if (activeSession) {
        const remainingSeconds = pc.session_end > Math.floor(Date.now() / 1000) ? pc.session_end - Math.floor(Date.now() / 1000) : 0;
        const finalMins = Math.max(0, (activeSession.mins || 0) - Math.floor(remainingSeconds / 60));
        await this._updateHistoryEntry(pc.id, activeSession.id, { mins: finalMins, status: 'ended' });
      }

      // End session in DB
      await db.update('pcs', p => p.id === pc.id, { session_end: 0, stopwatch_start: 0 });
      await db.update('sessions', s => s.pc_id === pc.id && !s.ended_at, { ended_at: Math.floor(Date.now() / 1000) });

      // Emit WebSocket events
      this.io.to(`pc:${pc.id}`).emit('session:end', {});
      if (pc.group_id) {
        this.io.to(`group:${pc.group_id}`).emit(`group:${pc.group_id}:pc-session`, {
          pc_id: pc.id,
          session_end: 0,
          stopwatch_start: 0,
        });
      }

      console.log(`[SessionManager] Auto-ended paid session for PC ${pc.id}`);
    } catch (e) {
      console.error(`[SessionManager] Error ending paid session for PC ${pc.id}:`, e.message);
    }
  }

  async _endFreeSession(pc, elapsed) {
    try {
      // Update history
      const history = await this._getHistory(pc.id);
      const activeFreeSession = history.find(h => h.type === 'session' && h.mode === 'free' && h.status === 'active');
      if (activeFreeSession) {
        await this._updateHistoryEntry(pc.id, activeFreeSession.id, { mins: elapsed, status: 'ended', auto_ended: true });
      }

      // End session in DB
      await db.update('pcs', p => p.id === pc.id, { session_end: 0, stopwatch_start: 0 });

      // Emit WebSocket events
      this.io.to(`pc:${pc.id}`).emit('session:stopwatch-end', {});
      this.io.to(`pc:${pc.id}`).emit('command:lock', {});
      if (pc.group_id) {
        this.io.to(`group:${pc.group_id}`).emit(`group:${pc.group_id}:pc-session`, {
          pc_id: pc.id,
          session_end: 0,
          stopwatch_start: 0,
        });
      }

      console.log(`[SessionManager] Auto-ended free session for PC ${pc.id} (${elapsed}m)`);
    } catch (e) {
      console.error(`[SessionManager] Error ending free session for PC ${pc.id}:`, e.message);
    }
  }

  async _getHistory(pcId) {
    const pc = await db.get('pcs', p => p.id === pcId);
    return pc?.time_history || [];
  }

  async _updateHistoryEntry(pcId, entryId, updates) {
    const history = await this._getHistory(pcId);
    const idx = history.findIndex(h => h.id === entryId);
    if (idx >= 0) {
      history[idx] = { ...history[idx], ...updates };
      await db.update('pcs', p => p.id === pcId, { time_history: history });
    }
  }

  // Get current session status for a PC (for app reconnect)
  async getSessionStatus(pcId) {
    const pc = await db.get('pcs', p => p.id === pcId);
    if (!pc) return null;

    const now = Math.floor(Date.now() / 1000);
    let remainingSeconds = 0;
    let sessionType = null;

    if (pc.stopwatch_start > 0) {
      sessionType = 'free';
      remainingSeconds = now - pc.stopwatch_start; // Elapsed time for free timer
    } else if (pc.session_end > now) {
      sessionType = 'paid';
      remainingSeconds = pc.session_end - now;
    } else if (pc.session_end > 0 && pc.session_end <= now) {
      sessionType = 'expired';
      remainingSeconds = 0;
    }

    return {
      pc_id: pc.id,
      session_type: sessionType,
      remaining_seconds: remainingSeconds,
      session_end: pc.session_end,
      stopwatch_start: pc.stopwatch_start,
      is_online: pc.is_online === 1 || pc.is_online === true,
    };
  }
}

module.exports = { SessionManager };
