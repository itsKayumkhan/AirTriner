// ============================================
// AirTrainr API - User Routes
// ============================================

import { Router, Request, Response } from 'express';
import { userService } from './user.service';
import { authenticate, authorize, asyncHandler } from '../../common/middleware';
import { UserRole, ApiResponse } from '@airtrainr/shared';

const router = Router();

/**
 * PUT /api/v1/users/profile
 * Update current user profile
 */
router.put(
    '/profile',
    authenticate,
    asyncHandler(async (req: Request, res: Response) => {
        const userId = (req as any).user.userId;
        const profile = await userService.updateProfile(userId, req.body);

        const response: ApiResponse<typeof profile> = {
            success: true,
            data: profile,
        };
        res.json(response);
    })
);

/**
 * PUT /api/v1/users/athlete-profile
 * Update athlete-specific profile
 */
router.put(
    '/athlete-profile',
    authenticate,
    authorize(UserRole.ATHLETE),
    asyncHandler(async (req: Request, res: Response) => {
        const userId = (req as any).user.userId;
        const profile = await userService.updateAthleteProfile(userId, req.body);

        const response: ApiResponse<typeof profile> = {
            success: true,
            data: profile,
        };
        res.json(response);
    })
);

/**
 * PUT /api/v1/users/trainer-profile
 * Update trainer-specific profile
 */
router.put(
    '/trainer-profile',
    authenticate,
    authorize(UserRole.TRAINER),
    asyncHandler(async (req: Request, res: Response) => {
        const userId = (req as any).user.userId;
        const profile = await userService.updateTrainerProfile(userId, req.body);

        const response: ApiResponse<typeof profile> = {
            success: true,
            data: profile,
        };
        res.json(response);
    })
);

/**
 * GET /api/v1/users/sub-accounts
 * Get user's sub-accounts
 */
router.get(
    '/sub-accounts',
    authenticate,
    authorize(UserRole.ATHLETE),
    asyncHandler(async (req: Request, res: Response) => {
        const userId = (req as any).user.userId;
        const subAccounts = await userService.getSubAccounts(userId);

        const response: ApiResponse<typeof subAccounts> = {
            success: true,
            data: subAccounts,
        };
        res.json(response);
    })
);

/**
 * POST /api/v1/users/sub-accounts
 * Create a sub-account
 */
router.post(
    '/sub-accounts',
    authenticate,
    authorize(UserRole.ATHLETE),
    asyncHandler(async (req: Request, res: Response) => {
        const userId = (req as any).user.userId;
        const subAccount = await userService.createSubAccount(userId, req.body);

        const response: ApiResponse<typeof subAccount> = {
            success: true,
            data: subAccount,
        };
        res.status(201).json(response);
    })
);

/**
 * DELETE /api/v1/users/sub-accounts/:id
 * Delete a sub-account
 */
router.delete(
    '/sub-accounts/:id',
    authenticate,
    authorize(UserRole.ATHLETE),
    asyncHandler(async (req: Request, res: Response) => {
        const userId = (req as any).user.userId;
        await userService.deleteSubAccount(userId, req.params.id);

        const response: ApiResponse<{ message: string }> = {
            success: true,
            data: { message: 'Sub-account deleted' },
        };
        res.json(response);
    })
);

/**
 * GET /api/v1/users/trainers/:id
 * Get trainer public profile
 */
router.get(
    '/trainers/:id',
    asyncHandler(async (req: Request, res: Response) => {
        const profile = await userService.getTrainerPublicProfile(req.params.id);

        const response: ApiResponse<typeof profile> = {
            success: true,
            data: profile,
        };
        res.json(response);
    })
);

/**
 * PUT /api/v1/users/availability
 * Set trainer availability
 */
router.put(
    '/availability',
    authenticate,
    authorize(UserRole.TRAINER),
    asyncHandler(async (req: Request, res: Response) => {
        const userId = (req as any).user.userId;
        const result = await userService.setAvailability(userId, req.body.slots);

        const response: ApiResponse<typeof result> = {
            success: true,
            data: result,
        };
        res.json(response);
    })
);

/**
 * DELETE /api/v1/users/account
 * Soft delete user account
 */
router.delete(
    '/account',
    authenticate,
    asyncHandler(async (req: Request, res: Response) => {
        const userId = (req as any).user.userId;
        await userService.deleteAccount(userId);

        res.clearCookie('refreshToken', { path: '/api/v1/auth' });

        const response: ApiResponse<{ message: string }> = {
            success: true,
            data: { message: 'Account deleted' },
        };
        res.json(response);
    })
);

export default router;
