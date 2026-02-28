// ============================================
// AirTrainr API - Express Middleware
// ============================================

import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { AppError, UnauthorizedError, ForbiddenError } from './errors';
import { logger } from './logger';
import config from '../config';
import { UserRole, JWTPayload, ApiResponse } from '@airtrainr/shared';

/**
 * Global error handler middleware
 */
export function errorHandler(err: Error, _req: Request, res: Response, _next: NextFunction) {
    if (err instanceof AppError) {
        const response: ApiResponse<null> = {
            success: false,
            error: {
                code: err.code,
                message: err.message,
                details: err.details,
            },
        };
        return res.status(err.statusCode).json(response);
    }

    // Unexpected error
    logger.error('Unhandled error:', err);
    const response: ApiResponse<null> = {
        success: false,
        error: {
            code: 'INTERNAL_ERROR',
            message: config.nodeEnv === 'production' ? 'Internal server error' : err.message,
        },
    };
    return res.status(500).json(response);
}

/**
 * Authentication middleware - verifies JWT access token
 */
export function authenticate(req: Request, _res: Response, next: NextFunction) {
    try {
        const authHeader = req.headers.authorization;
        const token = authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : req.cookies?.accessToken;

        if (!token) {
            throw new UnauthorizedError('Access token required');
        }

        const payload = jwt.verify(token, config.jwtAccessSecret) as JWTPayload;
        (req as any).user = payload;
        next();
    } catch (error: any) {
        if (error instanceof UnauthorizedError) {
            next(error);
        } else if (error.name === 'TokenExpiredError') {
            next(new UnauthorizedError('Access token expired'));
        } else if (error.name === 'JsonWebTokenError') {
            next(new UnauthorizedError('Invalid access token'));
        } else {
            next(error);
        }
    }
}

/**
 * Role-based authorization middleware
 */
export function authorize(...roles: UserRole[]) {
    return (req: Request, _res: Response, next: NextFunction) => {
        const user = (req as any).user as JWTPayload;

        if (!user) {
            return next(new UnauthorizedError());
        }

        if (roles.length > 0 && !roles.includes(user.role)) {
            return next(new ForbiddenError('Insufficient permissions'));
        }

        next();
    };
}

/**
 * Request logging middleware using Morgan-style format
 */
export function requestLogger(req: Request, res: Response, next: NextFunction) {
    const start = Date.now();

    res.on('finish', () => {
        const duration = Date.now() - start;
        const logData = {
            method: req.method,
            url: req.originalUrl,
            status: res.statusCode,
            duration: `${duration}ms`,
            ip: req.ip,
            userAgent: req.get('user-agent'),
        };

        if (res.statusCode >= 400) {
            logger.warn('Request failed', logData);
        } else {
            logger.info('Request completed', logData);
        }
    });

    next();
}

/**
 * Async wrapper for route handlers
 */
export function asyncHandler(fn: (req: Request, res: Response, next: NextFunction) => Promise<any>) {
    return (req: Request, res: Response, next: NextFunction) => {
        Promise.resolve(fn(req, res, next)).catch(next);
    };
}

/**
 * Validate request body using Zod schema
 */
export function validateBody(schema: any) {
    return (req: Request, _res: Response, next: NextFunction) => {
        try {
            const result = schema.safeParse(req.body);
            if (!result.success) {
                const errors: Record<string, string[]> = {};
                result.error.issues.forEach((issue: any) => {
                    const path = issue.path.join('.');
                    if (!errors[path]) {
                        errors[path] = [];
                    }
                    errors[path].push(issue.message);
                });
                return next(new AppError('Validation failed', 422, 'VALIDATION_ERROR', true, errors));
            }
            req.body = result.data;
            next();
        } catch (error) {
            next(error);
        }
    };
}
