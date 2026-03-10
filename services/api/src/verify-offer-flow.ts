import { PrismaClient } from '@prisma/client';
import { OfferStatus, NotificationType } from '@airtrainr/shared';

const prisma = new PrismaClient();

async function verify() {
    console.log('--- Verifying Offer System ---');
    
    // 1. Get a trainer and an athlete
    const trainer = await prisma.user.findFirst({ where: { role: 'trainer' } });
    const athlete = await prisma.user.findFirst({ where: { role: 'athlete' } });

    if (!trainer || !athlete) {
        console.error('❌ Could not find test users');
        return;
    }

    console.log(`Using Trainer: ${trainer.firstName} (${trainer.id})`);
    console.log(`Using Athlete: ${athlete.firstName} (${athlete.id})`);

    // 2. Create an offer
    const offer = await prisma.trainingOffer.create({
        data: {
            trainerId: trainer.id,
            athleteId: athlete.id,
            status: OfferStatus.PENDING,
            message: 'Test Offer from Antigravity',
            price: 75.00,
            sessionLengthMin: 60,
            sport: 'hockey',
            proposedDates: { scheduledAt: new Date(Date.now() + 86400000).toISOString() }
        }
    });
    console.log(`✅ Offer created: ${offer.id}`);

    // 3. Check notification
    const notification = await prisma.notification.findFirst({
        where: { userId: athlete.id, type: NotificationType.OFFER_RECEIVED },
        orderBy: { createdAt: 'desc' }
    });

    if (notification) {
        console.log(`✅ Notification found: ${notification.title}`);
    } else {
        console.warn('⚠️ Notification not found (yet)');
    }

    // 4. Accept offer
    console.log('Accepting offer...');
    const result = await prisma.$transaction(async (tx) => {
        await tx.trainingOffer.update({ where: { id: offer.id }, data: { status: 'accepted' } });
        return await tx.booking.create({
            data: {
                athleteId: athlete.id,
                trainerId: trainer.id,
                sport: 'hockey',
                scheduledAt: new Date(Date.now() + 86400000),
                durationMinutes: 60,
                status: 'pending',
                price: 75.00,
                platformFee: 2.25,
                totalPaid: 77.25
            }
        });
    });

    console.log(`✅ Booking created: ${result.id}`);
    
    // Cleanup - remove test data
    await prisma.booking.delete({ where: { id: result.id } });
    await prisma.trainingOffer.delete({ where: { id: offer.id } });
    if (notification) await prisma.notification.delete({ where: { id: notification.id } });
    
    console.log('--- Verification Complete ---');
}

verify().catch(console.error).finally(() => prisma.$disconnect());
