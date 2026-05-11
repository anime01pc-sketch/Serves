const db = require('../config/database');
const { dbRun, dbGet, dbAll, now } = require('../utils/helpers');

const User = {
  async create({ username, password_hash, role = 'staff', full_name, phone }) {
    const result = await dbRun(
      'INSERT INTO users (username, password_hash, role, full_name, phone) VALUES (?, ?, ?, ?, ?)',
      [username, password_hash, role, full_name, phone]
    );
    return result;
  },

  async findByUsername(username) {
    return dbGet('SELECT * FROM users WHERE username = ?', [username]);
  },

  async findById(id) {
    return dbGet('SELECT id, username, role, full_name, phone, is_active, created_at FROM users WHERE id = ?', [id]);
  },

  async getAll() {
    return dbAll('SELECT id, username, role, full_name, phone, is_active, created_at FROM users');
  },

  async update(id, data) {
    const fields = Object.keys(data).map(k => `${k} = ?`).join(', ');
    const values = [...Object.values(data), id];
    return dbRun(`UPDATE users SET ${fields} WHERE id = ?`, values);
  },
};

module.exports = User;