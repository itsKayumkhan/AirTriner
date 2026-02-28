// ============================================
// AirTrainr API - Winston Logger
// ============================================

import winston from 'winston';
import config from '../config';

const { combine, timestamp, printf, colorize, errors } = winston.format;

const logFormat = printf(({ level, message, timestamp, stack, ...meta }) => {
    let msg = `${timestamp} [${level}]: ${stack || message}`;
    if (Object.keys(meta).length > 0) {
        msg += ` ${JSON.stringify(meta)}`;
    }
    return msg;
});

export const logger = winston.createLogger({
    level: config.nodeEnv === 'production' ? 'info' : 'debug',
    format: combine(
        errors({ stack: true }),
        timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
        logFormat
    ),
    defaultMeta: { service: 'airtrainr-api' },
    transports: [
        new winston.transports.Console({
            format: combine(
                colorize(),
                logFormat
            ),
        }),
    ],
});

// Add file transport in production
if (config.nodeEnv === 'production') {
    logger.add(
        new winston.transports.File({
            filename: 'logs/error.log',
            level: 'error',
            maxsize: 5242880, // 5MB
            maxFiles: 5,
        })
    );
    logger.add(
        new winston.transports.File({
            filename: 'logs/combined.log',
            maxsize: 5242880,
            maxFiles: 5,
        })
    );
}

export default logger;
