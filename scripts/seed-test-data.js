/**
 * Seed script: Inserts test data for Disputes, Payment Transactions, and Subscriptions.
 * 
 * Run this in the browser console while on any admin page (already logged in):
 *   1. Open http://localhost:3000/admin
 *   2. Open DevTools (F12) -> Console tab
 *   3. Paste this entire script and press Enter
 *   4. Wait for "✅ Seed complete!" message
 *   5. Refresh the admin pages to see the data
 */

(async () => {
    const SUPABASE_URL = "https://duaqkmptxsnonvtfdohp.supabase.co";
    const SUPABASE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImR1YXFrbXB0eHNub252dGZkb2hwIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzE1NjUwOTAsImV4cCI6MjA4NzE0MTA5MH0.5glBvL0FsyhWvtasjvmfOQwMOP8LFQf-Jq2e5ji92XE";

    const headers = {
        "apikey": SUPABASE_KEY,
        "Authorization": `Bearer ${SUPABASE_KEY}`,
        "Content-Type": "application/json",
        "Prefer": "return=representation"
    };

    const api = (table) => `${SUPABASE_URL}/rest/v1/${table}`;

    // Step 1: Find existing bookings to attach disputes/payments to
    console.log("🔍 Fetching existing bookings...");
    let res = await fetch(`${api("bookings")}?select=id,athlete_id,trainer_id,price,platform_fee,total_paid,status,sport&limit=5`, { headers });
    const bookings = await res.json();
    console.log(`Found ${bookings.length} bookings.`);

    if (bookings.length === 0) {
        console.log("❌ No bookings found. Creating test bookings first...");

        // Find a trainer and an athlete
        res = await fetch(`${api("users")}?role=eq.trainer&select=id&limit=1`, { headers });
        const trainers = await res.json();
        res = await fetch(`${api("users")}?role=eq.athlete&select=id&limit=1`, { headers });
        const athletes = await res.json();

        if (trainers.length === 0 || athletes.length === 0) {
            console.log("❌ No trainers or athletes in the database. Please add users first.");
            return;
        }

        // Create some test bookings
        const testBookings = [];
        for (let i = 0; i < 4; i++) {
            const price = [120, 250, 85, 150][i];
            const platformFee = Math.round(price * 0.15 * 100) / 100;
            testBookings.push({
                athlete_id: athletes[0].id,
                trainer_id: trainers[0].id,
                sport: ["Tennis", "Basketball", "Swimming", "Soccer"][i],
                scheduled_at: new Date(Date.now() - (i * 86400000)).toISOString(),
                duration_minutes: 60,
                price: price,
                platform_fee: platformFee,
                total_paid: price + platformFee,
                status: ["completed", "completed", "no_show", "completed"][i],
            });
        }

        res = await fetch(api("bookings"), {
            method: "POST",
            headers,
            body: JSON.stringify(testBookings),
        });
        const createdBookings = await res.json();

        if (!Array.isArray(createdBookings) || createdBookings.length === 0) {
            console.log("❌ Failed to create test bookings:", createdBookings);
            return;
        }
        console.log(`✅ Created ${createdBookings.length} test bookings.`);
        bookings.push(...createdBookings);
    }

    // Step 2: Insert Payment Transactions for each booking (if they don't already have one)
    console.log("💳 Creating payment transactions...");
    for (const booking of bookings) {
        // Check if a payment transaction already exists
        res = await fetch(`${api("payment_transactions")}?booking_id=eq.${booking.id}&select=id`, { headers });
        const existing = await res.json();
        if (existing.length > 0) {
            console.log(`  ⏭️ Payment already exists for booking ${booking.id}`);
            continue;
        }

        const amount = Number(booking.price) || 100;
        const platformFee = Number(booking.platform_fee) || 15;
        const trainerPayout = amount - platformFee;

        const ptData = {
            booking_id: booking.id,
            amount: amount,
            platform_fee: platformFee,
            trainer_payout: trainerPayout,
            status: ["held", "released", "held", "released"][bookings.indexOf(booking) % 4],
            hold_until: new Date(Date.now() + 7 * 86400000).toISOString(),
        };

        res = await fetch(api("payment_transactions"), {
            method: "POST",
            headers,
            body: JSON.stringify(ptData),
        });
        const ptResult = await res.json();
        console.log(`  ✅ Payment transaction created for booking ${booking.id}:`, ptResult);
    }

    // Step 3: Insert Disputes for 2 bookings
    console.log("⚔️ Creating disputes...");
    const disputeReasons = [
        "Trainer did not show up for the scheduled session. I waited for 30 minutes and tried contacting them but received no response.",
        "Session quality was very poor. The trainer was distracted and unprepared. I want a partial refund."
    ];

    for (let i = 0; i < Math.min(2, bookings.length); i++) {
        // Check if a dispute already exists
        res = await fetch(`${api("disputes")}?booking_id=eq.${bookings[i].id}&select=id`, { headers });
        const existing = await res.json();
        if (existing.length > 0) {
            console.log(`  ⏭️ Dispute already exists for booking ${bookings[i].id}`);
            continue;
        }

        const disputeData = {
            booking_id: bookings[i].id,
            initiated_by: bookings[i].athlete_id,
            reason: disputeReasons[i],
            status: i === 0 ? "under_review" : "escalated",
            evidence_deadline: new Date(Date.now() + 14 * 86400000).toISOString(),
        };

        res = await fetch(api("disputes"), {
            method: "POST",
            headers,
            body: JSON.stringify(disputeData),
        });
        const dResult = await res.json();
        console.log(`  ✅ Dispute created:`, dResult);
    }

    console.log("\n✅ Seed complete! Refresh the admin pages to see the data:");
    console.log("   → /admin/disputes");
    console.log("   → /admin/payments");
    console.log("   → /admin/subscriptions (uses trainer_profiles data, should already show)");
})();
