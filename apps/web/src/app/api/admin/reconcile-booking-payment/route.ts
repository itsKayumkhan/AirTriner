// ============================================
// Admin payment reconciliation — given a bookingId, look up the latest Stripe
// state for that booking and (optionally) sync the DB to match.
//
// What it answers:
// - Did the athlete actually pay in Stripe?
// - Is there a payment_transactions row? Does its status match Stripe?
// - If a payment succeeded but no DB row exists, allow admin to backfill.
// ============================================

import { NextRequest, NextResponse } from 'next/server';
import Stripe from 'stripe';
import { createClient } from '@supabase/supabase-js';
import { requireAdmin, logAdminAction } from '@/lib/admin-auth';

export async function POST(req: NextRequest) {
    const auth = await requireAdmin(req);
    if ('error' in auth) return auth.error;

    if (!process.env.STRIPE_SECRET_KEY) {
        return NextResponse.json({ error: 'Stripe not configured' }, { status: 500 });
    }
    const stripe = new Stripe(process.env.STRIPE_SECRET_KEY, { apiVersion: '2026-02-25.clover' });
    const supabase = createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    try {
        const { bookingId, sync } = await req.json();
        if (!bookingId) {
            return NextResponse.json({ error: 'Missing bookingId' }, { status: 400 });
        }

        // 1. Load DB state
        const { data: booking } = await supabase
            .from('bookings')
            .select('id, athlete_id, trainer_id, sport, status, scheduled_at, price, platform_fee, stripe_fee, tax_amount, tax_label, total_paid, duration_minutes')
            .eq('id', bookingId)
            .maybeSingle();
        if (!booking) {
            return NextResponse.json({ error: 'Booking not found' }, { status: 404 });
        }

        const { data: existingTx } = await supabase
            .from('payment_transactions')
            .select('*')
            .eq('booking_id', bookingId)
            .maybeSingle();

        // 2. Find the matching Stripe Checkout Session for this booking.
        //    Sessions are tagged with metadata.bookingId on creation.
        const sessions = await stripe.checkout.sessions.list({ limit: 20 });
        const matched = sessions.data.find((s) => s.metadata?.bookingId === bookingId);

        let pi: Stripe.PaymentIntent | null = null;
        if (matched?.payment_intent) {
            const piId = typeof matched.payment_intent === 'string' ? matched.payment_intent : matched.payment_intent.id;
            try {
                pi = await stripe.paymentIntents.retrieve(piId);
            } catch (err) {
                console.warn('[reconcile] PI retrieve failed', err);
            }
        }

        const stripeView = matched
            ? {
                  sessionId: matched.id,
                  paymentStatus: matched.payment_status,
                  paymentIntentId: typeof matched.payment_intent === 'string' ? matched.payment_intent : matched.payment_intent?.id ?? null,
                  amountTotal: matched.amount_total ? matched.amount_total / 100 : null,
                  currency: matched.currency,
                  customerEmail: matched.customer_email ?? null,
                  metadata: matched.metadata,
                  paymentIntentStatus: pi?.status ?? null,
                  paymentIntentLatestCharge: typeof pi?.latest_charge === 'string' ? pi.latest_charge : pi?.latest_charge?.id ?? null,
              }
            : null;

        // 3. Compute diagnosis
        const stripePaid = matched?.payment_status === 'paid';
        const dbHasTx = !!existingTx;
        const bookingConfirmedOrLater = booking.status === 'confirmed' || booking.status === 'completed';

        let diagnosis: string;
        if (!matched) {
            diagnosis = 'no_stripe_session_found';
        } else if (stripePaid && !dbHasTx) {
            diagnosis = 'paid_in_stripe_missing_in_db';
        } else if (stripePaid && dbHasTx && existingTx.status !== 'held' && existingTx.status !== 'released') {
            diagnosis = 'paid_in_stripe_db_status_mismatch';
        } else if (!stripePaid && dbHasTx) {
            diagnosis = 'unpaid_in_stripe_but_db_has_tx';
        } else if (stripePaid && dbHasTx) {
            diagnosis = 'in_sync';
        } else {
            diagnosis = 'unpaid';
        }

        // 4. Optionally sync the DB to match Stripe (only "paid in Stripe but missing in DB")
        let syncResult: { performed: boolean; reason?: string; createdTxId?: string } = { performed: false };
        if (sync === true && diagnosis === 'paid_in_stripe_missing_in_db' && matched) {
            const md = matched.metadata || {};
            const holdHours = 72;
            const holdUntil = new Date(Date.now() + holdHours * 60 * 60 * 1000);

            const { data: created, error: insertErr } = await supabase
                .from('payment_transactions')
                .insert({
                    booking_id: bookingId,
                    stripe_payment_intent_id: stripeView?.paymentIntentId ?? null,
                    amount: Number(md.amount) || Number(booking.price) || 0,
                    platform_fee: Number(md.platformFee) || Number(booking.platform_fee) || 0,
                    stripe_fee: Number(md.stripeFee) || Number(booking.stripe_fee) || 0,
                    tax_amount: Number(md.taxAmount) || Number(booking.tax_amount) || 0,
                    tax_label: md.taxLabel || booking.tax_label || null,
                    trainer_payout: Number(md.trainerPayout) || Number(booking.price) || 0,
                    status: 'held',
                    hold_until: holdUntil.toISOString(),
                })
                .select('id')
                .single();

            if (insertErr) {
                syncResult = { performed: false, reason: insertErr.message };
            } else {
                if (!bookingConfirmedOrLater) {
                    await supabase.from('bookings').update({ status: 'confirmed' }).eq('id', bookingId);
                }
                syncResult = { performed: true, createdTxId: created!.id };
                await logAdminAction({
                    actorId: auth.ctx.userId,
                    action: 'reconcile_payment_sync_from_stripe',
                    targetType: 'bookings',
                    targetId: bookingId,
                    payload: { stripeSessionId: matched.id, paymentIntentId: stripeView?.paymentIntentId, createdTxId: created!.id },
                });
            }
        } else if (sync === true) {
            syncResult = { performed: false, reason: `Cannot sync: diagnosis='${diagnosis}'` };
        }

        return NextResponse.json({
            booking: {
                id: booking.id,
                status: booking.status,
                price: booking.price,
                total_paid: booking.total_paid,
                scheduled_at: booking.scheduled_at,
            },
            db: existingTx
                ? {
                      txId: existingTx.id,
                      status: existingTx.status,
                      amount: existingTx.amount,
                      stripePaymentIntentId: existingTx.stripe_payment_intent_id,
                      stripeTransferId: existingTx.stripe_transfer_id,
                      releasedAt: existingTx.released_at,
                  }
                : null,
            stripe: stripeView,
            diagnosis,
            sync: syncResult,
        });
    } catch (err: any) {
        console.error('[reconcile-booking-payment] error', err);
        return NextResponse.json({ error: err.message || 'Failed' }, { status: 500 });
    }
}
