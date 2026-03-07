// ============================================
// AirTrainr API - Booking Routes
// ============================================

import { Router, Request, Response } from 'express';
import { bookingService } from './booking.service';
import { calendarService } from '../calendar/calendar.service';
import { authenticate, authorize, asyncHandler } from '../../common/middleware';
import { UserRole, ApiResponse } from '@airtrainr/shared';

const router: ReturnType<typeof Router> = Router();

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

/**
 * POST /api/v1/bookings/:id/reschedule
 * Request a reschedule (athlete or trainer)
 */
router.post(
    '/:id/reschedule',
    authenticate,
    asyncHandler(async (req: Request, res: Response) => {
        const userId = (req as any).user.userId;
        const request = await bookingService.requestReschedule(
            req.params.id,
            userId,
            req.body.proposedTime,
            req.body.reason
        );

        const response: ApiResponse<typeof request> = {
            success: true,
            data: request,
        };
        res.json(response);
    })
);

/**
 * PATCH /api/v1/bookings/reschedule/:requestId/accept
 * Accept a reschedule request
 */
router.patch(
    '/reschedule/:requestId/accept',
    authenticate,
    asyncHandler(async (req: Request, res: Response) => {
        const userId = (req as any).user.userId;
        const request = await bookingService.acceptReschedule(
            req.params.requestId,
            userId
        );

        const response: ApiResponse<typeof request> = {
            success: true,
            data: request,
        };
        res.json(response);
    })
);

/**
 * PATCH /api/v1/bookings/reschedule/:requestId/decline
 * Decline a reschedule request
 */
router.patch(
    '/reschedule/:requestId/decline',
    authenticate,
    asyncHandler(async (req: Request, res: Response) => {
        const userId = (req as any).user.userId;
        const request = await bookingService.declineReschedule(
            req.params.requestId,
            userId
        );

        const response: ApiResponse<typeof request> = {
            success: true,
            data: request,
        };
        res.json(response);
    })
);

/**
 * GET /api/v1/bookings/:id/calendar/ics
 * Download an .ics file for the booking
 */
router.get(
    '/:id/calendar/ics',
    authenticate,
    asyncHandler(async (req: Request, res: Response) => {
        const userId = (req as any).user.userId;
        const booking = await bookingService.getBookingById(req.params.id, userId);
        const calendarData = calendarService.mapBookingToCalendarData(booking);
        const icsContent = await calendarService.generateICS(calendarData);

        res.setHeader('Content-Type', 'text/calendar; charset=utf-8');
        res.setHeader('Content-Disposition', `attachment; filename="training-${booking.id.slice(0, 8)}.ics"`);
        res.send(icsContent);
    })
);

/**
 * GET /api/v1/bookings/:id/calendar/google
 * Get a Google Calendar "Add Event" URL
 */
router.get(
    '/:id/calendar/google',
    authenticate,
    asyncHandler(async (req: Request, res: Response) => {
        const userId = (req as any).user.userId;
        const booking = await bookingService.getBookingById(req.params.id, userId);
        const calendarData = calendarService.mapBookingToCalendarData(booking);
        const url = calendarService.generateGoogleCalendarUrl(calendarData);

        const response: ApiResponse<{ url: string }> = {
            success: true,
            data: { url },
        };
        res.json(response);
    })
);

export default router;
