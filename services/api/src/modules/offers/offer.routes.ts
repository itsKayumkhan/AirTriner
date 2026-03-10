// ============================================
// AirTrainr API - Offer Routes
// ============================================

import { Router } from 'express';
import { offerService } from './offer.service';
import { authenticate, authorize, asyncHandler } from '../../common/middleware';
import { UserRole } from '@airtrainr/shared';

const router: ReturnType<typeof Router> = Router();

/**
 * @route   POST /api/offers
 * @desc    Create a new training offer (Trainer only)
 * @access  Private (Trainer)
 */
router.post(
    '/',
    authenticate,
    authorize(UserRole.TRAINER),
    asyncHandler(async (req, res) => {
        const offer = await offerService.createOffer((req as any).user!.userId, req.body);
        res.status(201).json({ success: true, data: offer });
    })
);

/**
 * @route   GET /api/offers
 * @desc    Get offers for the authenticated user
 * @access  Private
 */
router.get(
    '/',
    authenticate,
    asyncHandler(async (req, res) => {
        const offers = await offerService.getOffers((req as any).user!.userId, (req as any).user!.role);
        res.status(200).json({ success: true, data: offers });
    })
);

/**
 * @route   PATCH /api/offers/:id/respond
 * @desc    Respond to an offer (Athlete only)
 * @access  Private (Athlete)
 */
router.patch(
    '/:id/respond',
    authenticate,
    authorize(UserRole.ATHLETE),
    asyncHandler(async (req, res) => {
        const result = await offerService.respondToOffer(
            req.params.id,
            (req as any).user!.userId,
            req.body.status
        );
        res.status(200).json({ success: true, data: result });
    })
);

export default router;
