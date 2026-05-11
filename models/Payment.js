const db = require('../config/database');
const { dbRun, dbGet, dbAll, now } = require('../utils/helpers');

const Payment = {
  async create({ session_id, customer_id, amount, method = 'cash', reference, notes }) {
    const result = await dbRun(
      `INSERT INTO payments (session_id, customer_id, amount, method, reference, notes) 
       VALUES (?, ?, ?, ?, ?, ?)`,
      [session_id, customer_id, amount, method, reference || null, notes || null]
    );
    return result;
  },

  async getAll() {
    return dbAll(`
      SELECT p.*, s.pc_id, c.name as customer_name
      FROM payments p
      LEFT JOIN sessions s ON p.session_id = s.id
      LEFT JOIN customers c ON p.customer_id = c.id
      ORDER BY p.created_at DESC
    `);
  },

  async getBySession(sessionId) {
    return dbAll('SELECT * FROM payments WHERE session_id = ?', [sessionId]);
  },

  async getTotalByDate(date) {
    return dbGet(
      'SELECT COALESCE(SUM(amount), 0) as total FROM payments WHERE DATE(created_at) = ?',
      [date]
    );
  },

  async getTotalByRange(startDate, endDate) {
    return dbGet(
      'SELECT COALESCE(SUM(amount), 0) as total FROM payments WHERE created_at >= ? AND created_at <= ?',
      [startDate, endDate]
    );
  },

  async getByMethod(method) {
    return dbAll('SELECT * FROM payments WHERE method = ? ORDER BY created_at DESC', [method]);
  },
};

module.exports = Payment;