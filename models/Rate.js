const db = require('../config/database');
const { dbRun, dbGet, dbAll } = require('../utils/helpers');

const Rate = {
  async getAll() {
    return dbAll('SELECT * FROM rates ORDER BY zone_name');
  },

  async getById(id) {
    return dbGet('SELECT * FROM rates WHERE id = ?', [id]);
  },

  async getActive() {
    return dbAll('SELECT * FROM rates WHERE is_active = 1 ORDER BY zone_name');
  },

  async getByZone(zone) {
    return dbGet('SELECT * FROM rates WHERE zone_name = ? AND is_active = 1', [zone]);
  },

  async create({ zone_name, hourly_rate, currency = 'PKR' }) {
    return dbRun(
      'INSERT INTO rates (zone_name, hourly_rate, currency) VALUES (?, ?, ?)',
      [zone_name, hourly_rate, currency]
    );
  },

  async update(id, data) {
    const fields = Object.keys(data).map(k => `${k} = ?`).join(', ');
    const values = [...Object.values(data), id];
    return dbRun(`UPDATE rates SET ${fields} WHERE id = ?`, values);
  },

  async delete(id) {
    return dbRun('DELETE FROM rates WHERE id = ?', [id]);
  },

  async calculateAmount(durationMins, zoneName) {
    const rate = await this.getByZone(zoneName);
    if (!rate) return 0;
    return Math.ceil(durationMins / 60) * rate.hourly_rate;
  },
};

module.exports = Rate;