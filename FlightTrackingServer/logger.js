const winston = require('winston');
const path = require('path');
const properties = require('./properties.json');

const logger = winston.createLogger({
  level: properties.logger,
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.printf(({ level, message, timestamp, label }) => {
      return `${timestamp} [PID: ${process.pid}] [${label}] ${level}: ${message}`;
    })
  ),
  transports: [
    new winston.transports.Console(),
  ],
});

const getLogger = (module) => {
  const filename = path.basename(module.filename); 
  return {
    log: (level, message) => logger.log({ level, message, label: filename }),
    debug: (message) => logger.log({ level: 'debug', message, label: filename }),
    info: (message) => logger.log({ level: 'info', message, label: filename }),
    error: (message) => logger.log({ level: 'error', message, label: filename }),
    warn: (message) => logger.log({ level: 'warn', message, label: filename }),
  };
}

module.exports = getLogger;