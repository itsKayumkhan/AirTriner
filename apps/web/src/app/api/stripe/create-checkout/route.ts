// ============================================
// Stripe Checkout Session - Trainer Subscription
// ============================================
import { NextRequest, NextResponse } from 'next/server';
import Stripe from 'stripe';

export async function POST(req: NextRequest) {
    try {
        if (!process.env.STRIPE_SECRET_KEY) {
            return NextResponse.json({ error: 'Stripe not configured. Add STRIPE_SECRET_KEY to .env' }, { status: 500 });
        }
        const stripe = new Stripe(process.env.STRIPE_SECRET_KEY, { apiVersion: '2023-10-16' });

        const body = await req.json();
        const { plan, userId, email, trainerProfileId } = body;

        // Validate inputs
        if (!plan || !userId || !email) {
            return NextResponse.json({ error: 'Missing required fields: plan, userId, email' }, { status: 400 });
        }
        if (!['monthly', 'annual'].includes(plan)) {
            return NextResponse.json({ error: 'Invalid plan. Must be monthly or annual.' }, { status: 400 });
        }
        if (!process.env.STRIPE_SECRET_KEY) {
            return NextResponse.json({ error: 'Stripe not configured' }, { status: 500 });
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
                              currency: 'usd',
                              product_data: {
                                  name: 'AirTrainr Coach — Monthly',
                                  description: 'Full access: bookings, messaging, payments & analytics',
                              },
                              recurring: { interval: 'month' },
                              unit_amount: 2500, // ₹25.00 (2500 paise)
                          },
                          quantity: 1,
                      }
                : annualPriceId
                    ? { price: annualPriceId, quantity: 1 }
                    : {
                          price_data: {
                              currency: 'usd',
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
