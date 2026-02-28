// ============================================
// AirTrainr API - Payment Service (Stripe)
// ============================================

import { PrismaClient } from '@prisma/client';
import { logger } from '../../common/logger';
import { PaymentError, NotFoundError } from '../../common/errors';
import config from '../../config';
import {
    PLATFORM_FEE_PERCENTAGE,
    HOLD_HOURS_NEW_TRAINER,
    HOLD_HOURS_ESTABLISHED_TRAINER,
    ESTABLISHED_TRAINER_THRESHOLD,
    TRAINER_SUBSCRIPTION_ANNUAL,
    TRAINER_TRIAL_DAYS,
} from '@airtrainr/shared';

const prisma = new PrismaClient();

export class PaymentService {
    private stripe: any;

    constructor() {
        if (config.stripeSecretKey) {
            // Dynamic import to avoid requiring stripe in dev without key
            try {
                const Stripe = require('stripe');
                this.stripe = new Stripe(config.stripeSecretKey, {
                    apiVersion: '2023-10-16',
                });
            } catch (e) {
                logger.warn('Stripe not initialized - missing key or package');
            }
        }
    }

    /**
     * Create Stripe Connect account for trainer
     */
    async createTrainerAccount(userId: string, email: string) {
        if (!this.stripe) {
            logger.warn('Stripe not configured - skipping account creation');
            return { id: 'mock_acct_' + userId };
        }

        const account = await this.stripe.accounts.create({
            type: 'express',
            email,
            capabilities: {
                card_payments: { requested: true },
                transfers: { requested: true },
            },
            metadata: { userId },
        });

        // Save Stripe account ID to trainer profile
        await prisma.trainerProfile.update({
            where: { userId },
            data: { stripeAccountId: account.id },
        });

        logger.info(`Stripe account created for trainer: ${userId} (${account.id})`);
        return account;
    }

    /**
     * Generate Stripe Connect onboarding link
     */
    async getOnboardingLink(userId: string) {
        const trainer = await prisma.trainerProfile.findUnique({
            where: { userId },
        });

        if (!trainer?.stripeAccountId) {
            throw new NotFoundError('Stripe account not found');
        }

        if (!this.stripe) {
            return { url: 'https://dashboard.stripe.com/test' };
        }

        const link = await this.stripe.accountLinks.create({
            account: trainer.stripeAccountId,
            refresh_url: `${config.corsOrigins[0]}/trainer/onboarding/refresh`,
            return_url: `${config.corsOrigins[0]}/trainer/onboarding/complete`,
            type: 'account_onboarding',
        });

        return { url: link.url };
    }

    /**
     * Process booking payment (create payment intent with hold)
     */
    async processBookingPayment(bookingId: string) {
        const booking = await prisma.booking.findUnique({
            where: { id: bookingId },
            include: {
                trainer: {
                    include: { trainerProfile: true },
                },
            },
        });

        if (!booking) throw new NotFoundError('Booking not found');

        const trainerProfile = booking.trainer.trainerProfile;
        if (!trainerProfile) throw new NotFoundError('Trainer profile not found');

        const amount = Math.round(Number(booking.totalPaid) * 100); // Convert to cents
        const platformFee = Math.round(Number(booking.platformFee) * 100);

        if (!this.stripe) {
            // Mock payment intent for development
            const mockTransaction = await prisma.paymentTransaction.create({
                data: {
                    bookingId,
                    stripePaymentIntentId: `mock_pi_${bookingId}`,
                    amount: booking.totalPaid,
                    platformFee: booking.platformFee,
                    trainerPayout: Number(booking.price) - Number(booking.platformFee),
                    status: 'held',
                    holdUntil: new Date(Date.now() + HOLD_HOURS_NEW_TRAINER * 60 * 60 * 1000),
                },
            });

            return {
                clientSecret: 'mock_client_secret',
                transactionId: mockTransaction.id,
            };
        }

        // Create Stripe payment intent
        const paymentIntent = await this.stripe.paymentIntents.create({
            amount,
            currency: 'usd',
            application_fee_amount: platformFee,
            transfer_data: {
                destination: trainerProfile.stripeAccountId,
            },
            capture_method: 'manual', // Hold funds (escrow)
            metadata: {
                bookingId: booking.id,
                trainerId: booking.trainerId,
                athleteId: booking.athleteId,
            },
        });

        // Calculate hold period
        const completedSessions = await prisma.booking.count({
            where: { trainerId: booking.trainerId, status: 'completed' },
        });
        const holdHours = completedSessions < ESTABLISHED_TRAINER_THRESHOLD
            ? HOLD_HOURS_NEW_TRAINER
            : HOLD_HOURS_ESTABLISHED_TRAINER;

        // Record transaction
        const transaction = await prisma.paymentTransaction.create({
            data: {
                bookingId,
                stripePaymentIntentId: paymentIntent.id,
                amount: booking.totalPaid,
                platformFee: booking.platformFee,
                trainerPayout: Number(booking.price) - Number(booking.platformFee),
                status: 'held',
                holdUntil: new Date(Date.now() + holdHours * 60 * 60 * 1000),
            },
        });

        logger.info(`Payment intent created: ${paymentIntent.id} for booking: ${bookingId}`);

        return {
            clientSecret: paymentIntent.client_secret,
            transactionId: transaction.id,
        };
    }

    /**
     * Release funds after hold period
     */
    async releaseFunds(bookingId: string) {
        const transaction = await prisma.paymentTransaction.findUnique({
            where: { bookingId },
        });

        if (!transaction) throw new NotFoundError('Transaction not found');

        if (transaction.holdUntil && new Date() < transaction.holdUntil) {
            throw new PaymentError('Hold period has not expired yet');
        }

        if (this.stripe && transaction.stripePaymentIntentId && !transaction.stripePaymentIntentId.startsWith('mock_')) {
            await this.stripe.paymentIntents.capture(transaction.stripePaymentIntentId);
        }

        await prisma.paymentTransaction.update({
            where: { id: transaction.id },
            data: {
                status: 'released',
                releasedAt: new Date(),
            },
        });

        logger.info(`Funds released for booking: ${bookingId}`);
    }

    /**
     * Refund payment
     */
    async refundPayment(bookingId: string) {
        const transaction = await prisma.paymentTransaction.findUnique({
            where: { bookingId },
        });

        if (!transaction) throw new NotFoundError('Transaction not found');

        if (this.stripe && transaction.stripePaymentIntentId && !transaction.stripePaymentIntentId.startsWith('mock_')) {
            await this.stripe.refunds.create({
                payment_intent: transaction.stripePaymentIntentId,
            });
        }

        await prisma.paymentTransaction.update({
            where: { id: transaction.id },
            data: { status: 'refunded' },
        });

        logger.info(`Payment refunded for booking: ${bookingId}`);
    }

    /**
     * Check trainer subscription status
     */
    async checkTrainerSubscription(userId: string) {
        const trainer = await prisma.trainerProfile.findUnique({
            where: { userId },
        });

        if (!trainer) throw new NotFoundError('Trainer profile not found');

        // Check if trial expired
        if (trainer.subscriptionStatus === 'trial' && trainer.trialStartedAt) {
            const trialEnd = new Date(trainer.trialStartedAt);
            trialEnd.setDate(trialEnd.getDate() + TRAINER_TRIAL_DAYS);

            if (new Date() > trialEnd) {
                await prisma.trainerProfile.update({
                    where: { userId },
                    data: { subscriptionStatus: 'expired' },
                });
                return { status: 'expired', needsPayment: true };
            }

            const daysRemaining = Math.ceil((trialEnd.getTime() - Date.now()) / (1000 * 60 * 60 * 24));
            return { status: 'trial', daysRemaining };
        }

        // Check if annual sub expired
        if (trainer.subscriptionStatus === 'active' && trainer.subscriptionExpiresAt) {
            if (new Date() > trainer.subscriptionExpiresAt) {
                await prisma.trainerProfile.update({
                    where: { userId },
                    data: { subscriptionStatus: 'expired' },
                });
                return { status: 'expired', needsPayment: true };
            }

            const daysRemaining = Math.ceil(
                (trainer.subscriptionExpiresAt.getTime() - Date.now()) / (1000 * 60 * 60 * 24)
            );
            return { status: 'active', daysRemaining };
        }

        return { status: trainer.subscriptionStatus };
    }
}

export const paymentService = new PaymentService();
