// ============================================
// AirTrainr API - Main Application Entry Point
// ============================================

import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import compression from 'compression';
import cookieParser from 'cookie-parser';
import rateLimit from 'express-rate-limit';
import config from './config';
import { logger } from './common/logger';
import { errorHandler, requestLogger } from './common/middleware';

// Route imports
import authRoutes from './modules/auth/auth.routes';
import userRoutes from './modules/users/user.routes';
import bookingRoutes from './modules/bookings/booking.routes';
import matchingRoutes from './modules/matching/matching.routes';
import paymentRoutes from './modules/payments/payment.routes';

const app = express();

// ---- Security Middleware ----
app.use(helmet());
app.use(
    cors({
        origin: config.corsOrigins,
        credentials: true,
        methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
        allowedHeaders: ['Content-Type', 'Authorization'],
    })
);

// ---- Body Parsing ----
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());
app.use(compression());

// ---- Logging ----
app.use(requestLogger);

// ---- Rate Limiting ----
const generalLimiter = rateLimit({
    windowMs: config.rateLimitWindowMs,
    max: config.rateLimitMax,
    standardHeaders: true,
    legacyHeaders: false,
    message: {
        success: false,
        error: {
            code: 'TOO_MANY_REQUESTS',
            message: 'Too many requests, please try again later',
        },
    },
});
app.use(generalLimiter);

// Stricter rate limit for auth endpoints
const authLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: config.loginRateLimitMax,
    standardHeaders: true,
    legacyHeaders: false,
    message: {
        success: false,
        error: {
            code: 'TOO_MANY_REQUESTS',
            message: 'Too many login attempts, please try again later',
        },
    },
});

// ---- Health Check ----
app.get('/health', (_req, res) => {
    res.json({
        status: 'healthy',
        service: 'airtrainr-api',
        version: '0.1.0',
        timestamp: new Date().toISOString(),
        environment: config.nodeEnv,
    });
});

// ---- API Routes ----
const apiPrefix = `/api/${config.apiVersion}`;

app.use(`${apiPrefix}/auth`, authLimiter, authRoutes);
app.use(`${apiPrefix}/users`, userRoutes);
app.use(`${apiPrefix}/bookings`, bookingRoutes);
app.use(`${apiPrefix}/discover`, matchingRoutes);
app.use(`${apiPrefix}/payments`, paymentRoutes);

// ---- 404 Handler ----
app.use((_req, res) => {
    res.status(404).json({
        success: false,
        error: {
            code: 'NOT_FOUND',
            message: 'The requested endpoint does not exist',
        },
    });
});

// ---- Global Error Handler ----
app.use(errorHandler);

// ---- Start Server ----
const PORT = config.port;

app.listen(PORT, () => {
    logger.info(`
╔═══════════════════════════════════════════════════════╗
║                                                       ║
║       🏋️  AirTrainr API Server                       ║
║       Running on port ${PORT}                          ║
║       Environment: ${config.nodeEnv}                   ║
║       API Version: ${config.apiVersion}                ║
║                                                       ║
╚═══════════════════════════════════════════════════════╝
  `);
});

export default app;
