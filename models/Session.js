const db = require('../config/database');
const { dbRun, dbGet, dbAll, now } = require('../utils/helpers');

const Session = {
  async getActive() {
    return dbAll(`
      SELECT s.*, p.pc_name, c.name as customer_name, c.phone as customer_phone
      FROM sessions s 
      JOIN pcs p ON s.pc_id = p.id 
      LEFT JOIN customers c ON s.customer_id = c.id 
      WHERE s.status = 'active'
      ORDER BY s.start_time DESC
    `);
  },

  async getById(id) {
    return dbGet(`
      SELECT s.*, p.pc_name, c.name as customer_name, c.wallet_balance
      FROM sessions s 
      JOIN pcs p ON s.pc_id = p.id 
      LEFT JOIN customers c ON s.customer_id = c.id 
      WHERE s.id = ?
    `, [id]);
  },

  async create({ pc_id, customer_id, duration_mins, amount_due }) {
    const result = await dbRun(
      `INSERT INTO sessions (pc_id, customer_id, duration_mins, remaining_mins, amount_due, status) 
       VALUES (?, ?, ?, ?, ?, 'active')`,
      [pc_id, customer_id, duration_mins, duration_mins, amount_due]
    );
    // Update PC status
    await dbRun('UPDATE pcs SET status = ? WHERE id = ?', ['in-use', pc_id]);
    return result;
  },

  async extend(id, extraMins, extraAmount) {
    await dbRun(
      `UPDATE sessions SET duration_mins = duration_mins + ?, remaining_mins = remaining_mins + ?, amount_due = amount_due + ? WHERE id = ?`,
      [extraMins, extraMins, extraAmount, id]
    );
    return dbGet('SELECT * FROM sessions WHERE id = ?', [id]);
  },

  async pause(id) {
    return dbRun("UPDATE sessions SET status = 'paused' WHERE id = ?", [id]);
  },

  async resume(id) {
    return dbRun("UPDATE sessions SET status = 'active' WHERE id = ?", [id]);
  },

  async stop(id) {
    const session = await dbGet('SELECT * FROM sessions WHERE id = ?', [id]);
    if (!session) return null;

    await dbRun(
      `UPDATE sessions SET status = 'completed', end_time = ?, remaining_mins = 0 WHERE id = ?`,
      [now(), id]
    );

    // Update PC status back to available
    await dbRun("UPDATE pcs SET status = ? WHERE id = ?", ['online', session.pc_id]);

    // Calculate final amount due if time-based
    const finalAmount = session.amount_due;
    return { session, finalAmount };
  },

  async decrementTimers() {
    // Decrement remaining_mins for all active sessions
    await dbRun(`
      UPDATE sessions SET remaining_mins = remaining_mins - 1 
      WHERE status = 'active' AND remaining_mins > 0
    `);

    // Get sessions that just expired
    return dbAll(`
      SELECT s.*, s.pc_id as _pcId FROM sessions s
      JOIN pcs p ON s.pc_id = p.id
      WHERE s.status = 'active' AND s.remaining_mins <= 0
    `);
  },

  async getByDateRange(startDate, endDate) {
    return dbAll(`
      SELECT s.*, p.pc_name, c.name as customer_name
      FROM sessions s 
      JOIN pcs p ON s.pc_id = p.id 
      LEFT JOIN customers c ON s.customer_id = c.id 
      WHERE s.start_time >= ? AND s.start_time <= ?
      ORDER BY s.start_time DESC
    `, [startDate, endDate]);
  },

  async updatePaymentStatus(sessionId, status) {
    return dbRun("UPDATE sessions SET payment_status = ? WHERE id = ?", [status, sessionId]);
  },
};

module.exports = Session;