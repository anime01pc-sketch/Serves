const db = require('../config/database');
const { dbRun, dbAll } = require('../utils/helpers');

const SystemLog = {
  async create({ user_id, action, target_table, target_id, details }) {
    return dbRun(
      `INSERT INTO system_logs (user_id, action, target_table, target_id, details) 
       VALUES (?, ?, ?, ?, ?)`,
      [user_id, action, target_table || null, target_id || null, JSON.stringify(details)]
    );
  },

  async getRecent(limit = 50) {
    return dbAll(`
      SELECT sl.*, u.username 
      FROM system_logs sl 
      LEFT JOIN users u ON sl.user_id = u.id 
      ORDER BY sl.created_at DESC 
      LIMIT ?
    `, [limit]);
  },

  async getByAction(action) {
    return dbAll('SELECT * FROM system_logs WHERE action = ? ORDER BY created_at DESC', [action]);
  },
};

module.exports = SystemLog;