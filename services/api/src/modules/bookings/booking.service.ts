// ============================================
// AirTrainr API - Booking Service
// ============================================

import { PrismaClient, BookingStatus as PrismaBookingStatus } from '@prisma/client';
import { NotFoundError, BadRequestError, ForbiddenError } from '../../common/errors';
import { logger } from '../../common/logger';
import {
    BookingStatus,
    PLATFORM_FEE_PERCENTAGE,
    HOLD_HOURS_NEW_TRAINER,
    HOLD_HOURS_ESTABLISHED_TRAINER,
    ESTABLISHED_TRAINER_THRESHOLD,
} from '@airtrainr/shared';

const prisma = new PrismaClient();

// Valid state transitions
const VALID_TRANSITIONS: Record<string, string[]> = {
    [BookingStatus.PENDING]: [BookingStatus.CONFIRMED, BookingStatus.CANCELLED],
    [BookingStatus.CONFIRMED]: [BookingStatus.COMPLETED, BookingStatus.CANCELLED, BookingStatus.NO_SHOW],
    [BookingStatus.COMPLETED]: [BookingStatus.DISPUTED],
    [BookingStatus.NO_SHOW]: [BookingStatus.DISPUTED],
};

export class BookingService {
    /**
     * Create a new booking
     */
    async createBooking(athleteId: string, data: any) {
        // Verify trainer exists and is active
        const trainer = await prisma.trainerProfile.findFirst({
            where: {
                userId: data.trainerId,
                subscriptionStatus: { in: ['trial', 'active'] },
                verificationStatus: { not: 'suspended' },
            },
            include: { user: true },
        });

        if (!trainer) {
            throw new NotFoundError('Trainer not found or not available');
        }

        // Check scheduling conflict
        const existingBooking = await prisma.booking.findFirst({
            where: {
                trainerId: data.trainerId,
                status: { in: ['pending', 'confirmed'] },
                scheduledAt: new Date(data.scheduledAt),
            },
        });

        if (existingBooking) {
            throw new BadRequestError('Trainer already has a booking at this time');
        }

        // Calculate pricing
        const price = Number(trainer.hourlyRate) * (data.durationMinutes / 60);
        const platformFee = Math.round(price * PLATFORM_FEE_PERCENTAGE * 100) / 100;
        const totalPaid = price + platformFee;

        // Create booking
        const booking = await prisma.booking.create({
            data: {
                athleteId,
                trainerId: data.trainerId,
                subAccountId: data.subAccountId || null,
                sport: data.sport,
                scheduledAt: new Date(data.scheduledAt),
                durationMinutes: data.durationMinutes || 60,
                latitude: data.latitude,
                longitude: data.longitude,
                address: data.address,
                athleteNotes: data.athleteNotes,
                price,
                platformFee,
                totalPaid,
                status: 'pending',
                statusHistory: [
                    {
                        from: null,
                        to: 'pending',
                        by: athleteId,
                        at: new Date().toISOString(),
                    },
                ],
            },
            include: {
                athlete: { select: { firstName: true, lastName: true, email: true } },
                trainer: { select: { firstName: true, lastName: true, email: true } },
            },
        });

        logger.info(`Booking created: ${booking.id} (Athlete: ${athleteId}, Trainer: ${data.trainerId})`);
        return booking;
    }

    /**
     * Transition booking status (state machine)
     */
    async transitionStatus(
        bookingId: string,
        newStatus: BookingStatus,
        actorId: string,
        reason?: string
    ) {
        const booking = await prisma.booking.findUnique({
            where: { id: bookingId },
        });

        if (!booking) throw new NotFoundError('Booking not found');

        // Validate transition
        const allowed = VALID_TRANSITIONS[booking.status] || [];
        if (!allowed.includes(newStatus)) {
            throw new BadRequestError(
                `Cannot transition from '${booking.status}' to '${newStatus}'`
            );
        }

        // Validate permissions
        this.validateActorPermission(booking, actorId, newStatus);

        // Update booking status
        const existingHistory = (booking.statusHistory as any[]) || [];
        const updatedBooking = await prisma.booking.update({
            where: { id: bookingId },
            data: {
                status: newStatus as PrismaBookingStatus,
                statusHistory: [
                    ...existingHistory,
                    {
                        from: booking.status,
                        to: newStatus,
                        by: actorId,
                        at: new Date().toISOString(),
                        reason,
                    },
                ],
            },
        });

        // Handle side effects
        await this.handleSideEffects(updatedBooking, newStatus);

        logger.info(`Booking ${bookingId} transitioned: ${booking.status} → ${newStatus}`);
        return updatedBooking;
    }

    /**
     * Get bookings for a user (as athlete or trainer)
     */
    async getUserBookings(userId: string, role: string, filters: any = {}) {
        const where: any = {};

        if (role === 'athlete') {
            where.athleteId = userId;
        } else if (role === 'trainer') {
            where.trainerId = userId;
        }

        if (filters.status) {
            where.status = filters.status;
        }

        if (filters.fromDate) {
            where.scheduledAt = { gte: new Date(filters.fromDate) };
        }

        const page = filters.page || 1;
        const limit = filters.limit || 20;

        const [bookings, total] = await Promise.all([
            prisma.booking.findMany({
                where,
                include: {
                    athlete: { select: { firstName: true, lastName: true, avatarUrl: true } },
                    trainer: { select: { firstName: true, lastName: true, avatarUrl: true } },
                },
                orderBy: { scheduledAt: 'desc' },
                skip: (page - 1) * limit,
                take: limit,
            }),
            prisma.booking.count({ where }),
        ]);

        return {
            bookings,
            meta: {
                page,
                limit,
                total,
                totalPages: Math.ceil(total / limit),
            },
        };
    }

    /**
     * Get single booking details
     */
    async getBookingById(bookingId: string, userId: string) {
        const booking = await prisma.booking.findUnique({
            where: { id: bookingId },
            include: {
                athlete: { select: { firstName: true, lastName: true, avatarUrl: true, email: true } },
                trainer: { select: { firstName: true, lastName: true, avatarUrl: true, email: true } },
                paymentTransaction: true,
                review: true,
            },
        });

        if (!booking) throw new NotFoundError('Booking not found');

        // Only athlete, trainer, or admin can view
        if (booking.athleteId !== userId && booking.trainerId !== userId) {
            throw new ForbiddenError('You cannot view this booking');
        }

        return booking;
    }

    // ---- Private methods ----

    private validateActorPermission(
        booking: any,
        actorId: string,
        newStatus: BookingStatus
    ) {
        const isAthlete = booking.athleteId === actorId;
        const isTrainer = booking.trainerId === actorId;

        if (!isAthlete && !isTrainer) {
            throw new ForbiddenError('You are not part of this booking');
        }

        // Only trainer can confirm
        if (newStatus === BookingStatus.CONFIRMED && !isTrainer) {
            throw new ForbiddenError('Only the trainer can confirm a booking');
        }

        // Only trainer can mark completed or no_show
        if (
            (newStatus === BookingStatus.COMPLETED || newStatus === BookingStatus.NO_SHOW) &&
            !isTrainer
        ) {
            throw new ForbiddenError('Only the trainer can mark completion status');
        }
    }

    private async handleSideEffects(booking: any, newStatus: BookingStatus) {
        switch (newStatus) {
            case BookingStatus.CONFIRMED:
                // Create payment hold
                await this.createPaymentHold(booking);
                break;
            case BookingStatus.COMPLETED:
                // Schedule payout
                await this.schedulePayoutRelease(booking.id);
                break;
            case BookingStatus.CANCELLED:
                // Process refund if payment was held
                await this.processRefund(booking.id);
                break;
        }
    }

    private async createPaymentHold(booking: any) {
        const completedSessions = await prisma.booking.count({
            where: { trainerId: booking.trainerId, status: 'completed' },
        });

        const holdHours =
            completedSessions < ESTABLISHED_TRAINER_THRESHOLD
                ? HOLD_HOURS_NEW_TRAINER
                : HOLD_HOURS_ESTABLISHED_TRAINER;

        await prisma.paymentTransaction.create({
            data: {
                bookingId: booking.id,
                amount: booking.totalPaid,
                platformFee: booking.platformFee,
                trainerPayout: Number(booking.price) - Number(booking.platformFee),
                status: 'held',
                holdUntil: new Date(Date.now() + holdHours * 60 * 60 * 1000),
            },
        });
    }

    private async schedulePayoutRelease(bookingId: string) {
        // In production, this would be queued via BullMQ
        logger.info(`Payout release scheduled for booking: ${bookingId}`);
    }

    private async processRefund(bookingId: string) {
        const transaction = await prisma.paymentTransaction.findUnique({
            where: { bookingId },
        });

        if (transaction && transaction.status === 'held') {
            await prisma.paymentTransaction.update({
                where: { id: transaction.id },
                data: { status: 'refunded' },
            });
            logger.info(`Refund processed for booking: ${bookingId}`);
        }
    }
}

export const bookingService = new BookingService();
