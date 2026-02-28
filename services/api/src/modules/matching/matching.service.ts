// ============================================
// AirTrainr API - Matching / Discovery Service
// ============================================

import { PrismaClient } from '@prisma/client';
import { logger } from '../../common/logger';
import { DEFAULT_TRAVEL_RADIUS_MILES, MAX_SEARCH_RADIUS_MILES } from '@airtrainr/shared';

const prisma = new PrismaClient();

export class MatchingService {
    /**
     * Find trainers near an athlete based on filters
     */
    async findTrainers(filters: {
        sports?: string[];
        latitude?: number;
        longitude?: number;
        radius?: number;
        minRate?: number;
        maxRate?: number;
        verifiedOnly?: boolean;
        page?: number;
        limit?: number;
        sortBy?: string;
    }) {
        const page = filters.page || 1;
        const limit = Math.min(filters.limit || 20, 50);
        const radius = Math.min(filters.radius || DEFAULT_TRAVEL_RADIUS_MILES, MAX_SEARCH_RADIUS_MILES);

        const where: any = {
            subscriptionStatus: { in: ['trial', 'active'] },
            verificationStatus: { not: 'suspended' },
            user: { deletedAt: null },
        };

        // Filter by sports
        if (filters.sports && filters.sports.length > 0) {
            where.sports = { hasSome: filters.sports };
        }

        // Filter by rate range
        if (filters.minRate !== undefined) {
            where.hourlyRate = { ...(where.hourlyRate || {}), gte: filters.minRate };
        }
        if (filters.maxRate !== undefined) {
            where.hourlyRate = { ...(where.hourlyRate || {}), lte: filters.maxRate };
        }

        // Filter verified only
        if (filters.verifiedOnly) {
            where.isVerified = true;
        }

        // Determine sort order
        let orderBy: any = { isVerified: 'desc' };
        switch (filters.sortBy) {
            case 'rate_low':
                orderBy = { hourlyRate: 'asc' };
                break;
            case 'rate_high':
                orderBy = { hourlyRate: 'desc' };
                break;
            case 'experience':
                orderBy = { yearsExperience: 'desc' };
                break;
            case 'rating':
                orderBy = { completionRate: 'desc' };
                break;
            default:
                orderBy = [{ isVerified: 'desc' }, { completionRate: 'desc' }];
        }

        const [trainers, total] = await Promise.all([
            prisma.trainerProfile.findMany({
                where,
                include: {
                    user: {
                        select: {
                            firstName: true,
                            lastName: true,
                            avatarUrl: true,
                        },
                    },
                    media: {
                        where: { isPrimary: true },
                        take: 1,
                    },
                },
                orderBy,
                skip: (page - 1) * limit,
                take: limit,
            }),
            prisma.trainerProfile.count({ where }),
        ]);

        // Calculate distance if coordinates provided
        const results = trainers.map((trainer) => {
            let distanceMiles: number | null = null;
            if (
                filters.latitude &&
                filters.longitude &&
                trainer.latitude &&
                trainer.longitude
            ) {
                distanceMiles = this.calculateDistance(
                    filters.latitude,
                    filters.longitude,
                    trainer.latitude,
                    trainer.longitude
                );
            }

            return {
                ...trainer,
                distanceMiles,
                hourlyRate: Number(trainer.hourlyRate),
                completionRate: Number(trainer.completionRate),
                reliabilityScore: Number(trainer.reliabilityScore),
            };
        });

        // Filter by distance if coordinates provided
        const filtered = filters.latitude && filters.longitude
            ? results.filter((t) => t.distanceMiles === null || t.distanceMiles <= radius)
            : results;

        // Sort by distance if coordinates provided
        if (filters.latitude && filters.longitude) {
            filtered.sort((a, b) => {
                if (a.distanceMiles === null) return 1;
                if (b.distanceMiles === null) return -1;
                return a.distanceMiles - b.distanceMiles;
            });
        }

        return {
            trainers: filtered,
            meta: {
                page,
                limit,
                total,
                totalPages: Math.ceil(total / limit),
            },
        };
    }

    /**
     * Get trainer availability for a specific date
     */
    async getTrainerAvailability(trainerId: string, date: string) {
        const profile = await prisma.trainerProfile.findUnique({
            where: { id: trainerId },
        });

        if (!profile) return [];

        const dayOfWeek = new Date(date).getDay();

        // Get recurring slots for this day
        const recurringSlots = await prisma.availabilitySlot.findMany({
            where: {
                trainerId,
                isRecurring: true,
                dayOfWeek,
                isBlocked: false,
            },
        });

        // Get specific date slots
        const specificSlots = await prisma.availabilitySlot.findMany({
            where: {
                trainerId,
                isRecurring: false,
                specificDate: new Date(date),
                isBlocked: false,
            },
        });

        // Get existing bookings for this date
        const startOfDay = new Date(date);
        startOfDay.setHours(0, 0, 0, 0);
        const endOfDay = new Date(date);
        endOfDay.setHours(23, 59, 59, 999);

        const existingBookings = await prisma.booking.findMany({
            where: {
                trainerId: profile.userId,
                status: { in: ['pending', 'confirmed'] },
                scheduledAt: {
                    gte: startOfDay,
                    lte: endOfDay,
                },
            },
        });

        // Combine and filter out booked slots
        const allSlots = [...recurringSlots, ...specificSlots];
        return allSlots.map((slot) => ({
            ...slot,
            isBooked: existingBookings.some((booking) => {
                const bookingTime = new Date(booking.scheduledAt).toTimeString().slice(0, 5);
                return bookingTime >= slot.startTime && bookingTime < slot.endTime;
            }),
        }));
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

export const matchingService = new MatchingService();
