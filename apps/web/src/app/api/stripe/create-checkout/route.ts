// ============================================
// Stripe Checkout Session - Trainer Subscription
// ============================================
import { NextRequest, NextResponse } from 'next/server';
import Stripe from 'stripe';
import { createClient } from '@supabase/supabase-js';
import { stripeCurrency } from '@/lib/currency';
import { requireSessionUser } from '@/lib/session-auth';

export async function POST(req: NextRequest) {
    try {
        const auth = await requireSessionUser(req);
        if ('error' in auth) return auth.error;

        if (!process.env.STRIPE_SECRET_KEY) {
            return NextResponse.json({ error: 'Stripe not configured. Add STRIPE_SECRET_KEY to .env' }, { status: 500 });
        }
        const stripe = new Stripe(process.env.STRIPE_SECRET_KEY, { apiVersion: '2026-02-25.clover' });

        const body = await req.json();
        const { plan, email, trainerProfileId } = body;
        const userId = auth.user.id;

        // Validate inputs
        if (!plan || !email) {
            return NextResponse.json({ error: 'Missing required fields: plan, email' }, { status: 400 });
        }
        if (!['monthly', 'annual'].includes(plan)) {
            return NextResponse.json({ error: 'Invalid plan. Must be monthly or annual.' }, { status: 400 });
        }
        if (!process.env.STRIPE_SECRET_KEY) {
            return NextResponse.json({ error: 'Stripe not configured' }, { status: 500 });
        }

        // Block re-subscribing if already active
        if (process.env.SUPABASE_SERVICE_ROLE_KEY) {
            const supabaseAdmin = createClient(
                process.env.NEXT_PUBLIC_SUPABASE_URL!,
                process.env.SUPABASE_SERVICE_ROLE_KEY,
                { auth: { persistSession: false } }
            );
            const { data: existingProfile } = await supabaseAdmin
                .from('trainer_profiles')
                .select('subscription_status')
                .eq('user_id', userId)
                .maybeSingle();
            if (existingProfile?.subscription_status === 'active') {
                return NextResponse.json({ error: 'You already have an active subscription' }, { status: 409 });
            }
        }

        const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';

        // Use pre-created Price IDs if set, otherwise create inline
        const monthlyPriceId = process.env.STRIPE_PRICE_MONTHLY;
        const annualPriceId = process.env.STRIPE_PRICE_ANNUAL;

        const lineItem: Stripe.Checkout.SessionCreateParams.LineItem =
            plan === 'monthly'
                ? monthlyPriceId
                    ? { price: monthlyPriceId, quantity: 1 }
                    : {
                          price_data: {
                              currency: stripeCurrency(),
                              product_data: {
                                  name: 'AirTrainr Coach — Monthly',
                                  description: 'Full access: bookings, messaging, payments & analytics',
                              },
                              recurring: { interval: 'month' },
                              unit_amount: 2500, // $25.00 (2500 USD cents)
                          },
                          quantity: 1,
                      }
                : annualPriceId
                    ? { price: annualPriceId, quantity: 1 }
                    : {
                          price_data: {
                              currency: stripeCurrency(),
                              product_data: {
                                  name: 'AirTrainr Coach — Annual',
                                  description: 'Full access: bookings, messaging, payments & analytics (Save $50/yr)',
                              },
                              recurring: { interval: 'year' },
                              unit_amount: 25000, // $250.00
                          },
                          quantity: 1,
                      };

        const session = await stripe.checkout.sessions.create({
            mode: 'subscription',
            customer_email: email,
            line_items: [lineItem],
            success_url: `${baseUrl}/dashboard/subscription/success?session_id={CHECKOUT_SESSION_ID}`,
            cancel_url: `${baseUrl}/dashboard/subscription/cancel`,
            // Store userId so webhook can find + update trainer_profile
            metadata: {
                userId,
                trainerProfileId: trainerProfileId || '',
                plan,
            },
            subscription_data: {
                metadata: {
                    userId,
                    trainerProfileId: trainerProfileId || '',
                    plan,
                },
            },
            // Allow promotion codes (e.g. for special deals)
            allow_promotion_codes: true,
        });

        return NextResponse.json({ url: session.url });
    } catch (error: any) {
        console.error('[stripe/create-checkout] Error:', error);
        return NextResponse.json(
            { error: error.message || 'Failed to create checkout session' },
            { status: 500 }
        );
    }
}
