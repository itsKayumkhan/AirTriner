// ============================================
// Stripe Refund — Cancel paid booking
// Called when coach or athlete cancels a confirmed + paid booking
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
        const stripe = new Stripe(process.env.STRIPE_SECRET_KEY, { apiVersion: '2026-02-25.clover' });

        const { bookingId, cancelledBy, reason } = await req.json();
        if (!bookingId) {
            return NextResponse.json({ error: 'Missing bookingId' }, { status: 400 });
        }

        // Get the payment transaction (any status — branch below)
        const { data: tx } = await supabase
            .from('payment_transactions')
            .select('*')
            .eq('booking_id', bookingId)
            .maybeSingle();

        if (!tx) {
            // No payment to refund — just cancel the booking
            console.log(`[refund-booking] No payment_transaction for booking ${bookingId}; nothing to refund`);
            return NextResponse.json({ success: true, refunded: false });
        }

        if (!tx.stripe_payment_intent_id) {
            return NextResponse.json({ error: 'No payment intent found for this booking' }, { status: 400 });
        }

        // Branch on tx.status
        if (tx.status === 'refunded') {
            console.log(`[refund-booking] Booking ${bookingId} tx already refunded (idempotent no-op)`);
            return NextResponse.json({ success: true, refunded: false, alreadyRefunded: true });
        }

        if (tx.status !== 'held' && tx.status !== 'released') {
            console.log(`[refund-booking] Booking ${bookingId} tx in non-refundable status: ${tx.status}`);
            return NextResponse.json(
                { error: `Cannot refund booking with payment status: ${tx.status}` },
                { status: 409 }
            );
        }

        // RELEASED → reverse the transfer from connected account first
        if (tx.status === 'released') {
            if (!tx.stripe_transfer_id) {
                console.error(`[refund-booking] Booking ${bookingId} status=released but no stripe_transfer_id`);
                return NextResponse.json(
                    { error: 'Released payment is missing stripe_transfer_id; cannot reverse' },
                    { status: 500 }
                );
            }
            console.log(`[refund-booking] Booking ${bookingId} is RELEASED — reversing transfer ${tx.stripe_transfer_id}`);
            try {
                const reversal = await stripe.transfers.createReversal(
                    tx.stripe_transfer_id,
                    { refund_application_fee: true },
                    { idempotencyKey: `reversal_${tx.id}` }
                );
                console.log(`[refund-booking] Reversal succeeded: ${reversal.id} for tx ${tx.id}`);
            } catch (reversalErr: any) {
                console.error(`[refund-booking] Transfer reversal FAILED for tx ${tx.id}:`, reversalErr);
                return NextResponse.json(
                    { error: `Transfer reversal failed: ${reversalErr.message}` },
                    { status: 502 }
                );
            }
        } else {
            console.log(`[refund-booking] Booking ${bookingId} is HELD — direct refund path`);
        }

        // Issue refund to athlete's original payment method
        const refund = await stripe.refunds.create(
            { payment_intent: tx.stripe_payment_intent_id },
            { idempotencyKey: `refund_${tx.id}` }
        );

        if (refund.status !== 'succeeded' && refund.status !== 'pending') {
            return NextResponse.json({ error: `Refund failed with status: ${refund.status}` }, { status: 500 });
        }

        // Update payment_transaction to refunded (regardless of held/released path)
        await supabase
            .from('payment_transactions')
            .update({ status: 'refunded' })
            .eq('id', tx.id);

        // Get booking for notification
        const { data: booking } = await supabase
            .from('bookings')
            .select('athlete_id, trainer_id, sport, total_paid')
            .eq('id', bookingId)
            .single();

        if (booking) {
            // Notify athlete of refund
            await supabase.from('notifications').insert({
                user_id: booking.athlete_id,
                type: 'BOOKING_REFUNDED',
                title: 'Refund Issued',
                body: `Your $${Number(booking.total_paid).toFixed(2)} payment for the ${booking.sport} session has been refunded. ${cancelledBy === 'trainer' ? 'The trainer cancelled the session.' : ''}`,
                data: { booking_id: bookingId },
                read: false,
            });

            // Notify trainer if athlete cancelled
            if (cancelledBy === 'athlete') {
                await supabase.from('notifications').insert({
                    user_id: booking.trainer_id,
                    type: 'BOOKING_CANCELLED',
                    title: 'Booking Cancelled',
                    body: `Athlete cancelled the ${booking.sport} session. Their payment has been refunded. Reason: ${reason || 'No reason given'}`,
                    data: { booking_id: bookingId },
                    read: false,
                });
            }
        }

        console.log(`[refund-booking] Refunded booking ${bookingId}, refund: ${refund.id}`);
        return NextResponse.json({ success: true, refunded: true, refundId: refund.id });

    } catch (err: any) {
        console.error('[refund-booking] Error:', err);
        return NextResponse.json({ error: err.message }, { status: 500 });
    }
}
