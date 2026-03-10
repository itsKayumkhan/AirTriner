// ============================================
// AirTrainr API - Calendar Service
// ============================================

import { createEvent, EventAttributes, DateArray } from 'ics';
import { logger } from '../../common/logger';

interface BookingCalendarData {
    id: string;
    sport: string;
    scheduledAt: Date;
    durationMinutes: number;
    address?: string | null;
    latitude?: number | null;
    longitude?: number | null;
    athleteName: string;
    trainerName: string;
    athleteEmail?: string;
    trainerEmail?: string;
}

export class CalendarService {
    /**
     * Generate an .ics file buffer from a booking
     */
    async generateICS(booking: BookingCalendarData): Promise<string> {
        const start = booking.scheduledAt;
        const startArray: DateArray = [
            start.getUTCFullYear(),
            start.getUTCMonth() + 1,
            start.getUTCDate(),
            start.getUTCHours(),
            start.getUTCMinutes(),
        ];

        const event: EventAttributes = {
            start: startArray,
            duration: {
                hours: Math.floor(booking.durationMinutes / 60),
                minutes: booking.durationMinutes % 60,
            },
            title: `Training Session: ${this.capitalize(booking.sport)}`,
            description: `${this.capitalize(booking.sport)} training session\nAthlete: ${booking.athleteName}\nTrainer: ${booking.trainerName}`,
            location: booking.address || undefined,
            geo: booking.latitude && booking.longitude
                ? { lat: booking.latitude, lon: booking.longitude }
                : undefined,
            organizer: booking.trainerEmail
                ? { name: booking.trainerName, email: booking.trainerEmail }
                : undefined,
            attendees: [
                ...(booking.athleteEmail
                    ? [{ name: booking.athleteName, email: booking.athleteEmail, rsvp: true, partstat: 'ACCEPTED' as const, role: 'REQ-PARTICIPANT' as const }]
                    : []),
                ...(booking.trainerEmail
                    ? [{ name: booking.trainerName, email: booking.trainerEmail, rsvp: true, partstat: 'ACCEPTED' as const, role: 'REQ-PARTICIPANT' as const }]
                    : []),
            ],
            status: 'CONFIRMED',
            uid: `booking-${booking.id}@airtrainr.com`,
            productId: 'AirTrainr/BookingCalendar',
            calName: 'AirTrainr Training Sessions',
            alarms: [
                { action: 'display', description: 'Reminder: Training session in 1 hour', trigger: { hours: 1, before: true } },
                { action: 'display', description: 'Reminder: Training session in 24 hours', trigger: { hours: 24, before: true } },
            ],
        };

        return new Promise((resolve, reject) => {
            createEvent(event, (error, value) => {
                if (error) {
                    logger.error('Failed to generate ICS file', { error, bookingId: booking.id });
                    reject(new Error('Failed to generate calendar file'));
                } else {
                    resolve(value);
                }
            });
        });
    }

    /**
     * Generate a Google Calendar "Add Event" URL from a booking
     */
    generateGoogleCalendarUrl(booking: BookingCalendarData): string {
        const start = booking.scheduledAt;
        const end = new Date(start.getTime() + booking.durationMinutes * 60 * 1000);

        const formatDate = (d: Date) =>
            d.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '');

        const params = new URLSearchParams({
            action: 'TEMPLATE',
            text: `Training Session: ${this.capitalize(booking.sport)}`,
            dates: `${formatDate(start)}/${formatDate(end)}`,
            details: `${this.capitalize(booking.sport)} training session\nAthlete: ${booking.athleteName}\nTrainer: ${booking.trainerName}\n\nBooked via AirTrainr`,
        });

        if (booking.address) {
            params.set('location', booking.address);
        }

        return `https://calendar.google.com/calendar/render?${params.toString()}`;
    }

    /**
     * Map a Prisma booking (with included relations) to CalendarData
     */
    mapBookingToCalendarData(booking: any): BookingCalendarData {
        return {
            id: booking.id,
            sport: booking.sport,
            scheduledAt: new Date(booking.scheduledAt),
            durationMinutes: booking.durationMinutes,
            address: booking.address,
            latitude: booking.latitude,
            longitude: booking.longitude,
            athleteName: `${booking.athlete.firstName} ${booking.athlete.lastName}`,
            trainerName: `${booking.trainer.firstName} ${booking.trainer.lastName}`,
            athleteEmail: booking.athlete.email,
            trainerEmail: booking.trainer.email,
        };
    }

    private capitalize(str: string): string {
        return str.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
    }
}

export const calendarService = new CalendarService();
