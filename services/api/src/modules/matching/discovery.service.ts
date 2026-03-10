// ============================================
// AirTrainr API - Matching Discovery Service
// ============================================

import { PrismaClient } from '@prisma/client';
import { logger } from '../../common/logger';
import { NotificationType } from '@airtrainr/shared';

const prisma = new PrismaClient();

export class MatchingDiscoveryService {
    /**
     * Notify trainers near a new/updated athlete profile
     */
    async notifyTrainersOfNewAthlete(userId: string) {
        try {
            // 1. Fetch the athlete's profile
            const athlete = await prisma.user.findUnique({
                where: { id: userId },
                include: { athleteProfile: true },
            });

            if (!athlete || !athlete.athleteProfile) {
                logger.warn(`Discovery: Athlete profile not found for user ${userId}`);
                return;
            }

            const { latitude, longitude, sports } = athlete.athleteProfile;

            if (!latitude || !longitude || !sports || sports.length === 0) {
                logger.debug(`Discovery: Athlete ${userId} missing location or sports for matching`);
                return;
            }

            // 2. Find eligible trainers
            // Note: We fetch trainers who have at least one overlapping sport
            // and then filter by distance based on THEIR travel radius.
            const trainers = await prisma.trainerProfile.findMany({
                where: {
                    subscriptionStatus: { in: ['trial', 'active'] },
                    verificationStatus: { not: 'suspended' },
                    sports: { hasSome: sports },
                    user: { deletedAt: null },
                    latitude: { not: null },
                    longitude: { not: null },
                },
                include: {
                    user: {
                        select: {
                            id: true,
                            firstName: true,
                        },
                    },
                },
            });

            logger.info(`Discovery: Found ${trainers.length} potential trainer matches for athlete ${userId}`);

            const notifications = [];

            for (const trainer of trainers) {
                // Calculate distance
                const distance = this.calculateDistance(
                    latitude,
                    longitude,
                    trainer.latitude!,
                    trainer.longitude!
                );

                // Check if athlete is within trainer's travel radius
                if (distance <= trainer.travelRadiusMiles) {
                    notifications.push({
                        userId: trainer.userId,
                        type: NotificationType.NEW_REQUEST_NEARBY,
                        title: 'New Athlete Nearby!',
                        body: `An athlete looking for ${sports[0].replace(/_/g, ' ')} is in your area. Send them an offer!`,
                        data: {
                            athlete_id: userId,
                            distance,
                            sports,
                        },
                    });
                }
            }

            if (notifications.length > 0) {
                await prisma.notification.createMany({
                    data: notifications,
                });
                logger.info(`Discovery: Sent ${notifications.length} nearby notifications for athlete ${userId}`);
            }
        } catch (error) {
            logger.error('Discovery error:', error);
        }
    }

    /**
     * Haversine formula to calculate distance between two points
     */
    private calculateDistance(
        lat1: number,
        lon1: number,
        lat2: number,
        lon2: number
    ): number {
        const R = 3959; // Earth's radius in miles
        const dLat = this.toRad(lat2 - lat1);
        const dLon = this.toRad(lon2 - lon1);
        const a =
            Math.sin(dLat / 2) * Math.sin(dLat / 2) +
            Math.cos(this.toRad(lat1)) *
            Math.cos(this.toRad(lat2)) *
            Math.sin(dLon / 2) *
            Math.sin(dLon / 2);
        const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
        return Math.round(R * c * 10) / 10;
    }

    private toRad(deg: number): number {
        return deg * (Math.PI / 180);
    }
}

export const matchingDiscoveryService = new MatchingDiscoveryService();
