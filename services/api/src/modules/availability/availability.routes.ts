// ============================================
// AirTrainr API - Availability Routes
// ============================================

import { Router, Request, Response } from 'express';
import { PrismaClient } from '@prisma/client';
import { availabilityService } from './availability.service';
import { authenticate, authorize, asyncHandler } from '../../common/middleware';
import { UserRole, ApiResponse } from '@airtrainr/shared';

const router: ReturnType<typeof Router> = Router();
const prisma = new PrismaClient();

/**
 * GET /api/v1/availability
 * Get availability for current trainer
 */
router.get(
    '/',
    authenticate,
    authorize(UserRole.TRAINER),
    asyncHandler(async (req: Request, res: Response) => {
        const userId = (req as any).user.userId;
        const profile = await prisma.trainerProfile.findUnique({
            where: { userId }
        });
        
        if (!profile) {
            res.status(404).json({ success: false, error: 'Trainer profile not found' });
            return;
        }

        const slots = await prisma.availabilitySlot.findMany({
            where: { trainerId: profile.id }
        });

        const response: ApiResponse<typeof slots> = {
            success: true,
            data: slots,
        };
        res.json(response);
    })
);

/**
 * POST /api/v1/availability
 * Create a new availability slot
 */
router.post(
    '/',
    authenticate,
    authorize(UserRole.TRAINER),
    asyncHandler(async (req: Request, res: Response) => {
        const userId = (req as any).user.userId;
        const profile = await prisma.trainerProfile.findUnique({
            where: { userId }
        });

        if (!profile) {
            res.status(404).json({ success: false, error: 'Trainer profile not found' });
            return;
        }

        const slot = await availabilityService.createSlot(profile.id, req.body);

        const response: ApiResponse<typeof slot> = {
            success: true,
            data: slot,
        };
        res.status(201).json(response);
    })
);

/**
 * PATCH /api/v1/availability/:id
 * Update an availability slot
 */
router.patch(
    '/:id',
    authenticate,
    authorize(UserRole.TRAINER),
    asyncHandler(async (req: Request, res: Response) => {
        const userId = (req as any).user.userId;
        const profile = await prisma.trainerProfile.findUnique({
            where: { userId }
        });

        const slot = await availabilityService.updateSlot(req.params.id, profile?.id || '', req.body);

        const response: ApiResponse<typeof slot> = {
            success: true,
            data: slot,
        };
        res.json(response);
    })
);

/**
 * DELETE /api/v1/availability/:id
 * Delete an availability slot
 */
router.delete(
    '/:id',
    authenticate,
    authorize(UserRole.TRAINER),
    asyncHandler(async (req: Request, res: Response) => {
        const userId = (req as any).user.userId;
        const profile = await prisma.trainerProfile.findUnique({
            where: { userId }
        });

        await availabilityService.deleteSlot(req.params.id, profile?.id || '');

        res.status(204).end();
    })
);

export default router;
