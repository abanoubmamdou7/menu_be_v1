// src/modules/utils/logger.js
import winston from 'winston';
import fs from 'fs';
import path from 'path';

const transports = [new winston.transports.Console()];

const logDir =
  process.env.LOG_DIRECTORY ||
  (process.env.VERCEL ? path.join('/tmp', 'logs') : path.join(process.cwd(), 'logs'));

try {
  fs.mkdirSync(logDir, { recursive: true });
  transports.push(
    new winston.transports.File({ filename: path.join(logDir, 'error.log'), level: 'error' }),
    new winston.transports.File({ filename: path.join(logDir, 'combined.log') })
  );
} catch (error) {
  console.warn(`Logger: unable to use file transports at "${logDir}". Falling back to console only.`, error);
}

const logger = winston.createLogger({
  level: 'info',
  format: winston.format.combine(winston.format.timestamp(), winston.format.json()),
  transports
});

export default logger;