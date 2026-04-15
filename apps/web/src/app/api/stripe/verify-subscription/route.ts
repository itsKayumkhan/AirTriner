// ============================================
// Verify Subscription Session (Fallback for webhook)
// Used when Stripe webhook hasn't fired yet (e.g. localhost dev)
// ============================================
import { NextRequest, NextResponse } from 'next/server';
import Stripe from 'stripe';
import { createClient } from '@supabase/supabase-js';

export async function POST(req: NextRequest) {
    try {
        if (!process.env.STRIPE_SECRET_KEY) {
            return NextResponse.json({ error: 'Stripe not configured' }, { status: 500 });
        }
        if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
            return NextResponse.json({ error: 'Supabase service key not set' }, { status: 500 });
        }

        const stripe = new Stripe(process.env.STRIPE_SECRET_KEY, { apiVersion: '2026-02-25.clover' });
        const supabaseAdmin = createClient(
            process.env.NEXT_PUBLIC_SUPABASE_URL!,
            process.env.SUPABASE_SERVICE_ROLE_KEY
        );

        const { sessionId } = await req.json();
        if (!sessionId) {
            return NextResponse.json({ error: 'sessionId required' }, { status: 400 });
        }

        // Fetch the Stripe checkout session
        const session = await stripe.checkout.sessions.retrieve(sessionId);

        // Check if payment succeeded
        if (session.payment_status !== 'paid' && session.status !== 'complete') {
            return NextResponse.json({ error: 'Payment not completed yet', status: session.payment_status }, { status: 400 });
        }

        const userId = session.metadata?.userId;
        const plan = session.metadata?.plan;

        if (!userId) {
            return NextResponse.json({ error: 'No userId in session metadata' }, { status: 400 });
        }

        // Check current status — if already active, don't overwrite
        const { data: profile } = await supabaseAdmin
            .from('trainer_profiles')
            .select('subscription_status')
            .eq('user_id', userId)
            .maybeSingle();

        if (profile?.subscription_status === 'active') {
            return NextResponse.json({ success: true, alreadyActive: true });
        }

        // Calculate expiry
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
            console.error('[verify-subscription] DB update failed:', error);
            return NextResponse.json({ error: 'Failed to activate subscription' }, { status: 500 });
        }

        return NextResponse.json({ success: true, activated: true });
    } catch (err: any) {
        console.error('[verify-subscription] Error:', err);
        return NextResponse.json({ error: err.message || 'Unknown error' }, { status: 500 });
    }
}
