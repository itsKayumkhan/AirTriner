// ============================================
// Stripe Webhook Handler
// Handles: subscription lifecycle events
// ============================================
import { NextRequest, NextResponse } from 'next/server';
import Stripe from 'stripe';
import { createClient } from '@supabase/supabase-js';

export async function POST(req: NextRequest) {
    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
    if (!serviceKey) {
        console.error('[webhook] SUPABASE_SERVICE_ROLE_KEY is not set')
        return new Response('Server configuration error', { status: 500 })
    }
    const supabaseAdmin = createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        serviceKey
    );
    if (!process.env.STRIPE_SECRET_KEY) {
        return NextResponse.json({ error: 'Stripe not configured' }, { status: 500 });
    }
    const stripe = new Stripe(process.env.STRIPE_SECRET_KEY, { apiVersion: '2026-02-25.clover' });

    const body = await req.text(); // Raw body needed for Stripe signature verification
    const sig = req.headers.get('stripe-signature');
    const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;

    let event: Stripe.Event;

    try {
        if (webhookSecret && sig) {
            event = stripe.webhooks.constructEvent(body, sig, webhookSecret);
        } else {
            // Dev mode: parse without verification (only allow in development)
            if (process.env.NODE_ENV === 'production') {
                return NextResponse.json({ error: 'Missing webhook secret in production' }, { status: 400 });
            }
            event = JSON.parse(body) as Stripe.Event;
        }
    } catch (err: any) {
        console.error('[webhook] Signature verification failed:', err.message);
        return NextResponse.json({ error: `Webhook Error: ${err.message}` }, { status: 400 });
    }

    console.log(`[webhook] Processing event: ${event.type}`);

    try {
        switch (event.type) {

            // ----------------------------------------
            // Checkout completed — booking OR subscription
            // ----------------------------------------
            case 'checkout.session.completed': {
                const session = event.data.object as Stripe.Checkout.Session;
                const metaType = session.metadata?.type;

                // ── Booking payment ──
                if (metaType === 'booking') {
                    const { bookingId, athleteId, trainerId, amount, platformFee, trainerPayout } = session.metadata || {};

                    if (!bookingId) {
                        console.error('[webhook] booking payment: missing bookingId');
                        break;
                    }

                    // Idempotency: skip if already exists
                    const { data: existing } = await supabaseAdmin
                        .from('payment_transactions')
                        .select('id')
                        .eq('booking_id', bookingId)
                        .maybeSingle();

                    if (existing) {
                        console.log(`[webhook] payment_transaction already exists for booking: ${bookingId}`);
                        break;
                    }

                    // Determine hold period (72h standard, 24h for established trainers)
                    const { count: completedCount } = await supabaseAdmin
                        .from('bookings')
                        .select('*', { count: 'exact', head: true })
                        .eq('trainer_id', trainerId)
                        .eq('status', 'completed');
                    const holdHours = (completedCount ?? 0) >= 10 ? 24 : 72;
                    const holdUntil = new Date(Date.now() + holdHours * 60 * 60 * 1000);

                    const { error: txError } = await supabaseAdmin
                        .from('payment_transactions')
                        .insert({
                            booking_id: bookingId,
                            stripe_payment_intent_id: session.payment_intent ? String(session.payment_intent) : null,
                            amount: Number(amount),
                            platform_fee: Number(platformFee),
                            trainer_payout: Number(trainerPayout),
                            status: 'held',
                            hold_until: holdUntil.toISOString(),
                        });

                    if (txError) {
                        console.error('[webhook] Failed to create payment_transaction:', txError);
                    } else {
                        // Notify trainer of payment received
                        await supabaseAdmin.from('notifications').insert({
                            user_id: trainerId,
                            type: 'PAYMENT_RECEIVED',
                            title: 'Payment Received',
                            body: `Athlete has paid $${Number(amount).toFixed(2)} for your upcoming session. Funds are held in escrow.`,
                            data: { booking_id: bookingId },
                            read: false,
                        });

                        console.log(`[webhook] Booking payment recorded: ${bookingId} ($${amount})`);
                    }
                    break;
                }

                // ── Subscription payment ──
                if (session.mode !== 'subscription') break;

                const userId = session.metadata?.userId;
                const plan = session.metadata?.plan;

                if (!userId) {
                    console.error('[webhook] subscription: missing userId in metadata');
                    break;
                }

                const expiresAt = new Date();
                if (plan === 'annual') {
                    expiresAt.setFullYear(expiresAt.getFullYear() + 1);
                } else {
                    expiresAt.setMonth(expiresAt.getMonth() + 1);
                }

                const { error } = await supabaseAdmin
                    .from('trainer_profiles')
                    .update({
                        subscription_status: 'active',
                        subscription_expires_at: expiresAt.toISOString(),
                    })
                    .eq('user_id', userId);

                if (error) {
                    console.error('[webhook] Failed to activate subscription:', error);
                } else {
                    console.log(`[webhook] Subscription activated for user: ${userId} (plan: ${plan})`);
                }
                break;
            }

            // ----------------------------------------
            // Recurring invoice paid — extend subscription
            // ----------------------------------------
            case 'invoice.payment_succeeded': {
                const invoice = event.data.object as Stripe.Invoice;
                // Only handle subscription renewals (not first payment — that's checkout.session.completed)
                if (invoice.billing_reason !== 'subscription_cycle') break;

                const subscriptionId = (invoice as unknown as { subscription?: string }).subscription;
                if (!subscriptionId) break;
                const subscription = await stripe.subscriptions.retrieve(subscriptionId);
                const userId = subscription.metadata?.userId;
                const plan = subscription.metadata?.plan;

                if (!userId) break;

                const expiresAt = new Date();
                if (plan === 'annual') {
                    expiresAt.setFullYear(expiresAt.getFullYear() + 1);
                } else {
                    expiresAt.setMonth(expiresAt.getMonth() + 1);
                }

                await supabaseAdmin
                    .from('trainer_profiles')
                    .update({
                        subscription_status: 'active',
                        subscription_expires_at: expiresAt.toISOString(),
                    })
                    .eq('user_id', userId);

                console.log(`[webhook] Subscription renewed for user: ${userId}`);
                break;
            }

            // ----------------------------------------
            // Payment failed — grace period / expire
            // ----------------------------------------
            case 'invoice.payment_failed': {
                const invoice = event.data.object as Stripe.Invoice;
                const subscriptionId2 = (invoice as unknown as { subscription?: string }).subscription;
                if (!subscriptionId2) break;
                const subscription = await stripe.subscriptions.retrieve(subscriptionId2);
                const userId = subscription.metadata?.userId;

                if (!userId) break;

                // Mark as expired so trainer sees upgrade prompt
                const { error } = await supabaseAdmin
                    .from('trainer_profiles')
                    .update({ subscription_status: 'expired' })
                    .eq('user_id', userId);

                if (!error) {
                    console.log(`[webhook] Subscription expired (payment failed) for user: ${userId}`);
                }
                break;
            }

            // ----------------------------------------
            // Subscription cancelled
            // ----------------------------------------
            case 'customer.subscription.deleted': {
                const subscription = event.data.object as Stripe.Subscription;
                const userId = subscription.metadata?.userId;

                if (!userId) break;

                await supabaseAdmin
                    .from('trainer_profiles')
                    .update({
                        subscription_status: 'cancelled',
                        subscription_expires_at: new Date().toISOString(),
                    })
                    .eq('user_id', userId);

                console.log(`[webhook] Subscription cancelled for user: ${userId}`);
                break;
            }

            // ----------------------------------------
            // Subscription paused / updated
            // ----------------------------------------
            case 'customer.subscription.updated': {
                const subscription = event.data.object as Stripe.Subscription;
                const userId = subscription.metadata?.userId;
                if (!userId) break;

                if (subscription.status === 'active') {
                    const currentPeriodEnd = new Date(((subscription as unknown as { current_period_end?: number }).current_period_end ?? 0) * 1000);
                    await supabaseAdmin
                        .from('trainer_profiles')
                        .update({
                            subscription_status: 'active',
                            subscription_expires_at: currentPeriodEnd.toISOString(),
                        })
                        .eq('user_id', userId);
                } else if (subscription.status === 'canceled' || subscription.status === 'unpaid') {
                    await supabaseAdmin
                        .from('trainer_profiles')
                        .update({ subscription_status: 'cancelled' })
                        .eq('user_id', userId);
                }
                break;
            }

            default:
                console.log(`[webhook] Unhandled event type: ${event.type}`);
        }
    } catch (err: any) {
        console.error('[webhook] Error processing event:', err);
        // Return 200 to prevent Stripe from retrying — log the error instead
        return NextResponse.json({ received: true, error: err.message });
    }

    return NextResponse.json({ received: true });
}
