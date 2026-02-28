// ============================================
// AirTrainr API - Matching / Discovery Routes
// ============================================

import { Router, Request, Response } from 'express';
import { matchingService } from './matching.service';
import { asyncHandler } from '../../common/middleware';
import { ApiResponse } from '@airtrainr/shared';

const router = Router();

/**
 * GET /api/v1/discover/trainers
 * Search for trainers (public endpoint)
 */
router.get(
    '/trainers',
    asyncHandler(async (req: Request, res: Response) => {
        const {
            sports,
            latitude,
            longitude,
            radius,
            minRate,
            maxRate,
            verifiedOnly,
            page,
            limit,
            sortBy,
        } = req.query;

        const result = await matchingService.findTrainers({
            sports: sports ? (sports as string).split(',') : undefined,
            latitude: latitude ? parseFloat(latitude as string) : undefined,
            longitude: longitude ? parseFloat(longitude as string) : undefined,
            radius: radius ? parseInt(radius as string) : undefined,
            minRate: minRate ? parseFloat(minRate as string) : undefined,
            maxRate: maxRate ? parseFloat(maxRate as string) : undefined,
            verifiedOnly: verifiedOnly === 'true',
            page: page ? parseInt(page as string) : undefined,
            limit: limit ? parseInt(limit as string) : undefined,
            sortBy: sortBy as string,
        });

        const response: ApiResponse<typeof result.trainers> = {
            success: true,
            data: result.trainers,
            meta: result.meta,
        };
        res.json(response);
    })
);

/**
 * GET /api/v1/discover/trainers/:id/availability
 * Get trainer availability for a date
 */
router.get(
    '/trainers/:id/availability',
    asyncHandler(async (req: Request, res: Response) => {
        const { date } = req.query;

        if (!date) {
            return res.status(400).json({
                success: false,
                error: { code: 'BAD_REQUEST', message: 'Date parameter is required' },
            });
        }

        const availability = await matchingService.getTrainerAvailability(
            req.params.id,
            date as string
        );

        const response: ApiResponse<typeof availability> = {
            success: true,
            data: availability,
        };
        res.json(response);
    })
);

export default router;
