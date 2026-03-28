// ============================================
// Verify Stripe Checkout — create payment_transaction after success redirect
// Called from payment-success page to confirm payment without relying on webhook
// ============================================
import { NextRequest, NextResponse } from 'next/server';
import Stripe from 'stripe';
import { createClient } from '@supabase/supabase-js';

export async function POST(req: NextRequest) {
    const supabase = createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    );
    try {
        if (!process.env.STRIPE_SECRET_KEY) {
            return NextResponse.json({ error: 'Stripe not configured' }, { status: 500 });
        }
        const stripe = new Stripe(process.env.STRIPE_SECRET_KEY, { apiVersion: '2023-10-16' });

        const { sessionId, bookingId } = await req.json();
        if (!sessionId || !bookingId) {
            return NextResponse.json({ error: 'Missing sessionId or bookingId' }, { status: 400 });
        }

        // Retrieve session from Stripe to verify payment
        const session = await stripe.checkout.sessions.retrieve(sessionId);
        if (session.payment_status !== 'paid') {
            return NextResponse.json({ error: 'Payment not completed' }, { status: 400 });
        }

        // Idempotency: skip if already recorded
        const { data: existing } = await supabase
            .from('payment_transactions')
            .select('id')
            .eq('booking_id', bookingId)
            .maybeSingle();

        if (existing) {
            return NextResponse.json({ success: true, alreadyRecorded: true });
        }

        // Get metadata from session
        const { athleteId, trainerId, amount, platformFee, trainerPayout } = session.metadata || {};

        // Determine hold period
        const { data: trainerBookings } = await supabase
            .from('bookings')
            .select('id')
            .eq('trainer_id', trainerId)
            .eq('status', 'completed');

        const completedCount = (trainerBookings || []).length;
        const holdHours = completedCount >= 10 ? 24 : 72;
        const holdUntil = new Date(Date.now() + holdHours * 60 * 60 * 1000);

        const { error: txError } = await supabase
            .from('payment_transactions')
            .insert({
                booking_id: bookingId,
                stripe_payment_intent_id: session.payment_intent as string || null,
                amount: Number(amount),
                platform_fee: Number(platformFee),
                trainer_payout: Number(trainerPayout),
                status: 'held',
                hold_until: holdUntil.toISOString(),
            });

        if (txError) {
            console.error('[verify-booking-payment] Failed to create transaction:', txError);
            return NextResponse.json({ error: txError.message }, { status: 500 });
        }

        // Notify trainer
        if (trainerId && amount) {
            await supabase.from('notifications').insert({
                user_id: trainerId,
                type: 'PAYMENT_RECEIVED',
                title: 'Payment Received',
                body: `Athlete has paid for your upcoming session. Funds are held in escrow.`,
                data: { booking_id: bookingId },
                read: false,
            });
        }

        return NextResponse.json({ success: true });
    } catch (err: any) {
        console.error('[verify-booking-payment] Error:', err);
        return NextResponse.json({ error: err.message }, { status: 500 });
    }
}
