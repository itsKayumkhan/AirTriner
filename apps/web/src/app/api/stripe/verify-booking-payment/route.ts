// ============================================
// Verify Stripe Checkout — create payment_transaction after success redirect
// Called from payment-success page to confirm payment without relying on webhook
// ============================================
import { NextRequest, NextResponse } from 'next/server';
import Stripe from 'stripe';
import { createClient } from '@supabase/supabase-js';
import { requireSessionUser } from '@/lib/session-auth';

export async function POST(req: NextRequest) {
    const auth = await requireSessionUser(req);
    if ('error' in auth) return auth.error;

    const supabase = createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    );
    try {
        if (!process.env.STRIPE_SECRET_KEY) {
            return NextResponse.json({ error: 'Stripe not configured' }, { status: 500 });
        }
        const stripe = new Stripe(process.env.STRIPE_SECRET_KEY, { apiVersion: '2026-02-25.clover' });

        const { sessionId, bookingId } = await req.json();
        if (!sessionId || !bookingId) {
            return NextResponse.json({ error: 'Missing sessionId or bookingId' }, { status: 400 });
        }

        // Retrieve session from Stripe to verify payment
        const session = await stripe.checkout.sessions.retrieve(sessionId);
        if (session.payment_status !== 'paid') {
            return NextResponse.json({ error: 'Payment not completed' }, { status: 400 });
        }

        // Ownership: Stripe session metadata must match the bookingId from
        // the body AND the authenticated caller. Prevents an attacker from
        // confirming someone else's booking using a Stripe session they paid for.
        if (
            session.metadata?.bookingId !== bookingId ||
            session.metadata?.athleteId !== auth.user.id
        ) {
            return NextResponse.json({ error: 'Booking ownership mismatch' }, { status: 403 });
        }

        // Safeguard: the booking row's athlete_id must also match the caller
        const { data: bookingOwn } = await supabase
            .from('bookings')
            .select('athlete_id')
            .eq('id', bookingId)
            .maybeSingle();
        if (!bookingOwn || bookingOwn.athlete_id !== auth.user.id) {
            return NextResponse.json({ error: 'Booking ownership mismatch' }, { status: 403 });
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
        const {
            athleteId, trainerId, amount, platformFee,
            stripeFee, taxAmount, taxLabel, trainerPayout,
        } = session.metadata || {};

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
                stripe_fee: Number(stripeFee || 0),
                tax_amount: Number(taxAmount || 0),
                tax_label: taxLabel || null,
                trainer_payout: Number(trainerPayout),
                status: 'held',
                hold_until: holdUntil.toISOString(),
            });

        if (txError) {
            console.error('[verify-booking-payment] Failed to create transaction:', txError);
            return NextResponse.json({ error: txError.message }, { status: 500 });
        }

        // Update booking status to confirmed after successful payment
        const { error: bookingError } = await supabase
            .from('bookings')
            .update({
                status: 'confirmed',
                status_history: [
                    { status: 'pending', timestamp: new Date().toISOString(), note: 'Booking created' },
                    { status: 'confirmed', timestamp: new Date().toISOString(), note: 'Payment verified via Stripe' }
                ],
                updated_at: new Date().toISOString(),
            })
            .eq('id', bookingId);

        if (bookingError) {
            console.error('[verify-booking-payment] Failed to confirm booking:', bookingError);
        }

        // Notify trainer
        if (trainerId && amount) {
            await supabase.from('notifications').insert({
                user_id: trainerId,
                type: 'PAYMENT_RECEIVED',
                title: 'Payment Received',
                body: `Payment received and booking confirmed! Funds are held in escrow until session completion.`,
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
