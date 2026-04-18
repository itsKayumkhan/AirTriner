// ============================================
// Stripe Webhook Handler
// Handles: subscription lifecycle events + booking payment receipts
// ============================================
import { NextRequest, NextResponse } from 'next/server';
import Stripe from 'stripe';
import { createClient } from '@supabase/supabase-js';
import { sendAthleteReceipt, sendTrainerReceipt, type BookingReceiptData } from '@/lib/email';

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
                    const {
                        bookingId, athleteId, trainerId,
                        amount, sessionFee, platformFee, stripeFee, taxAmount, taxLabel,
                        trainerPayout,
                    } = session.metadata || {};

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
                            stripe_fee: Number(stripeFee || 0),
                            tax_amount: Number(taxAmount || 0),
                            tax_label: taxLabel || null,
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

                        // ── Send email receipts to athlete & trainer ──
                        try {
                            // Fetch booking details for the receipt
                            const { data: booking } = await supabaseAdmin
                                .from('bookings')
                                .select(`
                                    sport, duration_minutes, scheduled_at,
                                    price, platform_fee, stripe_fee, tax_amount, tax_label, total_paid
                                `)
                                .eq('id', bookingId)
                                .single();

                            // Fetch athlete info
                            const { data: athlete } = await supabaseAdmin
                                .from('users')
                                .select('first_name, last_name, email')
                                .eq('id', athleteId)
                                .single();

                            // Fetch trainer info
                            const { data: trainer } = await supabaseAdmin
                                .from('users')
                                .select('first_name, last_name, email')
                                .eq('id', trainerId)
                                .single();

                            if (booking && athlete && trainer) {
                                const receiptData: BookingReceiptData = {
                                    athleteEmail: athlete.email,
                                    athleteName: `${athlete.first_name} ${athlete.last_name}`,
                                    trainerEmail: trainer.email,
                                    trainerName: `${trainer.first_name} ${trainer.last_name}`,
                                    sport: booking.sport,
                                    scheduledAt: booking.scheduled_at,
                                    durationMinutes: booking.duration_minutes,
                                    sessionFee: Number(booking.price),
                                    platformFee: Number(booking.platform_fee),
                                    stripeFee: Number(booking.stripe_fee ?? stripeFee ?? 0),
                                    taxAmount: Number(booking.tax_amount ?? taxAmount ?? 0),
                                    taxLabel: (booking.tax_label ?? taxLabel ?? '') as string,
                                    totalPaid: Number(booking.total_paid),
                                    trainerPayout: Number(trainerPayout),
                                    bookingId,
                                };

                                // Send emails (fire-and-forget, don't block webhook response)
                                sendAthleteReceipt(receiptData).catch(e =>
                                    console.error('[webhook] Athlete receipt email failed:', e)
                                );
                                sendTrainerReceipt(receiptData).catch(e =>
                                    console.error('[webhook] Trainer receipt email failed:', e)
                                );

                                // Store receipts in DB for later viewing
                                const receiptRows = [
                                    {
                                        booking_id: bookingId,
                                        recipient_id: athleteId,
                                        recipient_role: 'athlete',
                                        recipient_email: athlete.email,
                                        session_fee: Number(booking.price),
                                        platform_fee: Number(booking.platform_fee),
                                        stripe_fee: Number(booking.stripe_fee ?? stripeFee ?? 0),
                                        tax_amount: Number(booking.tax_amount ?? taxAmount ?? 0),
                                        tax_label: (booking.tax_label ?? taxLabel ?? null) as string | null,
                                        total_amount: Number(booking.total_paid),
                                        trainer_payout: Number(trainerPayout),
                                        sport: booking.sport,
                                        scheduled_at: booking.scheduled_at,
                                        email_sent: true,
                                    },
                                    {
                                        booking_id: bookingId,
                                        recipient_id: trainerId,
                                        recipient_role: 'trainer',
                                        recipient_email: trainer.email,
                                        session_fee: Number(booking.price),
                                        platform_fee: Number(booking.platform_fee),
                                        stripe_fee: Number(booking.stripe_fee ?? stripeFee ?? 0),
                                        tax_amount: Number(booking.tax_amount ?? taxAmount ?? 0),
                                        tax_label: (booking.tax_label ?? taxLabel ?? null) as string | null,
                                        total_amount: Number(booking.total_paid),
                                        trainer_payout: Number(trainerPayout),
                                        sport: booking.sport,
                                        scheduled_at: booking.scheduled_at,
                                        email_sent: true,
                                    },
                                ];

                                const { error: receiptError } = await supabaseAdmin
                                    .from('receipts')
                                    .insert(receiptRows);

                                if (receiptError) {
                                    console.error('[webhook] Failed to store receipts:', receiptError);
                                } else {
                                    console.log(`[webhook] Receipts stored for booking: ${bookingId}`);
                                }
                            } else {
                                console.warn('[webhook] Could not fetch booking/user details for receipt emails');
                            }
                        } catch (receiptErr) {
                            // Receipt emails are non-critical — don't fail the webhook
                            console.error('[webhook] Receipt processing error:', receiptErr);
                        }
                    }
                    break;
                }

                // ── Offer accept payment ──
                if (metaType === 'offer_accept') {
                    const {
                        offerId, athleteId, trainerId, sport,
                        scheduledAt, sessionLengthMin, message,
                        price, platformFee, stripeFee, taxAmount, taxLabel,
                        totalAmount, campName,
                    } = session.metadata || {};

                    if (!offerId) {
                        console.error('[webhook] offer_accept: missing offerId');
                        break;
                    }

                    // Idempotency: check if offer is already accepted
                    const { data: existingOffer } = await supabaseAdmin
                        .from('training_offers')
                        .select('status')
                        .eq('id', offerId)
                        .single();

                    if (existingOffer?.status === 'accepted') {
                        console.log(`[webhook] Offer already accepted: ${offerId}`);
                        break;
                    }

                    // 1. Create the booking
                    const bookingScheduledAt = scheduledAt || new Date().toISOString();
                    const { data: newBooking, error: bookingError } = await supabaseAdmin
                        .from('bookings')
                        .insert({
                            athlete_id: athleteId,
                            trainer_id: trainerId,
                            sport: sport || 'General Training',
                            scheduled_at: bookingScheduledAt,
                            duration_minutes: Number(sessionLengthMin) || 60,
                            price: Number(price),
                            platform_fee: Number(platformFee),
                            stripe_fee: Number(stripeFee || 0),
                            tax_amount: Number(taxAmount || 0),
                            tax_label: taxLabel || null,
                            total_paid: Number(totalAmount),
                            status: 'pending',
                            athlete_notes: `Accepted offer: ${message || ''}`,
                            status_history: [{
                                to: 'pending',
                                by: athleteId,
                                at: new Date().toISOString(),
                                reason: 'Accepted Trainer Offer (paid via Stripe)',
                            }],
                        })
                        .select('id')
                        .single();

                    if (bookingError) {
                        console.error('[webhook] offer_accept: failed to create booking:', bookingError);
                        break;
                    }

                    // 2. Update offer status to accepted
                    await supabaseAdmin
                        .from('training_offers')
                        .update({ status: 'accepted' })
                        .eq('id', offerId);

                    // 3. Create payment transaction (escrow)
                    const { count: completedCount } = await supabaseAdmin
                        .from('bookings')
                        .select('*', { count: 'exact', head: true })
                        .eq('trainer_id', trainerId)
                        .eq('status', 'completed');
                    const holdHours = (completedCount ?? 0) >= 10 ? 24 : 72;
                    const holdUntil = new Date(Date.now() + holdHours * 60 * 60 * 1000);

                    await supabaseAdmin
                        .from('payment_transactions')
                        .insert({
                            booking_id: newBooking.id,
                            stripe_payment_intent_id: session.payment_intent ? String(session.payment_intent) : null,
                            amount: Number(totalAmount),
                            platform_fee: Number(platformFee),
                            stripe_fee: Number(stripeFee || 0),
                            tax_amount: Number(taxAmount || 0),
                            tax_label: taxLabel || null,
                            trainer_payout: Number(price),
                            status: 'held',
                            hold_until: holdUntil.toISOString(),
                        });

                    // 4. Camp spots management
                    // trainerId should be users.id (resolved by create-offer-payment), but add fallback for safety
                    if (campName && trainerId) {
                        let retries = 3;
                        while (retries > 0) {
                            let { data: trainerProfile } = await supabaseAdmin
                                .from('trainer_profiles')
                                .select('camp_offerings, user_id')
                                .eq('user_id', trainerId)
                                .maybeSingle();

                            // Fallback: trainerId might be trainer_profiles PK
                            if (!trainerProfile) {
                                const fallback = await supabaseAdmin
                                    .from('trainer_profiles')
                                    .select('camp_offerings, user_id')
                                    .eq('id', trainerId)
                                    .maybeSingle();
                                trainerProfile = fallback.data;
                            }

                            if (!trainerProfile?.camp_offerings || !Array.isArray(trainerProfile.camp_offerings)) break;

                            const campIndex = trainerProfile.camp_offerings.findIndex((c: any) => c.name === campName);
                            if (campIndex === -1) break;

                            const currentCamp = trainerProfile.camp_offerings[campIndex] as any;
                            const currentSpots = currentCamp.spotsRemaining ?? currentCamp.maxSpots ?? 0;

                            if (currentSpots <= 0) break; // Camp full, but payment already done — don't block

                            const updatedCamps = trainerProfile.camp_offerings.map((c: any, i: number) => {
                                if (i === campIndex) return { ...c, spotsRemaining: currentSpots - 1 };
                                return c;
                            });

                            const { error: updateError } = await supabaseAdmin
                                .from('trainer_profiles')
                                .update({ camp_offerings: updatedCamps })
                                .eq('user_id', trainerProfile.user_id);

                            if (!updateError) break;
                            retries--;
                        }
                    }

                    // 5. Update notification so buttons don't show again
                    const { data: offerNotifs } = await supabaseAdmin
                        .from('notifications')
                        .select('id, data')
                        .eq('user_id', athleteId)
                        .contains('data', { offer_id: offerId });

                    if (offerNotifs && offerNotifs.length > 0) {
                        for (const notif of offerNotifs) {
                            const newData = { ...(notif.data as any), offer_status: 'accepted' };
                            await supabaseAdmin
                                .from('notifications')
                                .update({ data: newData })
                                .eq('id', notif.id);
                        }
                    }

                    // 6. Notify trainer
                    await supabaseAdmin.from('notifications').insert({
                        user_id: trainerId,
                        type: 'PAYMENT_RECEIVED',
                        title: 'Offer Accepted & Payment Received',
                        body: `Athlete has accepted your training offer and paid $${Number(totalAmount).toFixed(2)}. Funds are held in escrow.`,
                        data: { booking_id: newBooking.id, offer_id: offerId },
                        read: false,
                    });

                    console.log(`[webhook] Offer accepted with payment: ${offerId} → booking ${newBooking.id} ($${totalAmount})`);

                    // ── Send email receipts ──
                    try {
                        const { data: athlete } = await supabaseAdmin
                            .from('users')
                            .select('first_name, last_name, email')
                            .eq('id', athleteId)
                            .single();

                        const { data: trainerUser } = await supabaseAdmin
                            .from('users')
                            .select('first_name, last_name, email')
                            .eq('id', trainerId)
                            .single();

                        if (athlete && trainerUser) {
                            const receiptData: BookingReceiptData = {
                                athleteEmail: athlete.email,
                                athleteName: `${athlete.first_name} ${athlete.last_name}`,
                                trainerEmail: trainerUser.email,
                                trainerName: `${trainerUser.first_name} ${trainerUser.last_name}`,
                                sport: sport || 'General Training',
                                scheduledAt: bookingScheduledAt,
                                durationMinutes: Number(sessionLengthMin) || 60,
                                sessionFee: Number(price),
                                platformFee: Number(platformFee),
                                stripeFee: Number(stripeFee || 0),
                                taxAmount: Number(taxAmount || 0),
                                taxLabel: taxLabel || '',
                                totalPaid: Number(totalAmount),
                                trainerPayout: Number(price),
                                bookingId: newBooking.id,
                            };

                            sendAthleteReceipt(receiptData).catch(e =>
                                console.error('[webhook] Offer accept athlete receipt failed:', e)
                            );
                            sendTrainerReceipt(receiptData).catch(e =>
                                console.error('[webhook] Offer accept trainer receipt failed:', e)
                            );
                        }
                    } catch (receiptErr) {
                        console.error('[webhook] Offer accept receipt error:', receiptErr);
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
