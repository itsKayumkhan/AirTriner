import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();
async function main() {
    console.log("Checking booking 8f85b8b1-07ff-48e2-8c24-8303edcfc3c1");
    const booking = await prisma.booking.findUnique({
        where: { id: '8f85b8b1-07ff-48e2-8c24-8303edcfc3c1' }
    });
    console.log("Found booking:", booking);
    console.log("Trainer ID:", booking?.trainerId);
    console.log("Athlete ID:", booking?.athleteId);
    console.log("Checking user 2a9ae209-2ebe-4835-97e5-f39ea81858b7");
    const user = await prisma.user.findUnique({
        where: { id: '2a9ae209-2ebe-4835-97e5-f39ea81858b7' }
    });
    console.log("Found user:", user?.id, user?.email, user?.role);
}
main().catch(console.error).finally(() => prisma.$disconnect());
