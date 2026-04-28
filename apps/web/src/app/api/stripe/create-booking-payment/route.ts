// ============================================
// Stripe Checkout — Athlete Booking Payment
// One-time payment with escrow (held until session completes)
//
// Fee model (athlete-pays-all):
//   athlete pays  = price + platformFee (3%) + stripeFee (2.9% + $0.30) + tax (HST 13% if CA)
//   trainer gets  = 100% of price, no deductions
// ============================================
import { NextRequest, NextResponse } from 'next/server';
import Stripe from 'stripe';
import { createClient } from '@supabase/supabase-js';
import { calculateFees } from '@/lib/fees';
import { stripeCurrency } from '@/lib/currency';
import { trainerPublicGate } from '@/lib/trainer-gate';

function formatSportName(sport: string): string {
    return sport.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

export async function POST(req: NextRequest) {
    const supabase = createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    );
    try {
        if (!process.env.STRIPE_SECRET_KEY) {
            return NextResponse.json({ error: 'Stripe not configured. Add STRIPE_SECRET_KEY to .env' }, { status: 500 });
        }

        const stripe = new Stripe(process.env.STRIPE_SECRET_KEY, {
            apiVersion: '2026-02-25.clover',
        });

        const body = await req.json();
        const { bookingId, athleteId, athleteEmail } = body;

        if (!bookingId || !athleteId || !athleteEmail) {
            return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
        }

        // Fetch booking details
        const { data: booking, error: bookingError } = await supabase
            .from('bookings')
            .select(`
                id, sport, duration_minutes, scheduled_at,
                price, platform_fee, total_paid,
                trainer_id, athlete_id, status,
                users!bookings_trainer_id_fkey (first_name, last_name)
            `)
            .eq('id', bookingId)
            .eq('athlete_id', athleteId)
            .single();

        if (bookingError || !booking) {
            return NextResponse.json({ error: 'Booking not found' }, { status: 404 });
        }

        // Validate booking is confirmed and athlete is the correct one
        if (booking.status !== 'confirmed') {
            return NextResponse.json({ error: 'Booking must be confirmed before payment' }, { status: 400 });
        }

        // Check if already paid
        const { data: existingTx } = await supabase
            .from('payment_transactions')
            .select('id, status')
            .eq('booking_id', bookingId)
            .maybeSingle();

        if (existingTx) {
            return NextResponse.json({ error: 'This booking has already been paid' }, { status: 400 });
        }

        // ── Trainer public-visibility gate ──
        // No money moves until the trainer is verified, subscribed, complete,
        // and the user account is active (not suspended/deleted).
        const { data: trainerUser } = await supabase
            .from('users')
            .select('id, first_name, last_name, phone, date_of_birth, avatar_url, is_suspended, deleted_at')
            .eq('id', booking.trainer_id)
            .maybeSingle();

        const { data: trainerProfile } = await supabase
            .from('trainer_profiles')
            .select('verification_status, subscription_status, bio, sports, city, years_experience, session_pricing, training_locations, country')
            .eq('user_id', booking.trainer_id)
            .maybeSingle();

        const gate = trainerPublicGate({ user: trainerUser, trainerProfile });
        if (!gate.ok) {
            return NextResponse.json(
                {
                    error: "This trainer isn't accepting bookings right now.",
                    reason: gate.reason,
                },
                { status: 409 }
            );
        }

        // ── Recalculate fees using the full athlete-pays-all model ──
        const { data: settings } = await supabase
            .from('platform_settings')
            .select('platform_fee_percentage')
            .maybeSingle();

        const fees = calculateFees({
            price: Number(booking.price),
            platformFeePercentage: settings?.platform_fee_percentage,
            trainerCountry: trainerProfile?.country,
        });

        // Persist authoritative breakdown back onto the booking so receipts/UI match
        await supabase
            .from('bookings')
            .update({
                platform_fee: fees.platformFee,
                stripe_fee: fees.stripeFee,
                tax_amount: fees.taxAmount,
                tax_label: fees.taxLabel || null,
                total_paid: fees.totalPaid,
            })
            .eq('id', bookingId);

        const amountCents = Math.round(fees.totalPaid * 100);
        if (amountCents < 50) {
            return NextResponse.json({ error: 'Booking amount too small' }, { status: 400 });
        }

        const trainerName = (booking.users as any)
            ? `${(booking.users as any).first_name} ${(booking.users as any).last_name}`
            : 'Your Trainer';

        const sessionDate = new Date(booking.scheduled_at).toLocaleDateString('en-US', {
            weekday: 'short', month: 'short', day: 'numeric',
        });

        const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';

        // Build line item description with transparent fee breakdown
        const breakdownLines = [
            `Session: $${fees.sessionFee.toFixed(2)}`,
            `Platform (${fees.platformFeePct}%): $${fees.platformFee.toFixed(2)}`,
            `Stripe: $${fees.stripeFee.toFixed(2)}`,
        ];
        if (fees.taxApplicable) breakdownLines.push(`${fees.taxLabel}: $${fees.taxAmount.toFixed(2)}`);

        const session = await stripe.checkout.sessions.create({
            mode: 'payment',
            customer_email: athleteEmail,
            line_items: [
                {
                    price_data: {
                        currency: stripeCurrency(),
                        product_data: {
                            name: `${formatSportName(booking.sport)} Session with ${trainerName}`,
                            description: `${booking.duration_minutes} min · ${sessionDate} · ${breakdownLines.join(' · ')} · Funds held in escrow until session completes`,
                        },
                        unit_amount: amountCents,
                    },
                    quantity: 1,
                },
            ],
            success_url: `${baseUrl}/dashboard/bookings/payment-success?session_id={CHECKOUT_SESSION_ID}&booking_id=${bookingId}`,
            cancel_url: `${baseUrl}/dashboard/bookings`,
            metadata: {
                type: 'booking',
                bookingId,
                athleteId,
                trainerId: booking.trainer_id,
                amount: String(fees.totalPaid),
                sessionFee: String(fees.sessionFee),
                platformFee: String(fees.platformFee),
                stripeFee: String(fees.stripeFee),
                taxAmount: String(fees.taxAmount),
                taxLabel: fees.taxLabel || '',
                trainerCountry: fees.trainerCountry || '',
                trainerPayout: String(fees.trainerPayout),
            },
        });

        return NextResponse.json({ url: session.url });
    } catch (error: any) {
        console.error('[create-booking-payment] Error:', error);
        return NextResponse.json(
            { error: error.message || 'Failed to create payment session' },
            { status: 500 }
        );
    }
}
