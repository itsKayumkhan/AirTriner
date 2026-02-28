// ============================================
// AirTrainr API - Booking Routes
// ============================================

import { Router, Request, Response } from 'express';
import { bookingService } from './booking.service';
import { authenticate, authorize, asyncHandler } from '../../common/middleware';
import { UserRole, ApiResponse } from '@airtrainr/shared';

const router = Router();

/**
 * POST /api/v1/bookings
 * Create a new booking (athlete only)
 */
router.post(
    '/',
    authenticate,
    authorize(UserRole.ATHLETE),
    asyncHandler(async (req: Request, res: Response) => {
        const athleteId = (req as any).user.userId;
        const booking = await bookingService.createBooking(athleteId, req.body);

        const response: ApiResponse<typeof booking> = {
            success: true,
            data: booking,
        };
        res.status(201).json(response);
    })
);

/**
 * GET /api/v1/bookings
 * Get user's bookings
 */
router.get(
    '/',
    authenticate,
    asyncHandler(async (req: Request, res: Response) => {
        const user = (req as any).user;
        const { status, fromDate, page, limit } = req.query;

        const result = await bookingService.getUserBookings(user.userId, user.role, {
            status,
            fromDate,
            page: page ? parseInt(page as string) : undefined,
            limit: limit ? parseInt(limit as string) : undefined,
        });

        const response: ApiResponse<typeof result.bookings> = {
            success: true,
            data: result.bookings,
            meta: result.meta,
        };
        res.json(response);
    })
);

/**
 * GET /api/v1/bookings/:id
 * Get booking details
 */
router.get(
    '/:id',
    authenticate,
    asyncHandler(async (req: Request, res: Response) => {
        const userId = (req as any).user.userId;
        const booking = await bookingService.getBookingById(req.params.id, userId);

        const response: ApiResponse<typeof booking> = {
            success: true,
            data: booking,
        };
        res.json(response);
    })
);

/**
 * PATCH /api/v1/bookings/:id/confirm
 * Trainer confirms booking
 */
router.patch(
    '/:id/confirm',
    authenticate,
    authorize(UserRole.TRAINER),
    asyncHandler(async (req: Request, res: Response) => {
        const userId = (req as any).user.userId;
        const booking = await bookingService.transitionStatus(
            req.params.id,
            'confirmed' as any,
            userId
        );

        const response: ApiResponse<typeof booking> = {
            success: true,
            data: booking,
        };
        res.json(response);
    })
);

/**
 * PATCH /api/v1/bookings/:id/complete
 * Trainer marks booking as completed
 */
router.patch(
    '/:id/complete',
    authenticate,
    authorize(UserRole.TRAINER),
    asyncHandler(async (req: Request, res: Response) => {
        const userId = (req as any).user.userId;
        const booking = await bookingService.transitionStatus(
            req.params.id,
            'completed' as any,
            userId
        );

        const response: ApiResponse<typeof booking> = {
            success: true,
            data: booking,
        };
        res.json(response);
    })
);

/**
 * PATCH /api/v1/bookings/:id/cancel
 * Cancel booking (athlete or trainer)
 */
router.patch(
    '/:id/cancel',
    authenticate,
    asyncHandler(async (req: Request, res: Response) => {
        const userId = (req as any).user.userId;
        const booking = await bookingService.transitionStatus(
            req.params.id,
            'cancelled' as any,
            userId,
            req.body.reason
        );

        const response: ApiResponse<typeof booking> = {
            success: true,
            data: booking,
        };
        res.json(response);
    })
);

/**
 * PATCH /api/v1/bookings/:id/no-show
 * Trainer marks athlete as no-show
 */
router.patch(
    '/:id/no-show',
    authenticate,
    authorize(UserRole.TRAINER),
    asyncHandler(async (req: Request, res: Response) => {
        const userId = (req as any).user.userId;
        const booking = await bookingService.transitionStatus(
            req.params.id,
            'no_show' as any,
            userId
        );

        const response: ApiResponse<typeof booking> = {
            success: true,
            data: booking,
        };
        res.json(response);
    })
);

export default router;
