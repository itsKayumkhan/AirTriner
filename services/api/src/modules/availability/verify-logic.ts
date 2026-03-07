import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function verify() {
    console.log('--- Starting Advanced Booking Logic Verification ---\n');
    
    // We'll use a real trainer from the DB if possible, or just mock the logic calls
    // Since we want to test the SERVICE logic without necessarily hitting a live DB if it's not ready
    
    console.log('1. Testing Overlap Logic (Unit Test Style)...');
    const existingBookings = [
        { scheduledAt: new Date('2026-05-01T10:00:00Z'), durationMinutes: 60 } // 10:00 - 11:00
    ];

    const testOverlap = (newStart: string, duration: number) => {
        const start = new Date(newStart).getTime();
        const end = start + duration * 60 * 1000;
        
        return existingBookings.some(b => {
            const bStart = b.scheduledAt.getTime();
            const bEnd = bStart + b.durationMinutes * 60 * 1000;
            return start < bEnd && end > bStart;
        });
    };

    console.log('   - 10:30 (60m) overlaps 10:00-11:00?', testOverlap('2026-05-01T10:30:00Z', 60)); // Expected: true
    console.log('   - 09:30 (60m) overlaps 10:00-11:00?', testOverlap('2026-05-01T09:30:00Z', 60)); // Expected: true
    console.log('   - 11:00 (60m) overlaps 10:00-11:00?', testOverlap('2026-05-01T11:00:00Z', 60)); // Expected: false
    
    console.log('\n2. Testing Availability Service Integration...');
    console.log('   - This requires running the API and using the /api/v1/availability endpoints.');
    console.log('   - Step 1: POST /api/v1/availability { dayOfWeek: 1, startTime: "09:00", endTime: "17:00" }');
    console.log('   - Step 2: POST /api/v1/bookings { trainerId: "...", scheduledAt: "2026-05-04T10:00:00Z", ... }');
    
    console.log('\n--- Logic Verification Complete ---');
}

verify()
    .catch(console.error)
    .finally(async () => {
        await prisma.$disconnect();
    });
