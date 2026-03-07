// ============================================
// AirTrainr API - Reminder CRON Job
// ============================================
//
// Runs every 15 minutes.  For each confirmed booking that is
// ~24 h or ~1 h away it creates an in-app notification AND
// dispatches a reminder email.
// ============================================

import cron from 'node-cron';
import { PrismaClient } from '@prisma/client';
import { NotificationType } from '@airtrainr/shared';
import { emailService } from '../services/email.service';
import { logger } from '../common/logger';

const prisma = new PrismaClient();

// Window size in minutes — bookings whose scheduledAt falls
// within [target - WINDOW, target + WINDOW] are considered a match.
const WINDOW_MINUTES = 8;

/**
 * Find bookings that are approximately `hoursAhead` hours in the future
 * and haven't already received a reminder of the given type.
 */
async function findUpcomingBookings(hoursAhead: number, notificationType: string) {
    const now = new Date();
    const targetTime = new Date(now.getTime() + hoursAhead * 60 * 60 * 1000);
    const windowMs = WINDOW_MINUTES * 60 * 1000;

    const from = new Date(targetTime.getTime() - windowMs);
    const to = new Date(targetTime.getTime() + windowMs);

    // Get confirmed bookings in the time window
    const bookings = await prisma.booking.findMany({
        where: {
            status: 'confirmed',
            scheduledAt: { gte: from, lte: to },
        },
        include: {
            athlete: { select: { id: true, firstName: true, lastName: true, email: true } },
            trainer: { select: { id: true, firstName: true, lastName: true, email: true } },
        },
    });

    // Filter out bookings that already have a notification of this type
    const filtered = [];
    for (const booking of bookings) {
        const existing = await prisma.notification.findFirst({
            where: {
                type: notificationType,
                data: { path: ['bookingId'], equals: booking.id },
            },
        });
        if (!existing) filtered.push(booking);
    }

    return filtered;
}

/**
 * Create in-app notification for a user about an upcoming booking
 */
async function createReminderNotification(
    userId: string,
    booking: any,
    type: string,
    timeLabel: string
) {
    const sportName = booking.sport.replace(/_/g, ' ').replace(/\b\w/g, (c: string) => c.toUpperCase());

    await prisma.notification.create({
        data: {
            userId,
            type,
            title: `Upcoming Session in ${timeLabel}`,
            body: `Your ${sportName} training session is coming up in ${timeLabel}.`,
            data: { bookingId: booking.id },
        },
    });
}

/**
 * Process reminders for a specific time-ahead window
 */
async function processReminders(hoursAhead: number) {
    const is24h = hoursAhead === 24;
    const notifType = is24h
        ? NotificationType.UPCOMING_SESSION_REMINDER_24H
        : NotificationType.UPCOMING_SESSION_REMINDER_1H;
    const timeLabel = is24h ? '24 hours' : '1 hour';
    const reminderType: '24h' | '1h' = is24h ? '24h' : '1h';

    const bookings = await findUpcomingBookings(hoursAhead, notifType);

    for (const booking of bookings) {
        const athleteName = `${booking.athlete.firstName} ${booking.athlete.lastName}`;
        const trainerName = `${booking.trainer.firstName} ${booking.trainer.lastName}`;

        // In-app notifications for both parties
        await createReminderNotification(booking.athlete.id, booking, notifType, timeLabel);
        await createReminderNotification(booking.trainer.id, booking, notifType, timeLabel);

        // Email reminders for both parties
        const baseData = {
            athleteName,
            trainerName,
            sport: booking.sport,
            scheduledAt: booking.scheduledAt,
            durationMinutes: booking.durationMinutes,
            address: booking.address,
            reminderType,
        };

        await emailService.sendReminderEmail({ ...baseData, to: booking.athlete.email });
        await emailService.sendReminderEmail({ ...baseData, to: booking.trainer.email });

        logger.info(
            `${timeLabel} reminder sent for booking ${booking.id} ` +
            `(Athlete: ${athleteName}, Trainer: ${trainerName})`
        );
    }

    return bookings.length;
}

/**
 * Start the reminder cron job
 *
 * Schedule: every 15 minutes (at :00, :15, :30, :45)
 */
export function startReminderCron() {
    const task = cron.schedule('*/15 * * * *', async () => {
        logger.info('⏰ Running reminder check...');

        try {
            const [count24h, count1h] = await Promise.all([
                processReminders(24),
                processReminders(1),
            ]);

            if (count24h > 0 || count1h > 0) {
                logger.info(`Reminders dispatched — 24h: ${count24h}, 1h: ${count1h}`);
            }
        } catch (error) {
            logger.error('Reminder cron job failed', { error });
        }
    });

    logger.info('✅ Reminder cron job scheduled (every 15 minutes)');
    return task;
}
