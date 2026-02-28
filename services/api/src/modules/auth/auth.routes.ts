// ============================================
// AirTrainr API - Auth Routes
// ============================================

import { Router, Request, Response } from 'express';
import { authService } from './auth.service';
import { registerSchema, loginSchema, refreshTokenSchema } from './auth.validation';
import { authenticate, asyncHandler, validateBody } from '../../common/middleware';
import { ApiResponse, AuthTokens } from '@airtrainr/shared';

const router = Router();

/**
 * POST /api/v1/auth/register
 * Register a new user (athlete or trainer)
 */
router.post(
    '/register',
    validateBody(registerSchema),
    asyncHandler(async (req: Request, res: Response) => {
        const tokens = await authService.register(req.body);

        // Set refresh token as HTTP-only cookie
        res.cookie('refreshToken', tokens.refreshToken, {
            httpOnly: true,
            secure: process.env.NODE_ENV === 'production',
            sameSite: 'strict',
            maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
            path: '/api/v1/auth',
        });

        const response: ApiResponse<AuthTokens> = {
            success: true,
            data: tokens,
        };

        res.status(201).json(response);
    })
);

/**
 * POST /api/v1/auth/login
 * Login with email and password
 */
router.post(
    '/login',
    validateBody(loginSchema),
    asyncHandler(async (req: Request, res: Response) => {
        const tokens = await authService.login(req.body);

        res.cookie('refreshToken', tokens.refreshToken, {
            httpOnly: true,
            secure: process.env.NODE_ENV === 'production',
            sameSite: 'strict',
            maxAge: 7 * 24 * 60 * 60 * 1000,
            path: '/api/v1/auth',
        });

        const response: ApiResponse<AuthTokens> = {
            success: true,
            data: tokens,
        };

        res.json(response);
    })
);

/**
 * POST /api/v1/auth/refresh
 * Refresh access token using refresh token
 */
router.post(
    '/refresh',
    asyncHandler(async (req: Request, res: Response) => {
        const refreshToken = req.cookies?.refreshToken || req.body.refreshToken;

        if (!refreshToken) {
            return res.status(400).json({
                success: false,
                error: { code: 'BAD_REQUEST', message: 'Refresh token required' },
            });
        }

        const tokens = await authService.refreshAccessToken(refreshToken);

        res.cookie('refreshToken', tokens.refreshToken, {
            httpOnly: true,
            secure: process.env.NODE_ENV === 'production',
            sameSite: 'strict',
            maxAge: 7 * 24 * 60 * 60 * 1000,
            path: '/api/v1/auth',
        });

        const response: ApiResponse<AuthTokens> = {
            success: true,
            data: tokens,
        };

        res.json(response);
    })
);

/**
 * POST /api/v1/auth/logout
 * Logout current device
 */
router.post(
    '/logout',
    asyncHandler(async (req: Request, res: Response) => {
        const refreshToken = req.cookies?.refreshToken || req.body.refreshToken;

        if (refreshToken) {
            await authService.logout(refreshToken);
        }

        res.clearCookie('refreshToken', { path: '/api/v1/auth' });

        const response: ApiResponse<{ message: string }> = {
            success: true,
            data: { message: 'Logged out successfully' },
        };

        res.json(response);
    })
);

/**
 * POST /api/v1/auth/logout-all
 * Logout from all devices
 */
router.post(
    '/logout-all',
    authenticate,
    asyncHandler(async (req: Request, res: Response) => {
        const userId = (req as any).user.userId;
        await authService.logoutAll(userId);

        res.clearCookie('refreshToken', { path: '/api/v1/auth' });

        const response: ApiResponse<{ message: string }> = {
            success: true,
            data: { message: 'Logged out from all devices' },
        };

        res.json(response);
    })
);

/**
 * GET /api/v1/auth/me
 * Get current user profile
 */
router.get(
    '/me',
    authenticate,
    asyncHandler(async (req: Request, res: Response) => {
        const userId = (req as any).user.userId;
        const profile = await authService.getProfile(userId);

        const response: ApiResponse<typeof profile> = {
            success: true,
            data: profile,
        };

        res.json(response);
    })
);

export default router;
