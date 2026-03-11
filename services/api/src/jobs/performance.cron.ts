// ============================================
// AirTrainr API - Performance Monitoring Job
// ============================================
//
// Runs daily at midnight. Evaluates trainer performance
// metrics and automatically revokes "Verified" status
// if benchmarks are not met.
// ============================================

import cron from 'node-cron';
import { PrismaClient } from '@prisma/client';
import { NotificationType } from '@airtrainr/shared';
import { logger } from '../common/logger';

const prisma = new PrismaClient();

// Performance Thresholds
const MIN_REVIEWS_FOR_RATING_CHECK = 5;
const MIN_RATING_THRESHOLD = 4.0;
const MIN_BOOKINGS_FOR_COMPLETION_CHECK = 5;
const COMPLETION_RATE_THRESHOLD = 0.75;
const RELIABILITY_SCORE_THRESHOLD = 80;

/**
 * Calculate performance metrics and update trainer profiles
 */
export async function evaluateTrainerPerformance() {
    logger.info('📊 Starting trainer performance evaluation...');

    const trainers = await prisma.trainerProfile.findMany({
        where: { isVerified: true },
        include: {
            user: {
                select: {
                    id: true,
                    firstName: true,
                    lastName: true,
                }
            }
        }
    });

    let revokedCount = 0;

    for (const trainer of trainers) {
        try {
            // 1. Fetch recent bookings (last 30 days for score-based metrics)
            const thirtyDaysAgo = new Date();
            thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

            const allBookings = await prisma.booking.findMany({
                where: { trainerId: trainer.userId },
                select: { status: true, scheduledAt: true }
            });

            if (allBookings.length === 0) continue;

            // 2. Calculate Completion Rate
            // completion_rate = completed / (completed + rejected + cancelled + no_show)
            const relevantForCompletion = allBookings.filter(b => 
                ['completed', 'rejected', 'cancelled', 'no_show'].includes(b.status)
            );
            
            const completedCount = relevantForCompletion.filter(b => b.status === 'completed').length;
            const completionRate = relevantForCompletion.length >= MIN_BOOKINGS_FOR_COMPLETION_CHECK 
                ? (completedCount / relevantForCompletion.length) : 1.0;

            // 3. Calculate Reliability Score
            // Start with 100, deduct for no-shows and cancellations in last 30 days
            const recentBookings = allBookings.filter(b => b.scheduledAt >= thirtyDaysAgo);
            const noShowCount = recentBookings.filter(b => b.status === 'no_show').length;
            const cancelledCount = recentBookings.filter(b => b.status === 'cancelled').length; // Assuming trainer-side for now or general penalty

            let reliabilityScore = 100;
            reliabilityScore -= (noShowCount * 10);
            reliabilityScore -= (cancelledCount * 5);
            reliabilityScore = Math.max(0, reliabilityScore);

            // 4. Check Average Rating (fetched from trainer profile which is updated by trigger)
            // @ts-ignore - access fields directly as they exist in DB but prisma client needs regeneration
            const avgRating = Number((trainer as any).averageRating || 0);
            // @ts-ignore
            const totalReviews = (trainer as any).totalReviews || 0;

            // 5. Evaluation Logic
            let shouldRevoke = false;
            let reason = '';

            if (totalReviews >= MIN_REVIEWS_FOR_RATING_CHECK && avgRating < MIN_RATING_THRESHOLD) {
                shouldRevoke = true;
                reason = `Average rating (${avgRating}) fell below ${MIN_RATING_THRESHOLD}`;
            } else if (relevantForCompletion.length >= MIN_BOOKINGS_FOR_COMPLETION_CHECK && completionRate < COMPLETION_RATE_THRESHOLD) {
                shouldRevoke = true;
                reason = `Completion rate (${(completionRate * 100).toFixed(1)}%) fell below ${(COMPLETION_RATE_THRESHOLD * 100).toFixed(0)}%`;
            } else if (reliabilityScore < RELIABILITY_SCORE_THRESHOLD) {
                shouldRevoke = true;
                reason = `Reliability score (${reliabilityScore}) fell below ${RELIABILITY_SCORE_THRESHOLD}`;
            }

            // 6. Apply Revocation
            if (shouldRevoke) {
                await prisma.trainerProfile.update({
                    where: { id: trainer.id },
                    data: {
                        isVerified: false,
                        verificationStatus: 'suspended',
                        completionRate: completionRate * 100,
                        reliabilityScore: reliabilityScore
                    }
                });

                // Notify Trainer
                await prisma.notification.create({
                    data: {
                        userId: trainer.userId,
                        type: NotificationType.VERIFICATION_REVOKED,
                        title: 'Verification Badge Revoked',
                        body: `Your verified badge has been suspended due to: ${reason}. Please contact support to appeal.`,
                    }
                });

                logger.warn(`🚫 Revoked badge for trainer ${trainer.user.firstName} ${trainer.user.lastName} (${trainer.userId}): ${reason}`);
                revokedCount++;
            } else {
                // Just update metrics even if not revoked
                await prisma.trainerProfile.update({
                    where: { id: trainer.id },
                    data: {
                        completionRate: completionRate * 100,
                        reliabilityScore: reliabilityScore
                    }
                });
            }

        } catch (error) {
            logger.error(`Error evaluating trainer ${trainer.userId}`, { error });
        }
    }

    logger.info(`✅ Performance evaluation complete. ${revokedCount} badges revoked.`);
}

/**
 * Start the performance monitoring cron job
 * Schedule: Daily at 00:00
 */
export function startPerformanceCron() {
    const task = cron.schedule('0 0 * * *', async () => {
        try {
            await evaluateTrainerPerformance();
        } catch (error) {
            logger.error('Performance cron job failed', { error });
        }
    });

    logger.info('✅ Performance monitoring cron job scheduled (Daily at midnight)');
    return task;
}
