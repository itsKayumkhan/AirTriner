import { prisma } from '../../common/prisma';
import { socketService } from '../../services/socket.service';
import { BadRequestError, UnauthorizedError } from '../../common/errors';

export class MessageService {
    async sendMessage(bookingId: string, senderId: string, content: string) {
        // Verify booking exists
        const booking: any = await prisma.booking.findUnique({
            where: { id: bookingId }
        });

        if (!booking) throw new BadRequestError('Booking not found');
        const isAthlete = booking.athleteId === senderId || booking.athlete_id === senderId;
        const isTrainer = booking.trainerId === senderId || booking.trainer_id === senderId;
        
        if (!isAthlete && !isTrainer) {
            throw new UnauthorizedError('Not authorized');
        }

        // Using any to bypass local Prisma client mismatch
        const message = await (prisma as any).message.create({
            data: {
                bookingId: bookingId,
                senderId: senderId,
                content
            },
            include: {
                sender: {
                    select: {
                        id: true,
                        firstName: true,
                        lastName: true,
                        avatarUrl: true
                    }
                }
            }
        });

        socketService.emitToBooking(bookingId, 'new_message', message as any);
        return message;
    }

    async getBookingMessages(bookingId: string, userId: string) {
        const booking: any = await prisma.booking.findUnique({
            where: { id: bookingId }
        });

        if (!booking) throw new BadRequestError('Booking not found');
        const isAthlete = booking.athleteId === userId || booking.athlete_id === userId;
        const isTrainer = booking.trainerId === userId || booking.trainer_id === userId;

        if (!isAthlete && !isTrainer) {
            throw new UnauthorizedError('Not authorized');
        }

        return (prisma as any).message.findMany({
            where: { bookingId: bookingId },
            orderBy: { createdAt: 'asc' },
            include: {
                sender: {
                    select: {
                        id: true,
                        firstName: true,
                        lastName: true,
                        avatarUrl: true
                    }
                }
            }
        });
    }

    async markAsRead(bookingId: string, userId: string) {
        try {
            // Use Prisma's template literal executeRaw for safe parameter handling
            // We attempt to update both 'read' (boolean) and 'read_at' (timestamp) to be extremely safe
            // as we've seen discrepancies between schema and database.
            const result = await (prisma as any).$executeRaw`
                UPDATE messages 
                SET read_at = NOW(), read = true 
                WHERE booking_id = ${bookingId} 
                AND sender_id != ${userId} 
                AND (read_at IS NULL OR read = false)
            `;
            
            return result;
        } catch (err: any) {
            // Fallback: Try just read_at if the above failed due to missing 'read' column
            try {
                const result = await (prisma as any).$executeRaw`
                    UPDATE messages 
                    SET read_at = NOW()
                    WHERE booking_id = ${bookingId} 
                    AND sender_id != ${userId} 
                    AND read_at IS NULL
                `;
                return result;
            } catch (err2) {
                return 0;
            }
        }
    }
}

export const messageService = new MessageService();
