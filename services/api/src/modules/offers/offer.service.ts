// ============================================
// AirTrainr API - Offer Service
// ============================================

import { PrismaClient } from '@prisma/client';
import { NotFoundError, BadRequestError, ForbiddenError } from '../../common/errors';
import { logger } from '../../common/logger';
import {
    OfferStatus,
    NotificationType,
    PLATFORM_FEE_PERCENTAGE,
} from '@airtrainr/shared';

const prisma = new PrismaClient();

export class OfferService {
    /**
     * Create a new training offer from a trainer to an athlete
     */
    async createOffer(trainerId: string, data: any) {
        // Verify trainer exists and has permission
        const trainer = await prisma.user.findFirst({
            where: { id: trainerId, role: 'trainer' },
            include: { trainerProfile: true }
        });

        if (!trainer || !trainer.trainerProfile) {
            throw new ForbiddenError('Only trainers can send offers');
        }

        // Verify athlete exists
        const athlete = await prisma.user.findFirst({
            where: { id: data.athleteId, role: 'athlete' }
        });

        if (!athlete) {
            throw new NotFoundError('Athlete not found');
        }

        // Create the offer
        const offer = await prisma.trainingOffer.create({
            data: {
                trainerId,
                athleteId: data.athleteId,
                status: 'pending',
                message: data.message,
                price: data.price,
                sessionLengthMin: data.sessionLengthMin || 60,
                sport: data.sport,
                proposedDates: data.proposedDates || {},
            }
        });

        // Send notification to athlete
        await prisma.notification.create({
            data: {
                userId: data.athleteId,
                type: NotificationType.OFFER_RECEIVED,
                title: `Training Offer from ${trainer.firstName}`,
                body: data.message || `${trainer.firstName} has sent you a training proposal for ${data.sport || 'training'}.`,
                data: {
                    offer_id: offer.id,
                    trainer_id: trainerId,
                    trainer_name: `${trainer.firstName} ${trainer.lastName}`,
                    price: data.price,
                    sport: data.sport,
                    ...data.proposedDates
                }
            }
        });

        logger.info(`Offer created: ${offer.id} (Trainer: ${trainerId} -> Athlete: ${data.athleteId})`);
        return offer;
    }

    /**
     * Respond to an offer (Accept/Decline)
     */
    async respondToOffer(offerId: string, userId: string, response: OfferStatus) {
        const offer = await prisma.trainingOffer.findUnique({
            where: { id: offerId },
            include: {
                trainer: { select: { firstName: true, lastName: true, id: true } },
                athlete: { select: { firstName: true, id: true } }
            }
        });

        if (!offer) throw new NotFoundError('Offer not found');
        if (offer.athleteId !== userId) throw new ForbiddenError('You are not the recipient of this offer');
        if (offer.status !== 'pending') throw new BadRequestError('Offer is no longer pending');

        if (response === OfferStatus.ACCEPTED) {
            // Create a booking automatically
            const price = Number(offer.price);
            const platformFee = Math.round(price * PLATFORM_FEE_PERCENTAGE * 100) / 100;
            const totalPaid = price + platformFee;

            const proposed = (offer.proposedDates as any) || {};

            // Start a transaction to update offer and create booking
            return await prisma.$transaction(async (tx) => {
                const updatedOffer = await tx.trainingOffer.update({
                    where: { id: offerId },
                    data: { status: 'accepted' }
                });

                const booking = await tx.booking.create({
                    data: {
                        athleteId: offer.athleteId,
                        trainerId: offer.trainerId,
                        sport: offer.sport || 'General Training',
                        scheduledAt: proposed.scheduledAt ? new Date(proposed.scheduledAt) : new Date(), // Fallback if no specific date
                        durationMinutes: offer.sessionLengthMin,
                        price,
                        platformFee,
                        totalPaid,
                        status: 'pending', // Requires trainer final confirmation in standard flow, or we can auto-confirm
                        athleteNotes: `Accepted offer: ${offer.message || 'No message'}`,
                        statusHistory: [
                            {
                                from: null,
                                to: 'pending',
                                by: userId,
                                at: new Date().toISOString(),
                                reason: 'Accepted Trainer Offer'
                            }
                        ]
                    }
                });

                // Notify trainer
                await tx.notification.create({
                    data: {
                        userId: offer.trainerId,
                        type: NotificationType.BOOKING_CONFIRMED, // Or a specific OFFER_ACCEPTED type
                        title: 'Offer Accepted!',
                        body: `${offer.athlete.firstName} accepted your training offer. A new booking has been created.`,
                        data: { booking_id: booking.id, offer_id: offer.id }
                    }
                });

                return { offer: updatedOffer, booking };
            });
        } else {
            // Decline or Expire
            const updatedOffer = await prisma.trainingOffer.update({
                where: { id: offerId },
                data: { status: response as any }
            });

            // Notify trainer
            await prisma.notification.create({
                data: {
                    userId: offer.trainerId,
                    type: 'OFFER_DECLINED',
                    title: 'Offer Declined',
                    body: `${offer.athlete.firstName} declined your training offer.`,
                    data: { offer_id: offer.id }
                }
            });

            return { offer: updatedOffer };
        }
    }

    /**
     * Get offers for a user
     */
    async getOffers(userId: string, role: string) {
        return await prisma.trainingOffer.findMany({
            where: role === 'trainer' ? { trainerId: userId } : { athleteId: userId },
            include: {
                trainer: { select: { firstName: true, lastName: true, avatarUrl: true } },
                athlete: { select: { firstName: true, lastName: true, avatarUrl: true } }
            },
            orderBy: { createdAt: 'desc' }
        });
    }
}

export const offerService = new OfferService();
