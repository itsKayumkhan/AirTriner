// ============================================
// AirTrainr API - Payment Routes
// ============================================

import { Router, Request, Response } from 'express';
import { paymentService } from './payment.service';
import { authenticate, authorize, asyncHandler } from '../../common/middleware';
import { UserRole, ApiResponse } from '@airtrainr/shared';

const router = Router();

/**
 * POST /api/v1/payments/booking/:id
 * Process payment for a booking (athlete)
 */
router.post(
    '/booking/:id',
    authenticate,
    authorize(UserRole.ATHLETE),
    asyncHandler(async (req: Request, res: Response) => {
        const result = await paymentService.processBookingPayment(req.params.id);

        const response: ApiResponse<typeof result> = {
            success: true,
            data: result,
        };
        res.json(response);
    })
);

/**
 * POST /api/v1/payments/trainer/setup
 * Create Stripe Connect account for trainer
 */
router.post(
    '/trainer/setup',
    authenticate,
    authorize(UserRole.TRAINER),
    asyncHandler(async (req: Request, res: Response) => {
        const user = (req as any).user;
        const account = await paymentService.createTrainerAccount(user.userId, user.email);

        const response: ApiResponse<typeof account> = {
            success: true,
            data: account,
        };
        res.json(response);
    })
);

/**
 * GET /api/v1/payments/trainer/onboarding
 * Get Stripe onboarding link for trainer
 */
router.get(
    '/trainer/onboarding',
    authenticate,
    authorize(UserRole.TRAINER),
    asyncHandler(async (req: Request, res: Response) => {
        const userId = (req as any).user.userId;
        const link = await paymentService.getOnboardingLink(userId);

        const response: ApiResponse<typeof link> = {
            success: true,
            data: link,
        };
        res.json(response);
    })
);

/**
 * GET /api/v1/payments/trainer/subscription
 * Check trainer subscription status
 */
router.get(
    '/trainer/subscription',
    authenticate,
    authorize(UserRole.TRAINER),
    asyncHandler(async (req: Request, res: Response) => {
        const userId = (req as any).user.userId;
        const status = await paymentService.checkTrainerSubscription(userId);

        const response: ApiResponse<typeof status> = {
            success: true,
            data: status,
        };
        res.json(response);
    })
);

export default router;
