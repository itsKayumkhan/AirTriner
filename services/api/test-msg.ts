import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
    try {
        const booking = await prisma.booking.findFirst();
        if(!booking) {
            console.log("No booking found to test");
            return;
        }

        console.log("Found booking:", booking);
        
        const bookingId = booking.id;
        const senderId = booking.athleteId || (booking as any).athlete_id;
        const receiverId = booking.trainerId || (booking as any).trainer_id;

        console.log("Attempting to create message with snake_case keys...");
        try {
            await (prisma as any).message.create({
                data: {
                    booking_id: bookingId,
                    sender_id: senderId,
                    receiver_id: receiverId,
                    content: 'test message snake_case'
                }
            });
            console.log("snake_case Success!");
        } catch (e) {
            console.error("snake_case Failed:", e);
        }

        console.log("\nAttempting to create message with camelCase keys...");
        try {
            await (prisma as any).message.create({
                data: {
                    bookingId: bookingId,
                    senderId: senderId,
                    receiverId: receiverId,
                    content: 'test message camelCase'
                }
            });
            console.log("camelCase Success!");
        } catch (e) {
            console.error("camelCase Failed:", e);
        }
    } catch (e) {
        console.error("Fatal error:", e);
    } finally {
        await prisma.$disconnect();
    }
}

main();
