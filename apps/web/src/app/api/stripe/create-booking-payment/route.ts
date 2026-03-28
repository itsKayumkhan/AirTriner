// ============================================
// Stripe Checkout — Athlete Booking Payment
// One-time payment with escrow (held until session completes)
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
            return NextResponse.json({ error: 'Stripe not configured. Add STRIPE_SECRET_KEY to .env' }, { status: 500 });
        }

        const stripe = new Stripe(process.env.STRIPE_SECRET_KEY, {
            apiVersion: '2023-10-16',
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

        const amountCents = Math.round(Number(booking.total_paid) * 100);
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

        const session = await stripe.checkout.sessions.create({
            mode: 'payment',
            customer_email: athleteEmail,
            line_items: [
                {
                    price_data: {
                        currency: 'usd',
                        product_data: {
                            name: `${booking.sport.replace(/_/g, ' ')} Session with ${trainerName}`,
                            description: `${booking.duration_minutes} min · ${sessionDate} · Funds held in escrow until session completes`,
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
                amount: booking.total_paid,
                platformFee: booking.platform_fee,
                trainerPayout: String(Number(booking.price) - Number(booking.platform_fee)),
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
