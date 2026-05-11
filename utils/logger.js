const fs = require('fs');
const path = require('path');

const logFile = path.join(__dirname, '..', 'logs', 'app.log');

// Ensure logs directory exists
const logDir = path.dirname(logFile);
if (!fs.existsSync(logDir)) {
  fs.mkdirSync(logDir, { recursive: true });
}

function timestamp() {
  return new Date().toISOString();
}

function write(level, message, meta = '') {
  const line = `[${timestamp()}] [${level.toUpperCase()}] ${message} ${meta}\n`;
  fs.appendFileSync(logFile, line, 'utf8');
  console.log(line.trim());
}

module.exports = {
  info: (msg, meta = '') => write('info', msg, meta),
  warn: (msg, meta = '') => write('warn', msg, meta),
  error: (msg, meta = '') => write('error', msg, meta),
  debug: (msg, meta = '') => write('debug', msg, meta),
};