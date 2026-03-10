// ============================================
// AirTrainr API - Availability Service
// ============================================

import { PrismaClient } from '@prisma/client';
import { NotFoundError, BadRequestError } from '../../common/errors';
import { logger } from '../../common/logger';

const prisma = new PrismaClient();

export class AvailabilityService {
    /**
     * Get availability for a trainer on a specific date
     */
    async getTrainerAvailability(trainerId: string, date: Date) {
        const dayOfWeek = date.getDay(); // 0-6 (Sun-Sat)
        const dateString = date.toISOString().split('T')[0];

        const slots = await prisma.availabilitySlot.findMany({
            where: {
                trainerId,
                OR: [
                    { isRecurring: true, dayOfWeek },
                    { isRecurring: false, specificDate: new Date(dateString) }
                ]
            },
            orderBy: { startTime: 'asc' }
        });

        return slots;
    }

    /**
     * Check if a time slot is available for a trainer
     */
    async isTimeSlotAvailable(trainerId: string, start: Date, durationMinutes: number) {
        const dayOfWeek = start.getDay();
        const dateString = start.toISOString().split('T')[0];
        
        // Convert start time to HH:mm for comparison
        const formatTime = (d: Date) => {
            return d.getHours().toString().padStart(2, '0') + ':' + 
                   d.getMinutes().toString().padStart(2, '0');
        };

        const startTimeStr = formatTime(start);
        const end = new Date(start.getTime() + durationMinutes * 60 * 1000);
        const endTimeStr = formatTime(end);

        // 1. Check if the trainer has defined availability that covers this slot
        const availableSlots = await prisma.availabilitySlot.findMany({
            where: {
                trainerId,
                isBlocked: false,
                OR: [
                    { isRecurring: true, dayOfWeek },
                    { isRecurring: false, specificDate: new Date(dateString) }
                ]
            }
        });

        // The requested slot must be entirely within ONE available slot
        // (Simplified logic: in a real app, it could span multiple contiguous slots, but usually it's one)
        const isWithinAvailability = availableSlots.some((slot: any) => {
            return slot.startTime <= startTimeStr && slot.endTime >= endTimeStr;
        });

        if (!isWithinAvailability) {
            return false;
        }

        // 2. Check if there's any "Blocked" slot overlapping
        const blockedSlots = await prisma.availabilitySlot.findFirst({
            where: {
                trainerId,
                isBlocked: true,
                OR: [
                    { isRecurring: true, dayOfWeek },
                    { isRecurring: false, specificDate: new Date(dateString) }
                ],
                AND: [
                    { startTime: { lt: endTimeStr } },
                    { endTime: { gt: startTimeStr } }
                ]
            }
        });

        if (blockedSlots) {
            return false;
        }

        return true;
    }

    /**
     * Create a new availability slot
     */
    async createSlot(trainerId: string, data: any) {
        // Validation: startTime < endTime
        if (data.startTime >= data.endTime) {
            throw new BadRequestError('Start time must be before end time');
        }

        const slot = await prisma.availabilitySlot.create({
            data: {
                trainerId,
                dayOfWeek: data.dayOfWeek,
                startTime: data.startTime,
                endTime: data.endTime,
                isRecurring: data.isRecurring ?? true,
                specificDate: data.specificDate ? new Date(data.specificDate) : null,
                isBlocked: data.isBlocked ?? false,
                timezone: data.timezone || 'America/New_York'
            }
        });

        logger.info(`Availability slot created for trainer ${trainerId}: ${slot.id}`);
        return slot;
    }

    /**
     * Delete an availability slot
     */
    async deleteSlot(slotId: string, trainerId: string) {
        const slot = await prisma.availabilitySlot.findUnique({
            where: { id: slotId }
        });

        if (!slot) throw new NotFoundError('Availability slot not found');
        if (slot.trainerId !== trainerId) throw new BadRequestError('Permission denied');

        await prisma.availabilitySlot.delete({
            where: { id: slotId }
        });

        logger.info(`Availability slot deleted: ${slotId}`);
    }

    /**
     * Update an availability slot
     */
    async updateSlot(slotId: string, trainerId: string, data: any) {
        const slot = await prisma.availabilitySlot.findUnique({
            where: { id: slotId }
        });

        if (!slot) throw new NotFoundError('Availability slot not found');
        if (slot.trainerId !== trainerId) throw new BadRequestError('Permission denied');

        const updated = await prisma.availabilitySlot.update({
            where: { id: slotId },
            data: {
                startTime: data.startTime,
                endTime: data.endTime,
                dayOfWeek: data.dayOfWeek,
                isRecurring: data.isRecurring,
                specificDate: data.specificDate ? new Date(data.specificDate) : undefined,
                isBlocked: data.isBlocked,
                timezone: data.timezone
            }
        });

        return updated;
    }
}

export const availabilityService = new AvailabilityService();
