// ============================================
// AirTrainr API - User Service
// ============================================

import { PrismaClient } from '@prisma/client';
import { NotFoundError, BadRequestError, ForbiddenError } from '../../common/errors';
import { logger } from '../../common/logger';
import { MAX_SUB_ACCOUNTS } from '@airtrainr/shared';

const prisma = new PrismaClient();

export class UserService {
    /**
     * Update user profile
     */
    async updateProfile(userId: string, data: any) {
        const user = await prisma.user.findUnique({ where: { id: userId } });
        if (!user) throw new NotFoundError('User not found');

        const updated = await prisma.user.update({
            where: { id: userId },
            data: {
                firstName: data.firstName,
                lastName: data.lastName,
                phone: data.phone,
                sex: data.sex,
                avatarUrl: data.avatarUrl,
            },
        });

        const { passwordHash, ...safeUser } = updated;
        return safeUser;
    }

    /**
     * Update athlete profile
     */
    async updateAthleteProfile(userId: string, data: any) {
        const profile = await prisma.athleteProfile.findUnique({
            where: { userId },
        });
        if (!profile) throw new NotFoundError('Athlete profile not found');

        return prisma.athleteProfile.update({
            where: { userId },
            data: {
                skillLevel: data.skillLevel,
                sports: data.sports,
                addressLine1: data.addressLine1,
                addressLine2: data.addressLine2,
                city: data.city,
                state: data.state,
                zipCode: data.zipCode,
                country: data.country,
                latitude: data.latitude,
                longitude: data.longitude,
                travelRadiusMiles: data.travelRadiusMiles,
            },
        });
    }

    /**
     * Update trainer profile
     */
    async updateTrainerProfile(userId: string, data: any) {
        const profile = await prisma.trainerProfile.findUnique({
            where: { userId },
        });
        if (!profile) throw new NotFoundError('Trainer profile not found');

        return prisma.trainerProfile.update({
            where: { userId },
            data: {
                bio: data.bio,
                headline: data.headline,
                yearsExperience: data.yearsExperience,
                hourlyRate: data.hourlyRate,
                sports: data.sports,
                latitude: data.latitude,
                longitude: data.longitude,
                addressLine1: data.addressLine1,
                city: data.city,
                state: data.state,
                zipCode: data.zipCode,
                country: data.country,
                travelRadiusMiles: data.travelRadiusMiles,
            },
        });
    }

    /**
     * Create sub-account (max 6)
     */
    async createSubAccount(parentUserId: string, data: any) {
        const count = await prisma.subAccount.count({
            where: { parentUserId },
        });

        if (count >= MAX_SUB_ACCOUNTS) {
            throw new BadRequestError(`Maximum sub-accounts reached (${MAX_SUB_ACCOUNTS})`);
        }

        const parent = await prisma.user.findUnique({
            where: { id: parentUserId },
            include: { ageVerification: true },
        });

        if (!parent) throw new NotFoundError('Parent user not found');

        const subAccount = await prisma.subAccount.create({
            data: {
                parentUserId,
                profileData: {
                    ...data,
                    ageVerified: parent.ageVerification?.status === 'verified',
                    parentVerificationDate: parent.ageVerification?.verifiedAt,
                },
            },
        });

        logger.info(`Sub-account created: ${subAccount.id} under parent: ${parentUserId}`);
        return subAccount;
    }

    /**
     * Get sub-accounts for user
     */
    async getSubAccounts(parentUserId: string) {
        return prisma.subAccount.findMany({
            where: { parentUserId },
        });
    }

    /**
     * Delete sub-account
     */
    async deleteSubAccount(parentUserId: string, subAccountId: string) {
        const subAccount = await prisma.subAccount.findUnique({
            where: { id: subAccountId },
        });

        if (!subAccount || subAccount.parentUserId !== parentUserId) {
            throw new ForbiddenError('You cannot delete this sub-account');
        }

        await prisma.subAccount.delete({ where: { id: subAccountId } });
        logger.info(`Sub-account deleted: ${subAccountId}`);
    }

    /**
     * Get trainer public profile
     */
    async getTrainerPublicProfile(trainerId: string) {
        const trainer = await prisma.trainerProfile.findUnique({
            where: { id: trainerId },
            include: {
                user: {
                    select: {
                        firstName: true,
                        lastName: true,
                        avatarUrl: true,
                    },
                },
                media: {
                    orderBy: { sortOrder: 'asc' },
                },
                availabilitySlots: {
                    where: { isBlocked: false },
                },
            },
        });

        if (!trainer) throw new NotFoundError('Trainer not found');

        // Get review stats
        const reviews = await prisma.review.aggregate({
            where: { revieweeId: trainer.userId },
            _avg: { rating: true },
            _count: { rating: true },
        });

        return {
            ...trainer,
            averageRating: reviews._avg.rating || 0,
            totalReviews: reviews._count.rating,
        };
    }

    /**
     * Set trainer availability slots
     */
    async setAvailability(userId: string, slots: any[]) {
        const profile = await prisma.trainerProfile.findUnique({
            where: { userId },
        });
        if (!profile) throw new NotFoundError('Trainer profile not found');

        // Delete existing recurring slots and replace
        await prisma.availabilitySlot.deleteMany({
            where: { trainerId: profile.id, isRecurring: true },
        });

        const created = await prisma.availabilitySlot.createMany({
            data: slots.map((slot) => ({
                trainerId: profile.id,
                dayOfWeek: slot.dayOfWeek,
                startTime: slot.startTime,
                endTime: slot.endTime,
                isRecurring: true,
                timezone: slot.timezone || 'America/New_York',
            })),
        });

        return created;
    }

    /**
     * Soft delete user account
     */
    async deleteAccount(userId: string) {
        await prisma.user.update({
            where: { id: userId },
            data: { deletedAt: new Date() },
        });
        logger.info(`User account soft-deleted: ${userId}`);
    }
}

export const userService = new UserService();
