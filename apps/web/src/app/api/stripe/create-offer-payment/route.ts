// ============================================
// Stripe Checkout — Offer Accept Payment
// Athlete pays (price + platform fee + Stripe fee + tax) when accepting an offer.
// Trainer always receives 100% of price. On success, webhook creates booking.
// ============================================
import { NextRequest, NextResponse } from 'next/server';
import Stripe from 'stripe';
import { createClient } from '@supabase/supabase-js';
import { calculateFees } from '@/lib/fees';
import { stripeCurrency } from '@/lib/currency';

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
        const { offerId, athleteId, athleteEmail } = body;

        if (!offerId || !athleteId || !athleteEmail) {
            return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
        }

        // Fetch offer details
        const { data: offer, error: offerError } = await supabase
            .from('training_offers')
            .select('*')
            .eq('id', offerId)
            .eq('athlete_id', athleteId)
            .single();

        if (offerError || !offer) {
            return NextResponse.json({ error: 'Offer not found' }, { status: 404 });
        }

        if (offer.status !== 'pending') {
            return NextResponse.json({ error: 'Offer is no longer pending' }, { status: 400 });
        }

        // Resolve trainer user ID — offer.trainer_id may be users.id (web) or trainer_profiles.id (mobile)
        let resolvedTrainerUserId = offer.trainer_id;
        const { data: trainer } = await supabase
            .from('users')
            .select('first_name, last_name')
            .eq('id', offer.trainer_id)
            .single();

        let trainerName = 'Your Trainer';
        if (trainer) {
            trainerName = `${trainer.first_name} ${trainer.last_name}`;
        } else {
            // offer.trainer_id is likely the trainer_profiles PK (mobile app) — resolve to users.id
            const { data: tp } = await supabase
                .from('trainer_profiles')
                .select('user_id')
                .eq('id', offer.trainer_id)
                .maybeSingle();
            if (tp?.user_id) {
                resolvedTrainerUserId = tp.user_id;
                const { data: u } = await supabase
                    .from('users')
                    .select('first_name, last_name')
                    .eq('id', tp.user_id)
                    .single();
                if (u) trainerName = `${u.first_name} ${u.last_name}`;
            }
        }

        // Look up trainer country for tax calculation
        const { data: trainerProfile } = await supabase
            .from('trainer_profiles')
            .select('country')
            .eq('user_id', resolvedTrainerUserId)
            .maybeSingle();

        // Look up platform fee %
        const { data: settings } = await supabase
            .from('platform_settings')
            .select('platform_fee_percentage')
            .maybeSingle();

        // Calculate full breakdown (athlete-pays-all model)
        const fees = calculateFees({
            price: Number(offer.price),
            platformFeePercentage: settings?.platform_fee_percentage,
            trainerCountry: trainerProfile?.country,
        });

        const amountCents = Math.round(fees.totalPaid * 100);
        if (amountCents < 50) {
            return NextResponse.json({ error: 'Offer amount too small' }, { status: 400 });
        }

        // Build session date display
        const proposed = offer.proposed_dates as any || {};
        const scheduledAt = proposed.scheduledAt || null;
        const sessionDateStr = scheduledAt
            ? new Date(scheduledAt).toLocaleDateString('en-US', {
                weekday: 'short', month: 'short', day: 'numeric',
            })
            : 'TBD';

        const breakdownLines = [
            `Session: $${fees.sessionFee.toFixed(2)}`,
            `Platform (${fees.platformFeePct}%): $${fees.platformFee.toFixed(2)}`,
            `Stripe: $${fees.stripeFee.toFixed(2)}`,
        ];
        if (fees.taxApplicable) breakdownLines.push(`${fees.taxLabel}: $${fees.taxAmount.toFixed(2)}`);

        const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';

        const session = await stripe.checkout.sessions.create({
            mode: 'payment',
            customer_email: athleteEmail,
            line_items: [
                {
                    price_data: {
                        currency: stripeCurrency(),
                        product_data: {
                            name: `${formatSportName(offer.sport || 'Training')} Session with ${trainerName}`,
                            description: `${offer.session_length_min || 60} min · ${sessionDateStr} · ${breakdownLines.join(' · ')} · Funds held in escrow until session completes`,
                        },
                        unit_amount: amountCents,
                    },
                    quantity: 1,
                },
            ],
            success_url: `${baseUrl}/dashboard/notifications?offer_paid=true&offer_id=${offerId}`,
            cancel_url: `${baseUrl}/dashboard/notifications?offer_cancelled=true`,
            metadata: {
                type: 'offer_accept',
                offerId,
                athleteId,
                trainerId: resolvedTrainerUserId,
                sport: offer.sport || 'General Training',
                scheduledAt: scheduledAt || '',
                sessionLengthMin: String(offer.session_length_min || 60),
                message: (offer.message || '').slice(0, 450),
                price: String(fees.sessionFee),
                platformFee: String(fees.platformFee),
                stripeFee: String(fees.stripeFee),
                taxAmount: String(fees.taxAmount),
                taxLabel: fees.taxLabel || '',
                trainerCountry: fees.trainerCountry || '',
                totalAmount: String(fees.totalPaid),
                // Pass camp info if present so webhook can decrement spots
                campName: proposed?.camp?.name || '',
            },
        });

        return NextResponse.json({ url: session.url });
    } catch (error: any) {
        console.error('[create-offer-payment] Error:', error);
        return NextResponse.json(
            { error: error.message || 'Failed to create payment session' },
            { status: 500 }
        );
    }
}
