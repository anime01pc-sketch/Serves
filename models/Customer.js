const db = require('../config/database');
const { dbRun, dbGet, dbAll } = require('../utils/helpers');

const Customer = {
  async getAll() {
    return dbAll('SELECT * FROM customers ORDER BY created_at DESC');
  },

  async getById(id) {
    return dbGet('SELECT * FROM customers WHERE id = ?', [id]);
  },

  async findByPhone(phone) {
    return dbGet('SELECT * FROM customers WHERE phone = ?', [phone]);
  },

  async search(query) {
    return dbAll(
      'SELECT * FROM customers WHERE name LIKE ? OR phone LIKE ? OR cnic LIKE ?',
      [`%${query}%`, `%${query}%`, `%${query}%`]
    );
  },

  async create({ name, phone, cnic }) {
    const result = await dbRun(
      'INSERT INTO customers (name, phone, cnic) VALUES (?, ?, ?)',
      [name, phone, cnic || null]
    );
    return result;
  },

  async update(id, data) {
    const fields = Object.keys(data).map(k => `${k} = ?`).join(', ');
    const values = [...Object.values(data), id];
    return dbRun(`UPDATE customers SET ${fields} WHERE id = ?`, values);
  },

  async addBalance(id, amount) {
    return dbRun('UPDATE customers SET wallet_balance = wallet_balance + ? WHERE id = ?', [amount, id]);
  },

  async deductBalance(id, amount) {
    return dbRun('UPDATE customers SET wallet_balance = wallet_balance - ? WHERE id = ?', [amount, id]);
  },

  async getHistory(id) {
    return dbAll(`
      SELECT s.*, p.pc_name, 
        (SELECT SUM(amount) FROM payments WHERE session_id = s.id) as total_paid
      FROM sessions s 
      JOIN pcs p ON s.pc_id = p.id 
      WHERE s.customer_id = ? 
      ORDER BY s.start_time DESC
    `, [id]);
  },

  async delete(id) {
    return dbRun('DELETE FROM customers WHERE id = ?', [id]);
  },
};

module.exports = Customer;