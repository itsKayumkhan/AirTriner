// ============================================
// Stripe Connect — Create Express Account + Onboarding Link
// ============================================
import { NextRequest, NextResponse } from 'next/server';
import Stripe from 'stripe';
import { createClient } from '@supabase/supabase-js';

const supabaseAdmin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

function getStripe() {
    if (!process.env.STRIPE_SECRET_KEY) throw new Error('STRIPE_SECRET_KEY not set');
    return new Stripe(process.env.STRIPE_SECRET_KEY, { apiVersion: '2026-02-25.clover' });
}

// POST — Create connected account (if needed) + return onboarding link
export async function POST(req: NextRequest) {
    try {
        const stripe = getStripe();
        const { userId, email } = await req.json();

        if (!userId || !email) {
            return NextResponse.json({ error: 'Missing userId or email' }, { status: 400 });
        }

        // Auth: verify the user exists and is a trainer
        const { data: authUser, error: authError } = await supabaseAdmin
            .from('users')
            .select('id, role')
            .eq('id', userId)
            .eq('role', 'trainer')
            .single();

        if (authError || !authUser) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
        }

        // 1. Check if trainer already has a stripe_account_id
        const { data: profile, error: profileError } = await supabaseAdmin
            .from('trainer_profiles')
            .select('id, stripe_account_id')
            .eq('user_id', userId)
            .single();

        if (profileError || !profile) {
            return NextResponse.json({ error: 'Trainer profile not found' }, { status: 404 });
        }

        let accountId = profile.stripe_account_id;

        // 2. If no account yet, create an Express connected account
        if (!accountId) {
            const account = await stripe.accounts.create({
                type: 'express',
                email,
                metadata: { userId, platform: 'airtrainr' },
                capabilities: {
                    card_payments: { requested: true },
                    transfers: { requested: true },
                },
            });
            accountId = account.id;

            // 3. Save stripe_account_id to trainer_profiles
            const { error: updateError } = await supabaseAdmin
                .from('trainer_profiles')
                .update({ stripe_account_id: accountId })
                .eq('user_id', userId);

            if (updateError) {
                console.error('[stripe/connect] Failed to save account ID:', updateError);
                return NextResponse.json({ error: 'Failed to save Stripe account' }, { status: 500 });
            }
        }

        // 4. Create onboarding link
        const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';
        const accountLink = await stripe.accountLinks.create({
            account: accountId,
            refresh_url: `${baseUrl}/dashboard/payments?refresh=true`,
            return_url: `${baseUrl}/dashboard/payments?onboarding=complete`,
            type: 'account_onboarding',
        });

        return NextResponse.json({ url: accountLink.url });
    } catch (error: unknown) {
        const message = error instanceof Error ? error.message : 'Failed to create connect account';
        console.error('[stripe/connect] Error:', error);
        return NextResponse.json({ error: message }, { status: 500 });
    }
}

// GET — Check if trainer's connected account is fully onboarded
export async function GET(req: NextRequest) {
    try {
        const stripe = getStripe();
        const userId = req.nextUrl.searchParams.get('userId');

        if (!userId) {
            return NextResponse.json({ error: 'Missing userId' }, { status: 400 });
        }

        // Auth: verify the user is a trainer
        const { data: authUser } = await supabaseAdmin
            .from('users')
            .select('id, role')
            .eq('id', userId)
            .eq('role', 'trainer')
            .single();

        if (!authUser) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
        }

        const { data: profile } = await supabaseAdmin
            .from('trainer_profiles')
            .select('stripe_account_id')
            .eq('user_id', userId)
            .single();

        if (!profile?.stripe_account_id) {
            return NextResponse.json({
                hasAccount: false,
                onboardingComplete: false,
                payoutsEnabled: false,
                chargesEnabled: false,
            });
        }

        const account = await stripe.accounts.retrieve(profile.stripe_account_id);

        return NextResponse.json({
            hasAccount: true,
            onboardingComplete: account.details_submitted ?? false,
            payoutsEnabled: account.payouts_enabled ?? false,
            chargesEnabled: account.charges_enabled ?? false,
        });
    } catch (error: unknown) {
        const message = error instanceof Error ? error.message : 'Failed to check account status';
        console.error('[stripe/connect] GET Error:', error);
        return NextResponse.json({ error: message }, { status: 500 });
    }
}
