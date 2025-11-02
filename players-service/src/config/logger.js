
const fs = require('fs');
const path = require('path');
const { createLogger, format, transports } = require('winston');

const env = process.env.NODE_ENV || 'development';
const logDirectory = path.join(__dirname, '../../logs');


if (!fs.existsSync(logDirectory)) {
  fs.mkdirSync(logDirectory, { recursive: true });
}

const jsonFormat = format.combine(
  format.timestamp(),
  format.errors({ stack: true }),
  format.splat(),
  format.json()
);


const consoleFormat = format.combine(
  format.colorize(),
  format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
  format.printf(({ level, message, timestamp, ...metadata }) => {
    let meta = '';
    if (metadata && Object.keys(metadata).length) {

      if (metadata.stack) {
        meta = `\n${metadata.stack}`;
      } else {
        meta = ` ${JSON.stringify(metadata)}`;
      }
    }
    return `[${timestamp}] ${level}: ${message}${meta}`;
  })
);

const logger = createLogger({
  level: env === 'production' ? 'info' : 'debug',
  format: consoleFormat, 
  transports: [
    new transports.File({
      filename: path.join(logDirectory, 'error.log'),
      level: 'error',
      format: jsonFormat,
    }),
    new transports.File({
      filename: path.join(logDirectory, 'combined.log'),
      format: jsonFormat,
    }),
  ],
  exceptionHandlers: [
    new transports.File({ filename: path.join(logDirectory, 'exceptions.log'), format: jsonFormat }),
  ],
  rejectionHandlers: [
    new transports.File({ filename: path.join(logDirectory, 'rejections.log'), format: jsonFormat }),
  ],
});

if (env !== 'production') {
  logger.add(
    new transports.Console({
      format: consoleFormat,
    })
  );
}

module.exports = logger;