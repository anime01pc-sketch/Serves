const db = require('../config/database');
const { dbRun, dbGet, dbAll } = require('../utils/helpers');

const PC = {
  async getAll() {
    return dbAll('SELECT * FROM pcs ORDER BY pc_name');
  },

  async getById(id) {
    return dbGet('SELECT * FROM pcs WHERE id = ?', [id]);
  },

  async create({ pc_name, zone = 'General' }) {
    const result = await dbRun(
      'INSERT INTO pcs (pc_name, zone) VALUES (?, ?)',
      [pc_name, zone]
    );
    return result;
  },

  async update(id, data) {
    const fields = Object.keys(data).map(k => `${k} = ?`).join(', ');
    const values = [...Object.values(data), id];
    return dbRun(`UPDATE pcs SET ${fields} WHERE id = ?`, values);
  },

  async delete(id) {
    return dbRun('DELETE FROM pcs WHERE id = ?', [id]);
  },

  async updateStatus(id, status) {
    return dbRun('UPDATE pcs SET status = ? WHERE id = ?', [status, id]);
  },

  async getActiveSessions() {
    return dbAll(`SELECT s.*, p.pc_name, c.name as customer_name 
      FROM sessions s 
      JOIN pcs p ON s.pc_id = p.id 
      LEFT JOIN customers c ON s.customer_id = c.id 
      WHERE s.status = 'active'
      ORDER BY p.pc_name`);
  },
};

module.exports = PC;