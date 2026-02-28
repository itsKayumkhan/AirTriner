// ============================================
// AirTrainr API - Environment Configuration
// ============================================

import dotenv from 'dotenv';

dotenv.config();

export const config = {
    // Server
    port: parseInt(process.env.PORT || '4000', 10),
    nodeEnv: process.env.NODE_ENV || 'development',
    apiVersion: 'v1',

    // Database
    databaseUrl: process.env.DATABASE_URL || 'postgresql://postgres:postgres@localhost:5432/airtrainr',

    // Redis
    redisUrl: process.env.REDIS_URL || 'redis://localhost:6379',

    // JWT
    jwtAccessSecret: process.env.JWT_ACCESS_SECRET || 'airtrainr-access-secret-change-me',
    jwtRefreshSecret: process.env.JWT_REFRESH_SECRET || 'airtrainr-refresh-secret-change-me',
    jwtAccessExpiry: process.env.JWT_ACCESS_EXPIRY || '15m',
    jwtRefreshExpiry: process.env.JWT_REFRESH_EXPIRY || '7d',

    // Stripe
    stripeSecretKey: process.env.STRIPE_SECRET_KEY || '',
    stripeWebhookSecret: process.env.STRIPE_WEBHOOK_SECRET || '',

    // AWS S3
    awsRegion: process.env.AWS_REGION || 'us-east-1',
    awsAccessKeyId: process.env.AWS_ACCESS_KEY_ID || '',
    awsSecretAccessKey: process.env.AWS_SECRET_ACCESS_KEY || '',
    s3BucketName: process.env.S3_BUCKET_NAME || 'airtrainr-media',

    // CORS
    corsOrigins: (process.env.CORS_ORIGINS || 'http://localhost:3000').split(','),

    // Rate Limiting
    rateLimitWindowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS || '900000', 10), // 15 minutes
    rateLimitMax: parseInt(process.env.RATE_LIMIT_MAX || '100', 10),
    loginRateLimitMax: parseInt(process.env.LOGIN_RATE_LIMIT_MAX || '5', 10),

    // Geo
    defaultSearchRadiusMiles: parseInt(process.env.DEFAULT_SEARCH_RADIUS || '25', 10),
    maxSearchRadiusMiles: parseInt(process.env.MAX_SEARCH_RADIUS || '100', 10),
} as const;

export default config;
